/**
 * Taccuino — CSV per i database semplici (server-side).
 *
 * - parseCsv: parser RFC-4180-like (virgolette, virgole e newline interni).
 * - csvToDatabase: CSV (stile export Notion) → schema proprietà + righe,
 *   con inferenza dei tipi (numero, data ISO, casella, altrimenti testo).
 * - databaseToCsv: schema + righe → CSV con BOM per Excel/LibreOffice.
 */
import {
  DatabaseProperty,
  DatabaseRow,
  PropertyValue,
  RowProperties,
  SelectColor,
} from '@/lib/types'
import { HttpError } from '@/lib/blocks-db'

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/** Parser CSV tollerante: gestisce campi tra virgolette con virgole e newline interni. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  const src = text.replace(/^\uFEFF/, '')

  const pushField = () => {
    row.push(field)
    field = ''
  }
  const pushRow = () => {
    pushField()
    // scarta righe composte da sole celle vuote
    if (row.some((cell) => cell.trim() !== '')) rows.push(row)
    row = []
  }

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      pushField()
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      pushRow()
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length > 0) pushRow()
  return rows
}

// ---------------------------------------------------------------------------
// Inferenza tipi (import Notion)
// ---------------------------------------------------------------------------

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/
const TRUTHY = new Set(['true', 'sì', 'si', 'yes', '✓', 'x', 'v'])
const FALSY = new Set(['false', 'no', ''])

function normalizeCell(value: string): string {
  return value.trim()
}

function inferColumnType(values: string[]): 'number' | 'date' | 'checkbox' | 'text' | 'url' {
  const cells = values.map(normalizeCell).filter((v) => v !== '')
  if (cells.length === 0) return 'text'
  if (cells.every((v) => v !== '' && Number.isFinite(Number(v.replace(',', '.'))))) return 'number'
  if (cells.every((v) => ISO_DATE_RE.test(v))) return 'date'
  if (cells.every((v) => TRUTHY.has(v.toLowerCase()) || FALSY.has(v.toLowerCase()))) return 'checkbox'
  if (cells.every((v) => /^(https?:\/\/\S+)$/.test(v))) return 'url'
  // cardinalità bassa → buon candidato per una selezione
  const distinct = new Set(cells.map((v) => v.toLowerCase()))
  if (distinct.size > 0 && distinct.size <= Math.max(4, Math.ceil(cells.length / 3)) && distinct.size < cells.length) {
    return 'text' // resta testo: la vista kanban usa le proprietà select create dall'utente
  }
  return 'text'
}

function slugId(name: string, used: Set<string>): string {
  let base = name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
  if (base === '') base = 'prop'
  let id = base
  let n = 2
  while (used.has(id)) {
    id = `${base}-${n}`
    n++
  }
  used.add(id)
  return id
}

const SELECT_COLORS_CYCLE: SelectColor[] = ['gray', 'brown', 'orange', 'yellow', 'green', 'teal', 'violet', 'pink']

export interface CsvDatabase {
  properties: DatabaseProperty[]
  rows: Array<{ title: string; properties: RowProperties }>
}

/**
 * Converte una tabella CSV in schema + righe di database.
 * La prima colonna è il titolo ("Nome"); le altre diventano proprietà.
 * Righe: minimo 0 dati; colonne: minimo 1.
 */
export function csvToDatabase(text: string): CsvDatabase {
  const table = parseCsv(text)
  if (table.length === 0 || table[0].length === 0) {
    throw new HttpError(400, 'CSV vuoto o non leggibile')
  }
  const header = table[0].map(normalizeCell)
  const body = table.slice(1)

  const usedIds = new Set<string>()
  const properties: DatabaseProperty[] = []
  const columnTypes: Array<'number' | 'date' | 'checkbox' | 'text' | 'url'> = []

  for (let c = 1; c < header.length; c++) {
    const name = header[c] !== '' ? header[c] : `Colonna ${c + 1}`
    const values = body.map((r) => r[c] ?? '')
    const type = inferColumnType(values)
    columnTypes.push(type)
    const id = slugId(name, usedIds)
    properties.push({ id, name: name.slice(0, 200), type })
  }

  const rows = body.map((r) => {
    const propertiesForRow: RowProperties = {}
    for (let c = 1; c < header.length; c++) {
      const raw = normalizeCell(r[c] ?? '')
      const prop = properties[c - 1]
      if (raw === '') {
        propertiesForRow[prop.id] = null
        continue
      }
      let value: PropertyValue = raw
      if (prop.type === 'number') value = Number(raw.replace(',', '.'))
      else if (prop.type === 'checkbox') value = TRUTHY.has(raw.toLowerCase())
      else value = raw.slice(0, 2000)
      propertiesForRow[prop.id] = value
    }
    return { title: normalizeCell(r[0] ?? '').slice(0, 500), properties: propertiesForRow }
  })

  return { properties, rows }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function valueToCell(value: PropertyValue | undefined): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Sì' : 'No'
  return String(value)
}

/** Genera il CSV di un database (prima colonna "Nome", poi le proprietà). */
export function databaseToCsv(properties: DatabaseProperty[], rows: DatabaseRow[]): string {
  const lines: string[] = []
  lines.push(['Nome', ...properties.map((p) => csvEscape(p.name))].join(','))
  for (const row of rows) {
    const cells = [csvEscape(row.title)]
    for (const p of properties) {
      const value = row.properties[p.id]
      let cell = valueToCell(value)
      if (p.type === 'select' && typeof value === 'string') {
        const option = p.options?.find((o) => o.id === value)
        if (option) cell = option.label
      }
      cells.push(csvEscape(cell))
    }
    lines.push(cells.join(','))
  }
  return '\uFEFF' + lines.join('\r\n')
}

/** Colore deterministico per le opzioni generate durante l'import. */
export function cycleColor(index: number): SelectColor {
  return SELECT_COLORS_CYCLE[index % SELECT_COLORS_CYCLE.length]
}
