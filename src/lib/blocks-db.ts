/**
 * Taccuino — helper database (server-side).
 *
 * - Conversione righe Prisma ↔ DTO del contratto (src/lib/types.ts).
 * - Sanificazione degli input (zod).
 * - Scrittura atomica dei blocchi e politica delle snapshot di versione.
 * - Utilità di navigazione dell'albero delle pagine.
 * - Errori HTTP e risposte JSON uniformi per i route handler.
 */
import { NextResponse } from 'next/server'
import { ZodError, z } from 'zod'
import { db } from '@/lib/db'
import {
  BLOCK_TYPES,
  Block,
  BlockType,
  DatabaseProperty,
  DatabaseRow,
  PageMeta,
  RowProperties,
  SELECT_COLORS,
} from '@/lib/types'

// ---------------------------------------------------------------------------
// Errori HTTP e risposte uniformi
// ---------------------------------------------------------------------------

/** Errore applicativo con status HTTP associato. */
export class HttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Errore 404 standard del contratto API. */
export function notFound(): HttpError {
  return new HttpError(404, 'Not found')
}

/** Converte un'eccezione in risposta JSON: HttpError → status proprio, ZodError → 400, resto → 500. */
export function errorResponse(e: unknown): NextResponse {
  if (e instanceof HttpError) {
    return NextResponse.json({ error: e.message }, { status: e.status })
  }
  if (e instanceof ZodError) {
    const message = e.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ')
    return NextResponse.json({ error: message || 'Input non valido' }, { status: 400 })
  }
  console.error('[api]', e)
  return NextResponse.json({ error: 'Internal error' }, { status: 500 })
}

// ---------------------------------------------------------------------------
// Conversione righe → DTO
// ---------------------------------------------------------------------------

/** Righe della tabella Page (campi scalari). */
export interface PageRow {
  id: string
  parentId: string | null
  title: string
  icon: string | null
  position: number
  isFavorite: boolean
  kind: string
  cover: string | null
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

/** Righe della tabella Block. */
export interface BlockRow {
  id: string
  pageId: string
  type: string
  content: string
  checked: boolean
  language: string | null
  url: string | null
  caption: string | null
  icon: string | null
  indent: number
  position: number
}

const ALLOWED_URL_RE = /^(https?:\/\/|data:image\/|\/api\/attachments\/)/

/** URL consentiti per immagini e segnalibri: http(s), data:image/* e allegati locali. */
export function isAllowedUrl(url: string): boolean {
  return ALLOWED_URL_RE.test(url)
}

export function blockRowToDto(row: BlockRow): Block {
  const dto: Block = {
    id: row.id,
    type: row.type as BlockType,
    content: row.content,
    checked: row.checked,
    indent: row.indent,
  }
  if (row.language != null) dto.language = row.language
  if (row.url != null) dto.url = row.url
  if (row.caption != null) dto.caption = row.caption
  if (row.icon != null) dto.icon = row.icon
  return dto
}

export function pageRowToMeta(row: PageRow): PageMeta {
  return {
    id: row.id,
    parentId: row.parentId,
    title: row.title,
    icon: row.icon,
    position: row.position,
    isFavorite: row.isFavorite,
    kind: row.kind === 'database' ? 'database' : 'doc',
    cover: row.cover,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Database semplici: schema, righe e conversioni
// ---------------------------------------------------------------------------

/** Righe della tabella Row. */
export interface RowRecord {
  id: string
  databaseId: string
  title: string
  icon: string | null
  properties: string
  position: number
}

const selectOptionSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(200),
  color: z.enum(SELECT_COLORS as [SelectColorTmp, ...SelectColorTmp[]]),
})

type SelectColorTmp = (typeof SELECT_COLORS)[number]

const databasePropertySchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  type: z.enum(['text', 'number', 'select', 'date', 'checkbox', 'url']),
  options: z.array(selectOptionSchema).max(100).optional(),
})

const MAX_PROPERTIES = 50

/**
 * Sanifica lo schema di un database (array completo di proprietà).
 * Rimuove le opzioni dai tipi non-select e gli id di opzione duplicati.
 */
export function sanitizeDatabaseProperties(input: unknown): DatabaseProperty[] {
  const raw = z.array(databasePropertySchema).max(MAX_PROPERTIES).parse(input)
  const seenProp = new Set<string>()
  const out: DatabaseProperty[] = []
  for (const p of raw) {
    if (seenProp.has(p.id)) continue
    seenProp.add(p.id)
    if (p.type === 'select') {
      const seenOpt = new Set<string>()
      const options = (p.options ?? []).filter((o) => {
        if (seenOpt.has(o.id)) return false
        seenOpt.add(o.id)
        return true
      })
      out.push(options.length > 0 ? { ...p, options } : { ...p, options: [] })
    } else {
      const { options: _ignored, ...rest } = p
      void _ignored
      out.push(rest)
    }
  }
  return out
}

/** Schema predefinito per un nuovo database. */
export const DEFAULT_DATABASE_PROPERTIES: DatabaseProperty[] = [
  {
    id: 'stato',
    name: 'Stato',
    type: 'select',
    options: [
      { id: 'da-fare', label: 'Da fare', color: 'gray' },
      { id: 'in-corso', label: 'In corso', color: 'orange' },
      { id: 'fatto', label: 'Fatto', color: 'green' },
    ],
  },
]

/** Valori ammessi in una cella: stringa, numero finito o booleano. */
const propertyValueSchema = z.union([
  z.string().max(2000),
  z.number().finite(),
  z.boolean(),
  z.null(),
])

const rowPropertiesSchema = z.record(z.string().max(64), propertyValueSchema)

/** Sanifica le proprietà di una riga: chiavi alfanumeriche, valori primitivi. */
export function sanitizeRowProperties(input: unknown): RowProperties {
  return rowPropertiesSchema.parse(input ?? {})
}

/** Converte una riga Row in DTO (le proprietà sono JSON). */
export function rowRecordToDto(row: RowRecord): DatabaseRow {
  let properties: RowProperties = {}
  try {
    const parsed: unknown = JSON.parse(row.properties)
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      properties = parsed as RowProperties
    }
  } catch {
    properties = {}
  }
  return {
    id: row.id,
    title: row.title,
    icon: row.icon,
    properties,
    position: row.position,
  }
}

/** Prossima posizione libera per una riga del database. */
export async function nextRowPosition(databaseId: string): Promise<number> {
  const agg = await db.row.aggregate({ _max: { position: true }, where: { databaseId } })
  return (agg._max.position ?? -1) + 1
}

/** Estrae dal testo HTML di un blocco gli id delle pagine collegate (data-page-id). */
export function extractPageLinks(html: string): string[] {
  const ids: string[] = []
  const re = /data-page-id="([^"]+)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    if (!ids.includes(m[1])) ids.push(m[1])
  }
  return ids
}

// ---------------------------------------------------------------------------
// Sanificazione input
// ---------------------------------------------------------------------------

const blockSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  type: z.enum(BLOCK_TYPES as [BlockType, ...BlockType[]]),
  content: z.string().max(100_000).default(''),
  checked: z.boolean().default(false),
  language: z.string().max(50).nullish(),
  url: z
    .string()
    .max(200_000)
    .refine(isAllowedUrl, 'URL non consentito: ammessi http(s)://, data:image/* e /api/attachments/')
    .nullish(),
  caption: z.string().max(2000).nullish(),
  icon: z.string().max(16).nullish(),
  indent: z.number().int().min(0).max(4).default(0),
})

const MAX_BLOCKS = 5000

const blocksSchema = z.array(blockSchema).max(MAX_BLOCKS, `Troppi blocchi: il limite è ${MAX_BLOCKS}`)

/**
 * Sanifica un array di blocchi proveniente dal client.
 * Oltre il limite di MAX_BLOCKS blocchi la validazione fallisce (→ HTTP 400);
 * ogni blocco non valido fa fallire l'intero payload (ZodError → HTTP 400).
 */
export function sanitizeBlocks(input: unknown): Block[] {
  const validated = blocksSchema.parse(input)
  return validated.map((v) => {
    const block: Block = {
      id: v.id ?? crypto.randomUUID(),
      type: v.type,
      content: v.content,
      checked: v.checked,
      indent: v.indent,
    }
    if (v.language != null) block.language = v.language
    if (v.url != null) block.url = v.url
    if (v.caption != null) block.caption = v.caption
    if (v.icon != null) block.icon = v.icon
    return block
  })
}

/** Copertina: "gradient:<nome>" oppure URL http(s)/allegato locale; null per rimuovere. */
export function sanitizeCover(input: unknown): string | null {
  if (input === null || input === '') return null
  if (typeof input !== 'string') throw new HttpError(400, 'Copertina non valida')
  const value = input.trim()
  if (value === '') return null
  if (value.startsWith('gradient:')) {
    const name = value.slice('gradient:'.length)
    if (!/^[a-z]{3,20}$/.test(name)) throw new HttpError(400, 'Nome gradiente non valido')
    return `gradient:${name}`
  }
  if (isAllowedUrl(value) && value.length <= 200_000) return value
  throw new HttpError(400, 'Copertina non valida: usa gradient:<nome> o un URL consentito')
}

/** Dati di creazione di una riga Block (senza pageId, per le create annidate). */
export function blockToRowData(block: Block, position: number) {
  return {
    id: block.id,
    type: block.type,
    content: block.content,
    checked: block.checked ?? false,
    language: block.language ?? null,
    url: block.url ?? null,
    caption: block.caption ?? null,
    icon: block.icon ?? null,
    indent: Math.min(Math.max(block.indent ?? 0, 0), 4),
    position,
  }
}

/** Firma stabile di una lista di blocchi per confronti di contenuto. */
export function blocksSignature(blocks: Block[]): string {
  return JSON.stringify(
    blocks.map((b) => [
      b.id,
      b.type,
      b.content,
      b.checked ?? false,
      b.language ?? null,
      b.url ?? null,
      b.caption ?? null,
      b.icon ?? null,
      b.indent ?? 0,
    ]),
  )
}

/** Numero di blocchi in una snapshot JSON (0 se corrotta). */
export function snapshotBlockCount(json: string): number {
  try {
    const parsed: unknown = JSON.parse(json)
    return Array.isArray(parsed) ? parsed.length : 0
  } catch {
    return 0
  }
}

// ---------------------------------------------------------------------------
// Scrittura blocchi + versione
// ---------------------------------------------------------------------------

/** Sostituisce tutti i blocchi di una pagina in una transazione e aggiorna updatedAt. */
export async function writePageBlocks(pageId: string, blocks: Block[]): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.block.deleteMany({ where: { pageId } })
    if (blocks.length > 0) {
      await tx.block.createMany({ data: blocks.map((b, i) => ({ ...blockToRowData(b, i), pageId })) })
    }
    await tx.page.update({ where: { id: pageId }, data: { updatedAt: new Date() } })
  })
}

const VERSION_COOLDOWN_MS = 3 * 60 * 1000
const MAX_VERSIONS_PER_PAGE = 20

/**
 * Politica versioni: crea una snapshot (title + blocchi in JSON) solo se la pagina
 * non ha versioni oppure l'ultima è più vecchia di 3 minuti; mantiene al massimo
 * 20 versioni, cancellando le più vecchie oltre la ventesima.
 */
export async function maybeSnapshotVersion(pageId: string, title: string, blocks: Block[]): Promise<void> {
  const last = await db.version.findFirst({ where: { pageId }, orderBy: { createdAt: 'desc' } })
  if (last && Date.now() - last.createdAt.getTime() < VERSION_COOLDOWN_MS) return
  await db.version.create({ data: { pageId, title, blocks: JSON.stringify(blocks) } })
  const versions = await db.version.findMany({
    where: { pageId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })
  if (versions.length > MAX_VERSIONS_PER_PAGE) {
    await db.version.deleteMany({ where: { id: { in: versions.slice(MAX_VERSIONS_PER_PAGE).map((v) => v.id) } } })
  }
}

// ---------------------------------------------------------------------------
// Statistiche di scrittura (streak / obiettivo giornaliero)
// ---------------------------------------------------------------------------

/** Data locale del server in formato "YYYY-MM-DD" (app local-first: coincide con l'utente). */
export function localDateString(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Numero di parole del testo di un blocco (l'HTML inline viene ignorato). */
function blockWords(content: string): number {
  const text = content
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
  let words = 0
  for (const w of text.split(/\s+/)) {
    if (w.length > 0) words += 1
  }
  return words
}

/** Totale parole di una pagina (titoli inclusi, blocchi non testuali contano url/caption). */
export function countWordsInBlocks(blocks: Block[]): number {
  let words = 0
  for (const b of blocks) words += blockWords(b.content)
  return words
}

/**
 * Registra lo snapshot parole di una pagina per oggi (upsert su [pageId, date]).
 * Il totale del giorno è la somma degli snapshot delle pagine toccate: se una
 * pagina si accorcia, il suo contributo giornaliero scende di conseguenza.
 */
export async function recordWritingDay(pageId: string, words: number): Promise<void> {
  const date = localDateString()
  const existing = await db.writingDay.findUnique({ where: { pageId_date: { pageId, date } } })
  if (existing && existing.words === words) return
  await db.writingDay.upsert({
    where: { pageId_date: { pageId, date } },
    create: { pageId, date, words },
    update: { words },
  })
}

// ---------------------------------------------------------------------------
// Albero delle pagine
// ---------------------------------------------------------------------------

/** Prossima posizione libera fra i fratelli (cestino incluso): max + 1, 0 se non ci sono fratelli. */
export async function nextSiblingPosition(parentId: string | null): Promise<number> {
  const agg = await db.page.aggregate({ _max: { position: true }, where: { parentId } })
  return (agg._max.position ?? -1) + 1
}

/**
 * Livelli di discendenti di una pagina (BFS): levels[0] = figli,
 * levels[1] = nipoti, … Protegge da cicli dovuti a dati corrotti.
 */
export async function collectDescendantLevels(rootId: string): Promise<string[][]> {
  const levels: string[][] = []
  const seen = new Set<string>([rootId])
  let frontier: string[] = [rootId]
  while (frontier.length > 0) {
    const children = await db.page.findMany({ where: { parentId: { in: frontier } }, select: { id: true } })
    const ids = children.map((c) => c.id).filter((id) => !seen.has(id))
    ids.forEach((id) => seen.add(id))
    if (ids.length === 0) break
    levels.push(ids)
    frontier = ids
  }
  return levels
}
