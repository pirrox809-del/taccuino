/**
 * Taccuino — tipi condivisi tra frontend e backend.
 * Contratto unico per pagine, blocchi, database, versioni e risultati di ricerca.
 */

export type BlockType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bullet'
  | 'numbered'
  | 'checklist'
  | 'quote'
  | 'code'
  | 'divider'
  | 'callout'
  | 'image'
  | 'bookmark'

export const BLOCK_TYPES: BlockType[] = [
  'paragraph',
  'heading1',
  'heading2',
  'heading3',
  'bullet',
  'numbered',
  'checklist',
  'quote',
  'code',
  'divider',
  'callout',
  'image',
  'bookmark',
]

/**
 * Un blocco del documento.
 * - content: frammento HTML (formattazione inline) per i blocchi di testo,
 *   testo semplice per `code`, vuoto per `divider`.
 * - url: immagine o segnalibro.
 * - indent: livello di rientro 0–4.
 * - I link ad altre pagine sono <a data-page-id="..."> dentro content.
 */
export interface Block {
  id: string
  type: BlockType
  content: string
  checked?: boolean
  language?: string
  url?: string
  caption?: string
  icon?: string
  indent?: number
}

/** Tipo di pagina: documento a blocchi oppure database. */
export type PageKind = 'doc' | 'database'

/** Metadati di una pagina (senza blocchi/righe). */
export interface PageMeta {
  id: string
  parentId: string | null
  title: string
  icon: string | null
  position: number
  isFavorite: boolean
  kind: PageKind
  /** Copertina: "gradient:<nome>" oppure URL (/api/attachments/...). */
  cover: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

/** Pagina con i suoi blocchi. */
export interface PageWithBlocks extends PageMeta {
  blocks: Block[]
}

// ---------------------------------------------------------------------------
// Database semplici
// ---------------------------------------------------------------------------

export type PropertyType = 'text' | 'number' | 'select' | 'date' | 'checkbox' | 'url'

export const PROPERTY_TYPES: PropertyType[] = [
  'text',
  'number',
  'select',
  'date',
  'checkbox',
  'url',
]

/** Chiave di colore di un'opzione di selezione (palette condivisa). */
export type SelectColor =
  | 'gray'
  | 'brown'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'teal'
  | 'violet'
  | 'pink'

export const SELECT_COLORS: SelectColor[] = [
  'gray',
  'brown',
  'orange',
  'yellow',
  'green',
  'teal',
  'violet',
  'pink',
]

export interface SelectOption {
  id: string
  label: string
  color: SelectColor
}

/** Una proprietà dello schema del database. */
export interface DatabaseProperty {
  id: string
  name: string
  type: PropertyType
  /** Solo per type === 'select'. */
  options?: SelectOption[]
}

/** Valore di una cella: stringa per text/select/date/url, numero, booleano o null. */
export type PropertyValue = string | number | boolean | null

/** Proprietà di una riga, indicizzate per id di proprietà. */
export type RowProperties = Record<string, PropertyValue>

/** Una riga di database. */
export interface DatabaseRow {
  id: string
  title: string
  icon: string | null
  properties: RowProperties
  position: number
}

/** Schema del database (proprietà) salvato accanto alla pagina. */
export interface DatabaseInfo {
  properties: DatabaseProperty[]
}

/** Vista del database. */
export type DatabaseViewKind = 'table' | 'kanban'

/** Voce dell'elenco versioni. */
export interface VersionMeta {
  id: string
  title: string
  blockCount: number
  createdAt: string
}

/** Risultato di ricerca full-text. */
export interface SearchHit {
  pageId: string
  title: string
  icon: string | null
  snippet: string
  updatedAt: string
  /** true se il risultato è una riga di database (pageId = pagina del database). */
  isRow?: boolean
  rowId?: string
}

export interface SearchResponse {
  results: SearchHit[]
  query: string
}

/** Pagina che rimanda alla pagina corrente tramite link [[...]]. */
export interface BacklinkHit {
  pageId: string
  title: string
  icon: string | null
  snippet: string
}
