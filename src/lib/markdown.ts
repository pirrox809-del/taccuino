/**
 * Taccuino — libreria di conversione blocchi ↔ Markdown (server-side).
 *
 * - blocksToMarkdown: serializza i blocchi in Markdown (export).
 * - markdownToBlocks: parser riga-per-riga (state machine) per l'import.
 *
 * La formattazione inline usa un sottoinsieme di Markdown
 * (grassetto, corsivo, barrato, codice, link) mappato su HTML.
 */
import { Block, BlockType } from '@/lib/types'
import { isAllowedUrl } from '@/lib/blocks-db'

const MAX_INDENT = 4

function clampIndent(n: number): number {
  return Math.min(Math.max(Math.floor(n), 0), MAX_INDENT)
}

const EMOJI_RE = /\p{Extended_Pictographic}/u

/** true se il carattere è un'emoji/pittogramma (💡, ⚡, 🗺, ⚠, …). */
function isEmoji(char: string): boolean {
  return EMOJI_RE.test(char)
}

function makeBlock(fields: {
  type: BlockType
  content: string
  checked?: boolean
  language?: string
  url?: string
  caption?: string
  icon?: string
  indent?: number
}): Block {
  const block: Block = {
    id: crypto.randomUUID(),
    type: fields.type,
    content: fields.content,
    checked: fields.checked ?? false,
    indent: clampIndent(fields.indent ?? 0),
  }
  if (fields.language !== undefined) block.language = fields.language
  if (fields.url !== undefined) block.url = fields.url
  if (fields.caption !== undefined) block.caption = fields.caption
  if (fields.icon !== undefined) block.icon = fields.icon
  return block
}

// ---------------------------------------------------------------------------
// Inline: Markdown → HTML
// ---------------------------------------------------------------------------

export function inlineMdToHtml(text: string): string {
  // 0. rimuove i NUL (usati come segnaposto nei passi successivi)
  let out = text.replace(/\u0000/g, '')
  // 1. escape delle entità HTML
  out = out
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
  // 2. estrazione degli span di codice in placeholder \u0000N\u0000
  const codeSpans: string[] = []
  out = out.replace(/`([^`]+)`/g, (_match, code: string) => {
    codeSpans.push(code)
    return `\u0000${codeSpans.length - 1}\u0000`
  })
  // 3. grassetto
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>')
  // 4. corsivo
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  // 5. barrato
  out = out.replace(/~~([^~]+)~~/g, '<s>$1</s>')
  // 6. link (schemi sicuri + link pagina interni taccuino://page/<id>)
  out = out.replace(/\[([^\]]*)\]\(([^)\s]+)\)/g, (_match, label: string, url: string) => {
    // link interno ad altra pagina: [testo](taccuino://page/<id>)
    const internal = /^taccuino:\/\/page\/([A-Za-z0-9]+)$/.exec(url)
    if (internal) {
      return `<a data-page-id="${internal[1]}" class="page-link" href="#">${label}</a>`
    }
    if (/^(https?:\/\/|mailto:|#)/.test(url)) {
      return `<a href="${url}" rel="noopener noreferrer nofollow" target="_blank">${label}</a>`
    }
    return label
  })
  // 7. ripristino degli span di codice
  out = out.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => `<code>${codeSpans[Number(index)] ?? ''}</code>`)
  return out
}

// ---------------------------------------------------------------------------
// Inline: HTML → Markdown
// ---------------------------------------------------------------------------

export function inlineHtmlToMd(html: string): string {
  let out = html
  // link pagina interno (data-page-id) → [testo](taccuino://page/<id>) — prima dei link comuni
  out = out.replace(
    /<a\s+[^>]*?data-page-id\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi,
    (_match, dq: string, sq: string, label: string) => `[${label}](taccuino://page/${dq || sq})`,
  )
  // link → [testo](url) — href in qualunque posizione tra gli attributi
  const anchor = /<a\s+[^>]*?href\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi
  out = out.replace(anchor, (_match, dq: string, sq: string, label: string) => {
    const href = dq || sq
    // i link pagina senza data-page-id catturato restano riferimenti interni neutri
    if (/^(#|)$/.test(href)) return label
    return `[${label}](${href})`
  })
  // a capo → spazio
  out = out.replace(/<br\s*\/?>/gi, ' ')
  // formattazione nota
  out = out.replace(/<(strong|b)>(.*?)<\/\1>/gi, '**$2**')
  out = out.replace(/<(em|i)>(.*?)<\/\1>/gi, '*$2*')
  out = out.replace(/<code>(.*?)<\/code>/gi, '`$1`')
  out = out.replace(/<(s|strike|del)>(.*?)<\/\1>/gi, '~~$2~~')
  // <u> → testo semplice
  out = out.replace(/<\/?u>/gi, '')
  // rimozione di ogni altro tag residuo
  out = out.replace(/<[^>]+>/g, '')
  // decodifica delle entità (&amp; per ultima)
  out = out
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
  return out
}

/** Testo puro da un frammento HTML inline (tag rimossi, entità decodificate). */
export function stripInlineHtml(html: string): string {
  let out = html.replace(/<br\s*\/?>/gi, ' ')
  out = out.replace(/<[^>]+>/g, '')
  out = out
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
  return out.replace(/\s+/g, ' ').trim()
}

// ---------------------------------------------------------------------------
// Blocchi → Markdown
// ---------------------------------------------------------------------------

export function blocksToMarkdown(blocks: Block[]): string {
  const lines: string[] = []
  let counter = 0
  let prevType: BlockType | null = null
  for (const block of blocks) {
    const indent = '  '.repeat(clampIndent(block.indent ?? 0))
    const inline = inlineHtmlToMd(block.content)
    switch (block.type) {
      case 'paragraph':
        lines.push(inline)
        break
      case 'heading1':
        lines.push(`# ${inline}`)
        break
      case 'heading2':
        lines.push(`## ${inline}`)
        break
      case 'heading3':
        lines.push(`### ${inline}`)
        break
      case 'bullet':
        lines.push(`${indent}- ${inline}`)
        break
      case 'numbered':
        counter = prevType === 'numbered' ? counter + 1 : 1
        lines.push(`${indent}${counter}. ${inline}`)
        break
      case 'checklist':
        lines.push(`${indent}${block.checked ? '- [x]' : '- [ ]'} ${inline}`)
        break
      case 'quote':
        lines.push(`> ${inline}`)
        break
      case 'callout':
        lines.push(`> [!note] ${block.icon ?? '💡'} ${inline}`)
        break
      case 'code':
        lines.push('```' + (block.language ?? '') + '\n' + block.content + '\n```')
        break
      case 'divider':
        lines.push('---')
        break
      case 'image':
        lines.push(`![${block.caption ?? ''}](${block.url ?? ''})`)
        break
      case 'bookmark':
        lines.push(block.url ?? '')
        break
    }
    prevType = block.type
  }
  return lines.join('\n\n')
}

// ---------------------------------------------------------------------------
// Markdown → Blocchi (state machine riga per riga)
// ---------------------------------------------------------------------------

export function markdownToBlocks(md: string): Block[] {
  const blocks: Block[] = []
  const lines = md.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n')
  let inCode = false
  let codeLanguage = ''
  let codeLines: string[] = []

  const closeCode = () => {
    blocks.push(makeBlock({ type: 'code', content: codeLines.join('\n'), ...(codeLanguage ? { language: codeLanguage } : {}) }))
    inCode = false
    codeLines = []
    codeLanguage = ''
  }

  for (const rawLine of lines) {
    // dentro una fence: accumula fino alla chiusura
    if (inCode) {
      if (/^```/.test(rawLine)) {
        closeCode()
      } else {
        codeLines.push(rawLine)
      }
      continue
    }
    // apertura fence
    if (/^```/.test(rawLine)) {
      inCode = true
      codeLanguage = rawLine.slice(3).trim().slice(0, 50)
      continue
    }

    const trimmed = rawLine.trim()
    // riga vuota → separatore
    if (trimmed === '') continue

    // divisore
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(makeBlock({ type: 'divider', content: '' }))
      continue
    }
    // heading
    const heading = /^(#{1,6})\s+(.+)$/.exec(rawLine)
    if (heading) {
      const level = heading[1].length
      const type: BlockType = level === 1 ? 'heading1' : level === 2 ? 'heading2' : 'heading3'
      blocks.push(makeBlock({ type, content: inlineMdToHtml(heading[2]) }))
      continue
    }
    // checklist
    const checklist = /^(\s*)[-*]\s+\[([ xX])\]\s*(.*)$/.exec(rawLine)
    if (checklist) {
      blocks.push(
        makeBlock({
          type: 'checklist',
          content: inlineMdToHtml(checklist[3]),
          checked: checklist[2] !== ' ',
          indent: checklist[1].length / 2,
        }),
      )
      continue
    }
    // elenco puntato
    const bullet = /^(\s*)[-*]\s+(.+)$/.exec(rawLine)
    if (bullet) {
      blocks.push(makeBlock({ type: 'bullet', content: inlineMdToHtml(bullet[2]), indent: bullet[1].length / 2 }))
      continue
    }
    // elenco numerato
    const numbered = /^(\s*)\d+[.)]\s+(.+)$/.exec(rawLine)
    if (numbered) {
      blocks.push(makeBlock({ type: 'numbered', content: inlineMdToHtml(numbered[2]), indent: numbered[1].length / 2 }))
      continue
    }
    // citazione / callout
    const quote = /^>\s?(.*)$/.exec(rawLine)
    if (quote) {
      let content = quote[1]
      const calloutMarker = /^\[!note\]\s?/.exec(content)
      if (calloutMarker) {
        content = content.slice(calloutMarker[0].length)
        const rest = content.replace(/^\s+/, '')
        const firstCodePoint = rest.codePointAt(0)
        const firstChar = firstCodePoint === undefined ? '' : String.fromCodePoint(firstCodePoint)
        if (firstChar !== '' && isEmoji(firstChar)) {
          const body = rest.slice(firstChar.length).replace(/^\s+/, '')
          blocks.push(makeBlock({ type: 'callout', content: inlineMdToHtml(body), icon: firstChar }))
        } else {
          blocks.push(makeBlock({ type: 'callout', content: inlineMdToHtml(rest), icon: '💡' }))
        }
      } else {
        blocks.push(makeBlock({ type: 'quote', content: inlineMdToHtml(content) }))
      }
      continue
    }
    // immagine
    const image = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(trimmed)
    if (image) {
      const url = isAllowedUrl(image[2]) ? image[2] : undefined
      blocks.push(makeBlock({ type: 'image', content: '', caption: image[1], ...(url !== undefined ? { url } : {}) }))
      continue
    }
    // segnalibro
    if (/^https?:\/\/\S+$/.test(trimmed)) {
      blocks.push(makeBlock({ type: 'bookmark', content: '', url: trimmed }))
      continue
    }
    // paragrafo (una riga = un paragrafo)
    blocks.push(makeBlock({ type: 'paragraph', content: inlineMdToHtml(trimmed) }))
  }

  // fence mai chiusa → chiudi a EOF
  if (inCode) closeCode()

  return blocks
}

// ---------------------------------------------------------------------------
// Utilità
// ---------------------------------------------------------------------------

/** Slug per i nomi file di export: lowercased, non-alfanumerico → '-', fallback "senza-titolo". */
export function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'senza-titolo'
}

/** Paragrafo vuoto (usato per pagine senza contenuto). */
export function emptyParagraph(): Block {
  return makeBlock({ type: 'paragraph', content: '' })
}

// ---------------------------------------------------------------------------
// Helper per l'import di archivi Markdown (stile export Notion)
// ---------------------------------------------------------------------------

/** Rimuove l'estensione .md / .markdown / .csv da un nome file. */
export function stripExtension(name: string): string {
  return name.replace(/\.(md|markdown|csv)$/i, '')
}

/**
 * Pulizia di un nome (file o cartella) in stile export Notion:
 * - decodifica del percent-encoding (con fallback sul nome grezzo);
 * - rimozione di un eventuale suffisso " <32 caratteri esadecimali>"
 *   prima dell'estensione o a fine nome;
 * - trattini/underscore → spazi, spaziatura normalizzata.
 */
export function cleanImportName(raw: string): string {
  let name = raw
  try {
    name = decodeURIComponent(raw)
  } catch {
    // nome non percent-encodato: si usa il valore grezzo
  }
  name = name.replace(/[ ]([0-9a-fA-F]{32})(?=\.[^.]*$|$)/, '')
  return name.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export interface ZipEntryAnalysis {
  /** Segmenti del percorso: cartelle… + nome file finale. */
  segments: string[]
}

/**
 * Analizza il percorso di una entry ZIP: restituisce i segmenti se la entry è
 * importabile (file .md/.markdown/.csv, niente __MACOSX, niente segmenti nascosti,
 * niente ".." né percorsi assoluti), altrimenti null.
 */
export function analyzeZipEntryPath(rawPath: string): ZipEntryAnalysis | null {
  const path = rawPath.replace(/\\/g, '/')
  if (path.startsWith('/')) return null
  if (/^[a-zA-Z]:/.test(path)) return null
  const segments = path.split('/').filter((s) => s.length > 0)
  if (segments.length === 0) return null
  if (segments.some((s) => s === '.' || s === '..')) return null
  if (segments[0] === '__MACOSX') return null
  if (segments.some((s) => s.startsWith('.'))) return null
  const fileName = segments[segments.length - 1]
  if (!/\.(md|markdown|csv)$/i.test(fileName)) return null
  return { segments }
}

/**
 * Da documento Markdown a pagina: il titolo viene dal primo blocco heading1
 * (che viene rimosso), altrimenti dal titolo di riserva.
 */
export function pageFromMarkdown(md: string, fallbackTitle: string): { title: string; blocks: Block[] } {
  let blocks = markdownToBlocks(md)
  const h1Index = blocks.findIndex((b) => b.type === 'heading1')
  let title = ''
  if (h1Index !== -1) {
    title = stripInlineHtml(blocks[h1Index].content)
    blocks = blocks.filter((_block, index) => index !== h1Index)
  }
  if (!title) title = fallbackTitle || 'Senza titolo'
  if (blocks.length === 0) blocks = [emptyParagraph()]
  return { title, blocks }
}
