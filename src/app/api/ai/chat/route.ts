/**
 * Taccuino — /api/ai/chat
 * POST : assistente AI con accesso agli strumenti del workspace.
 *
 * Il modello può eseguire azioni reali sull'app (creare pagine, scrivere
 * contenuti, cercare, leggere, aprire) tramite un protocollo JSON: quando
 * risponde con una chiamata strumento, il server la esegue sul database
 * locale e rimanda il risultato al modello fino alla risposta finale.
 * Tutto gira in locale: i contenuti non lasciano mai la macchina.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import {
  HttpError,
  countWordsInBlocks,
  errorResponse,
  nextSiblingPosition,
  recordWritingDay,
  writePageBlocks,
  maybeSnapshotVersion,
} from '@/lib/blocks-db'
import { stripInlineHtml } from '@/lib/markdown'
import type { Block } from '@/lib/types'
import ZAI from 'z-ai-web-dev-sdk'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const MAX_TOOL_ROUNDS = 6
const MAX_BLOCKS_PER_WRITE = 150
const MAX_PAGES_IN_OUTLINE = 200

// ---------------------------------------------------------------------------
// SDK (istanza unica riutilizzata tra le richieste)
// ---------------------------------------------------------------------------
let zaiPromise: Promise<Awaited<ReturnType<typeof ZAI.create>>> | null = null
function getZai() {
  zaiPromise ??= ZAI.create()
  return zaiPromise
}

// ---------------------------------------------------------------------------
// Schema richiesta + chiamate strumento
// ---------------------------------------------------------------------------
const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(8_000),
})

const bodySchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(24),
  locale: z.enum(['it', 'en']).default('it'),
  currentPageId: z.string().max(64).nullish(),
})

const toolCallSchema = z.object({
  tool: z.enum(['list_pages', 'search_workspace', 'read_page', 'create_page', 'append_to_page', 'open_page']),
  args: z.record(z.string(), z.unknown()).default({}),
})

type ToolCall = z.infer<typeof toolCallSchema>
type ToolName = ToolCall['tool']

/** Azione da eseguire nell'interfaccia dopo la risposta. */
interface UiAction {
  type: 'open' | 'created' | 'updated'
  pageId: string
  title?: string
}

// ---------------------------------------------------------------------------
// Utilità
// ---------------------------------------------------------------------------
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Formattazione inline consentita dall'editor: **grassetto**, *corsivo*, `codice`. */
function inlineToHtml(text: string): string {
  const escaped = escapeHtml(text)
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

function asString(args: Record<string, unknown>, key: string, max = 500): string | undefined {
  const value = args[key]
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : undefined
}

/** Risolve una pagina per id oppure per titolo (esatto, poi case-insensitive). */
async function resolvePage(ref: { pageId?: string | null; title?: string | null }) {
  if (ref.pageId) {
    const byId = await db.page.findUnique({ where: { id: ref.pageId } })
    if (byId && byId.deletedAt === null) return byId
  }
  if (ref.title) {
    const exact = await db.page.findFirst({ where: { deletedAt: null, title: ref.title } })
    if (exact) return exact
    const candidates = await db.page.findMany({ where: { deletedAt: null }, take: 100 })
    const lower = ref.title.toLowerCase()
    return candidates.find((p) => p.title.toLowerCase() === lower) ?? null
  }
  return null
}

/** Panoramica compatta del workspace (id — titolo — tipo — genitore). */
async function workspaceOutline(): Promise<string> {
  const pages = await db.page.findMany({
    where: { deletedAt: null },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    take: MAX_PAGES_IN_OUTLINE,
    select: { id: true, title: true, kind: true, parentId: true },
  })
  if (pages.length === 0) return '(il workspace è vuoto)'
  const titles = new Map(pages.map((p) => [p.id, p.title || '(senza titolo)']))
  return pages
    .map((p) => {
      const parent = p.parentId ? titles.get(p.parentId) : null
      const path = parent ? ` [in: ${parent}]` : ''
      const kind = p.kind === 'database' ? 'database' : 'doc'
      return `- ${p.id} | ${titles.get(p.id)} | ${kind}${path}`
    })
    .join('\n')
}

/**
 * Converte un testo Markdown semplificato (sottoinsieme supportato dall'editor)
 * in blocchi. Formati: # ## ###, -, 1., - [ ] / - [x], >, ``` con lingua, ---.
 */
function markdownToBlocks(content: string): Block[] {
  const blocks: Block[] = []
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  let inCode = false
  let codeLanguage: string | undefined
  let codeLines: string[] = []

  const push = (block: Omit<Block, 'id'>) => {
    if (blocks.length >= MAX_BLOCKS_PER_WRITE) return
    blocks.push({ id: crypto.randomUUID(), ...block })
  }

  const flushCode = () => {
    if (!inCode) return
    push({ type: 'code', content: escapeHtml(codeLines.join('\n')), language: codeLanguage })
    inCode = false
    codeLanguage = undefined
    codeLines = []
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (line.trimStart().startsWith('```')) {
      if (inCode) {
        flushCode()
      } else {
        flushCode()
        inCode = true
        codeLanguage = line.trimStart().slice(3).trim() || undefined
      }
      continue
    }
    if (inCode) {
      codeLines.push(raw)
      continue
    }
    if (line.trim() === '') continue
    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    if (heading) {
      const level = heading[1].length
      push({
        type: level === 1 ? 'heading1' : level === 2 ? 'heading2' : 'heading3',
        content: inlineToHtml(heading[2].trim()),
      })
      continue
    }
    const todo = /^[-*]\s+\[( |x|X)\]\s+(.*)$/.exec(line)
    if (todo) {
      push({ type: 'checklist', content: inlineToHtml(todo[2].trim()), checked: todo[1].toLowerCase() === 'x' })
      continue
    }
    if (/^[-*]\s+/.test(line)) {
      push({ type: 'bullet', content: inlineToHtml(line.replace(/^[-*]\s+/, '').trim()) })
      continue
    }
    if (/^\d+[.)]\s+/.test(line)) {
      push({ type: 'numbered', content: inlineToHtml(line.replace(/^\d+[.)]\s+/, '').trim()) })
      continue
    }
    if (/^>\s?/.test(line)) {
      push({ type: 'quote', content: inlineToHtml(line.replace(/^>\s?/, '').trim()) })
      continue
    }
    if (/^---+$/.test(line.trim())) {
      push({ type: 'divider', content: '' })
      continue
    }
    push({ type: 'paragraph', content: inlineToHtml(line.trim()) })
  }
  flushCode()
  return blocks
}

/** Rappresentazione testuale di una pagina per il modello. */
async function pageToText(pageId: string): Promise<string> {
  const page = await db.page.findUnique({
    where: { id: pageId },
    include: {
      blocks: { orderBy: { position: 'asc' } },
      database: { include: { rows: { orderBy: { position: 'asc' } } } },
    },
  })
  if (!page || page.deletedAt !== null) return 'ERROR: pagina non trovata'

  const header = `PAGINA: ${page.title || '(senza titolo)'} | id: ${page.id} | tipo: ${page.kind}`
  if (page.kind === 'database' && page.database) {
    let properties: Array<{ name: string; type: string }> = []
    try {
      properties = JSON.parse(page.database.properties) as Array<{ name: string; type: string }>
    } catch {
      properties = []
    }
    const rowsText = page.database.rows
      .slice(0, 20)
      .map((row) => {
        let values: Record<string, unknown> = {}
        try {
          values = JSON.parse(row.properties) as Record<string, unknown>
        } catch {
          values = {}
        }
        const cells = properties
          .map((prop) => {
            const value = values[prop.name]
            return `${prop.name}: ${value === undefined || value === null || value === '' ? '—' : String(value)}`
          })
          .join(' | ')
        return `  - ${row.title || '(senza titolo)'} → ${cells}`
      })
      .join('\n')
    return `${header}\nColonne: ${properties.map((p) => `${p.name} (${p.type})`).join(', ')}\nRighe (${page.database.rows.length}):\n${rowsText || '  (vuota)'}`
  }

  const blocksText = page.blocks
    .slice(0, 200)
    .map((b) => `  [${b.type}] ${stripInlineHtml(b.content).slice(0, 400)}`)
    .join('\n')
  return `${header}\nBlocchi (${page.blocks.length}):\n${blocksText || '  (vuota)'}`
}

// ---------------------------------------------------------------------------
// Esecuzione strumenti (accesso diretto al database locale)
// ---------------------------------------------------------------------------
async function executeTool(call: ToolCall): Promise<{ result: string; action?: UiAction }> {
  const args = call.args
  switch (call.tool) {
    case 'list_pages':
      return { result: await workspaceOutline() }

    case 'search_workspace': {
      const query = asString(args, 'query', 200)
      if (!query) return { result: 'ERROR: manca "query" (stringa da cercare)' }
      const pages = await db.page.findMany({
        where: {
          deletedAt: null,
          OR: [{ title: { contains: query } }, { blocks: { some: { content: { contains: query } } } }],
        },
        orderBy: { updatedAt: 'desc' },
        take: 8,
        include: { blocks: { orderBy: { position: 'asc' } } },
      })
      if (pages.length === 0) return { result: `Nessun risultato per "${query}"` }
      return {
        result: pages
          .map((p) => {
            const hit = p.blocks.find((b) => stripInlineHtml(b.content).toLowerCase().includes(query.toLowerCase()))
            const snippet = hit ? stripInlineHtml(hit.content).slice(0, 150) : '(match nel titolo)'
            return `- ${p.id} | ${p.title || '(senza titolo)'} | …${snippet}…`
          })
          .join('\n'),
      }
    }

    case 'read_page': {
      const page = await resolvePage({ pageId: asString(args, 'pageId', 64), title: asString(args, 'title', 200) })
      if (!page) return { result: 'ERROR: pagina non trovata (usa list_pages per gli id validi)' }
      return { result: await pageToText(page.id) }
    }

    case 'create_page': {
      const title = asString(args, 'title', 200)
      if (!title) return { result: 'ERROR: manca "title" (titolo della nuova pagina)' }
      const icon = asString(args, 'icon', 16)
      const parentTitle = asString(args, 'parentTitle', 200)
      let parentId: string | null = null
      if (parentTitle) {
        const parent = await resolvePage({ title: parentTitle })
        if (!parent) return { result: `ERROR: pagina genitore "${parentTitle}" non trovata` }
        parentId = parent.id
      }
      const position = await nextSiblingPosition(parentId)
      const page = await db.page.create({
        data: { title, parentId, icon: icon ?? null, position, kind: 'doc' },
      })
      const content = asString(args, 'content', 20_000)
      if (content) {
        const blocks = markdownToBlocks(content)
        await writePageBlocks(page.id, blocks)
        await recordWritingDay(page.id, countWordsInBlocks(blocks))
      }
      return {
        result: `OK: pagina "${title}" creata con id ${page.id}${content ? ' e contenuto iniziale' : ''}`,
        action: { type: 'created', pageId: page.id, title },
      }
    }

    case 'append_to_page': {
      const page = await resolvePage({ pageId: asString(args, 'pageId', 64), title: asString(args, 'title', 200) })
      if (!page) return { result: 'ERROR: pagina non trovata (usa list_pages per gli id validi)' }
      const content = asString(args, 'content', 20_000)
      if (!content) return { result: 'ERROR: manca "content" (testo Markdown da aggiungere in fondo)' }
      const existing = await db.block.findMany({ where: { pageId: page.id }, orderBy: { position: 'asc' } })
      const existingBlocks: Block[] = existing.map((b) => ({
        id: b.id,
        type: b.type as Block['type'],
        content: b.content,
        checked: b.checked,
        language: b.language ?? undefined,
        url: b.url ?? undefined,
        caption: b.caption ?? undefined,
        icon: b.icon ?? undefined,
        indent: b.indent,
      }))
      const newBlocks = markdownToBlocks(content)
      const merged = [...existingBlocks, ...newBlocks]
      await writePageBlocks(page.id, merged)
      await maybeSnapshotVersion(page.id, page.title, merged)
      await recordWritingDay(page.id, countWordsInBlocks(merged))
      return {
        result: `OK: ${newBlocks.length} blocchi aggiunti a "${page.title || '(senza titolo)'}"`,
        action: { type: 'updated', pageId: page.id, title: page.title },
      }
    }

    case 'open_page': {
      const page = await resolvePage({ pageId: asString(args, 'pageId', 64), title: asString(args, 'title', 200) })
      if (!page) return { result: 'ERROR: pagina non trovata (usa list_pages per gli id validi)' }
      return {
        result: `OK: pagina "${page.title || '(senza titolo)'}" aperta nell'app`,
        action: { type: 'open', pageId: page.id, title: page.title },
      }
    }
  }
}

/** Estrae gli oggetti JSON bilanciati da un testo (rispetta stringhe ed escape). */
function extractBalancedJsonObjects(text: string): string[] {
  const objects: string[] = []
  let depth = 0
  let inString = false
  let escape = false
  let start = -1
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escape) escape = false
      else if (ch === '\\') escape = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') {
      if (depth === 0) start = i
      depth++
    } else if (ch === '}') {
      if (depth > 0) {
        depth--
        if (depth === 0 && start !== -1) {
          objects.push(text.slice(start, i + 1))
          start = -1
        }
      }
    }
  }
  return objects
}

/**
 * Estrae le chiamate strumento dalla risposta del modello: fino a 3 oggetti
 * JSON (anche su più righe o dentro code fence), gli altri blocchi sono testo.
 */
function parseToolCalls(content: string): ToolCall[] {
  const cleaned = content.replace(/```(?:json)?/gi, '')
  const candidates = extractBalancedJsonObjects(cleaned)
  const calls: ToolCall[] = []
  for (const candidate of candidates) {
    try {
      const parsed = toolCallSchema.safeParse(JSON.parse(candidate))
      if (parsed.success) calls.push(parsed.data)
    } catch {
      // oggetto non JSON (prosa tra parentesi graffe): ignorato
    }
  }
  return calls.slice(0, 3)
}

// ---------------------------------------------------------------------------
// Prompt di sistema
// ---------------------------------------------------------------------------
function buildSystemPrompt(
  locale: 'it' | 'en',
  outline: string,
  currentPageId: string | null | undefined
): string {
  const now = new Date().toISOString().slice(0, 10)
  const it = `Sei l'assistente AI integrato in Taccuino, un'app di note a blocchi local-first.
Data odierna: ${now}. Rispondi SEMPRE nella lingua dell'utente.

Hai accesso reale al workspace dell'utente. Pagina corrente (se aperta): ${currentPageId ?? 'nessuna'}.

STRUMENTI — rispondi con SOLO un oggetto JSON per usare uno strumento:
{"tool":"list_pages","args":{}}
{"tool":"search_workspace","args":{"query":"testo"}}
{"tool":"read_page","args":{"title":"Titolo pagina"}}   // oppure {"pageId":"..."}
{"tool":"create_page","args":{"title":"Nuova pagina","icon":"💡","content":"# Titolo\\n- punto uno\\n- punto due","parentTitle":"Genitore opzionale"}}
{"tool":"append_to_page","args":{"title":"Titolo pagina","content":"- nuovo punto\\n- altro punto"}}
{"tool":"open_page","args":{"title":"Titolo pagina"}}

Il campo "content" usa Markdown semplice: # ## ### titoli, - elenchi, 1. numerati, - [ ] checklist, > citazioni, **grassetto**, *corsivo*, \`\`\` codice, --- separatore. NON ripetere il titolo della pagina come H1 nel content.
Puoi includere fino a 3 oggetti JSON consecutivi nello stesso messaggio per eseguire più strumenti in sequenza (es. create_page + open_page).
Dopo ogni chiamata riceverai "TOOL_RESULT (...)" come messaggio utente: puoi concatenare più strumenti, poi dai la risposta FINALE in testo normale.
Regole:
- NON inventare mai id o titoli di pagine: usa list_pages/search_workspace.
- Nella risposta finale conferma in una riga cosa hai fatto (pagine create/modificate/aperte).
- Sii conciso, utile e concreto. Le note dell'utente sono sacre: non cancellare mai contenuti.`

  const en = `You are the AI assistant built into Taccuino, a local-first block notes app.
Today: ${now}. ALWAYS reply in the user's language.

You have real access to the user's workspace. Current page (if open): ${currentPageId ?? 'none'}.

TOOLS — reply with ONLY a JSON object to use one:
{"tool":"list_pages","args":{}}
{"tool":"search_workspace","args":{"query":"text"}}
{"tool":"read_page","args":{"title":"Page title"}}   // or {"pageId":"..."}
{"tool":"create_page","args":{"title":"New page","icon":"💡","content":"# Title\\n- point one\\n- point two","parentTitle":"Optional parent"}}
{"tool":"append_to_page","args":{"title":"Page title","content":"- new point\\n- another point"}}
{"tool":"open_page","args":{"title":"Page title"}}

The "content" field uses simple Markdown: # ## ### headings, - bullets, 1. numbered, - [ ] checklist, > quotes, **bold**, *italic*, \`\`\` code, --- divider. Do NOT repeat the page title as an H1 inside content.
You may include up to 3 consecutive JSON objects in the same message to chain tools (e.g. create_page + open_page).
After each call you receive "TOOL_RESULT (...)" as a user message: you may chain tools, then give the FINAL answer as plain text.
Rules:
- NEVER invent page ids or titles: use list_pages/search_workspace.
- In the final answer, confirm in one line what you did (pages created/updated/opened).
- Be concise, useful and concrete. The user's notes are sacred: never delete content.`

  const preamble = locale === 'en' ? en : it
  return `${preamble}\n\nWORKSPACE:\n${outline}`
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const body = bodySchema.parse(await req.json())
    const outline = await workspaceOutline()
    const chatMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      { role: 'assistant', content: buildSystemPrompt(body.locale, outline, body.currentPageId ?? null) },
      ...body.messages,
    ]

    const zai = await getZai()
    const actions: UiAction[] = []
    const trace: ToolName[] = []

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const completion = await zai.chat.completions.create({
        messages: chatMessages,
        thinking: { type: 'disabled' },
      })
      const content = completion.choices[0]?.message?.content?.trim() ?? ''
      const calls = parseToolCalls(content)

      if (calls.length === 0) {
        return NextResponse.json({ reply: content || '…', actions, trace })
      }

      chatMessages.push({ role: 'assistant', content })
      const results: string[] = []
      for (const call of calls) {
        let outcome: { result: string; action?: UiAction }
        try {
          outcome = await executeTool(call)
        } catch (e) {
          outcome = { result: `ERROR: ${e instanceof Error ? e.message : 'strumento non riuscito'}` }
        }
        if (outcome.action) actions.push(outcome.action)
        trace.push(call.tool)
        results.push(`TOOL_RESULT (${call.tool}): ${outcome.result}`)
      }
      chatMessages.push({
        role: 'user',
        content: `${results.join('\n')}\n\n${
          body.locale === 'en'
            ? 'Continue: call another tool (JSON only) or give the final plain-text answer.'
            : 'Continua: chiama un altro strumento (solo JSON) o dai la risposta finale in testo normale.'
        }`,
      })
    }

    return NextResponse.json({
      reply:
        body.locale === 'en'
          ? 'I reached the tool limit for this request — ask me to continue if needed.'
          : 'Ho raggiunto il limite di operazioni per questa richiesta — chiedimi di continuare se serve.',
      actions,
      trace,
    })
  } catch (e) {
    if (e instanceof HttpError) return errorResponse(e)
    // SDK LLM non disponibile/credenziali mancanti: errore chiaro per la UI
    const message = e instanceof Error ? e.message : 'AI unavailable'
    console.error('[ai/chat]', message)
    return NextResponse.json({ error: 'AI_UNAVAILABLE', message }, { status: 503 })
  }
}
