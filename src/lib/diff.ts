/**
 * Taccuino — differenze tra snapshot di versione e contenuto attuale.
 *
 * Due livelli: LCS sui blocchi (righe) per la struttura, poi diff a parole
 * dentro le righe modificate per l'evidenziazione fine. Tutto locale e
 * senza dipendenze: la cronologia di Notion mostra solo snapshot, qui si
 * vede esattamente cosa è cambiato.
 */
import type { Block } from './types'

// ---------------------------------------------------------------------------
// LCS generico
// ---------------------------------------------------------------------------

export interface LcsOp<T> {
  type: 'same' | 'del' | 'add'
  value: T
}

/**
 * Diff per LCS su array generici. Con input molto grandi (guardia) degrada
 * in "tutto rimosso + tutto aggiunto" per restare reattivo.
 */
export function lcsDiff<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean): LcsOp<T>[] {
  const n = a.length
  const m = b.length
  if (n === 0 && m === 0) return []
  if (n === 0) return b.map((value) => ({ type: 'add', value }) as LcsOp<T>)
  if (m === 0) return a.map((value) => ({ type: 'del', value }) as LcsOp<T>)
  if (n * m > 4_000_000) {
    return [
      ...a.map((value) => ({ type: 'del', value }) as LcsOp<T>),
      ...b.map((value) => ({ type: 'add', value }) as LcsOp<T>),
    ]
  }

  // matrice DP (Uint32 per memoria contenuta)
  const width = m + 1
  const dp = new Uint32Array((n + 1) * width)
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * width + j] = eq(a[i], b[j])
        ? dp[(i + 1) * width + j + 1] + 1
        : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1])
    }
  }

  const ops: LcsOp<T>[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (eq(a[i], b[j])) {
      ops.push({ type: 'same', value: a[i] })
      i += 1
      j += 1
    } else if (dp[(i + 1) * width + j] >= dp[i * width + j + 1]) {
      ops.push({ type: 'del', value: a[i] })
      i += 1
    } else {
      ops.push({ type: 'add', value: b[j] })
      j += 1
    }
  }
  while (i < n) {
    ops.push({ type: 'del', value: a[i] })
    i += 1
  }
  while (j < m) {
    ops.push({ type: 'add', value: b[j] })
    j += 1
  }
  return ops
}

// ---------------------------------------------------------------------------
// Diff dei blocchi
// ---------------------------------------------------------------------------

function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

export interface DiffLine {
  /** Identificativo del tipo di blocco, per l'iconcina. */
  type: Block['type']
  text: string
}

function blockToLine(b: Block): DiffLine {
  const text = plainText(b.content)
  switch (b.type) {
    case 'divider':
      return { type: b.type, text: '———' }
    case 'checklist':
      return { type: b.type, text: `${b.checked ? '☑' : '☐'} ${text}` }
    case 'image':
    case 'bookmark':
      return { type: b.type, text: text || b.url || '' }
    default:
      return { type: b.type, text }
  }
}

export type WordPart = { text: string; changed: 'none' | 'del' | 'add' }

export type DiffRow =
  | { kind: 'same'; line: DiffLine }
  | { kind: 'del'; line: DiffLine }
  | { kind: 'add'; line: DiffLine }
  | { kind: 'mod'; oldLine: DiffLine; newLine: DiffLine; parts: WordPart[] }
  | { kind: 'gap' }

export interface DiffResult {
  rows: DiffRow[]
  wordsAdded: number
  wordsRemoved: number
  identical: boolean
}

const MAX_INLINE_TOKENS = 1200

function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((s) => s.length > 0)
}

function countWords(text: string): number {
  let words = 0
  for (const w of text.split(/\s+/)) if (w.length > 0) words += 1
  return words
}

/** Diff a parole per l'evidenziazione inline dentro una riga modificata. */
function wordParts(oldText: string, newText: string): WordPart[] {
  const oldTokens = tokenize(oldText)
  const newTokens = tokenize(newText)
  if (oldTokens.length * newTokens.length > MAX_INLINE_TOKENS * MAX_INLINE_TOKENS) {
    return [
      { text: oldText, changed: 'del' },
      { text: ' ' },
      { text: newText, changed: 'add' },
    ] as WordPart[]
  }
  const ops = lcsDiff(oldTokens, newTokens, (x, y) => x === y)
  const parts: WordPart[] = []
  for (const op of ops) {
    if (op.type === 'same') {
      parts.push({ text: op.value, changed: 'none' })
    } else if (op.type === 'del') {
      parts.push({ text: op.value, changed: 'del' })
    } else {
      parts.push({ text: op.value, changed: 'add' })
    }
  }
  // fusione delle parti consecutive con lo stesso stato
  const merged: WordPart[] = []
  for (const part of parts) {
    const last = merged[merged.length - 1]
    if (last && last.changed === part.changed) last.text += part.text
    else merged.push({ ...part })
  }
  return merged
}

/** Confronta due liste di blocchi e produce le righe di diff pronte da rendersi. */
export function diffBlocks(oldBlocks: Block[], newBlocks: Block[]): DiffResult {
  const oldLines = oldBlocks.map(blockToLine)
  const newLines = newBlocks.map(blockToLine)
  const ops = lcsDiff(oldLines, newLines, (x, y) => x.text === y.text && x.type === y.type)

  // unisce i del/add adiacenti in righe "mod" appaiate (con diff a parole)
  const rows: DiffRow[] = []
  let wordsAdded = 0
  let wordsRemoved = 0
  let identical = true

  let index = 0
  while (index < ops.length) {
    const op = ops[index]
    if (op.type === 'same') {
      rows.push({ kind: 'same', line: op.value })
      index += 1
      continue
    }
    // run di del seguiti da run di add
    const dels: DiffLine[] = []
    const adds: DiffLine[] = []
    while (index < ops.length && ops[index].type === 'del') {
      dels.push(ops[index].value)
      index += 1
    }
    while (index < ops.length && ops[index].type === 'add') {
      adds.push(ops[index].value)
      index += 1
    }
    identical = false
    const pairs = Math.min(dels.length, adds.length)
    for (let k = 0; k < dels.length; k++) wordsRemoved += countWords(dels[k].text)
    for (let k = 0; k < adds.length; k++) wordsAdded += countWords(adds[k].text)
    for (let k = 0; k < pairs; k++) {
      rows.push({ kind: 'mod', oldLine: dels[k], newLine: adds[k], parts: wordParts(dels[k].text, adds[k].text) })
    }
    for (let k = pairs; k < dels.length; k++) {
      rows.push({ kind: 'del', line: dels[k] })
    }
    for (let k = pairs; k < adds.length; k++) {
      rows.push({ kind: 'add', line: adds[k] })
    }
  }

  // comprime le righe invariate lunghe in "gap"
  const compact: DiffRow[] = []
  let run = 0
  for (const row of rows) {
    if (row.kind === 'same') {
      run += 1
      if (run <= 3) compact.push(row)
      else if (run === 4) compact.push({ kind: 'gap' })
      // oltre la quarta riga uguale si salta: il gap è già stato emesso
    } else {
      run = 0
      compact.push(row)
    }
  }
  if (compact[compact.length - 1]?.kind === 'gap') compact.pop()

  return { rows: compact, wordsAdded, wordsRemoved, identical }
}
