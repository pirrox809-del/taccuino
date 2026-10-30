'use client'

/**
 * Taccuino — contratto interno dell'editor a blocchi.
 *
 * `EditorApi` è l'oggetto (di identità costante) che PageEditor passa a ogni
 * BlockItem: contiene le operazioni strutturali e i gestori d'evento dei
 * blocchi. Essendo stabile non invalida mai React.memo, quindi la lista si
 * ri-renderizza solo per operazioni strutturali, mai a ogni keystroke.
 */
import type { Block, BlockType } from '@/lib/types'
import type { TranslationKey } from '@/lib/i18n'
import type {
  ClipboardEvent as ReactClipboardEvent,
  KeyboardEvent as ReactKeyboardEvent,
} from 'react'

/** Tipi di blocco con testo editabile (contenteditable con HTML inline). */
export const TEXT_TYPES = [
  'paragraph',
  'heading1',
  'heading2',
  'heading3',
  'bullet',
  'numbered',
  'checklist',
  'quote',
  'callout',
] as const satisfies readonly BlockType[]

export type TextBlockType = (typeof TEXT_TYPES)[number]

export function isTextType(type: BlockType): boolean {
  return (TEXT_TYPES as readonly BlockType[]).includes(type)
}

export interface DropTarget {
  id: string
  pos: 'before' | 'after'
}

/** Stato di caricamento di un blocco immagine (spinner / errore in card). */
export interface ImageStatus {
  uploading: boolean
  error?: TranslationKey
}

/** Come posizionare il blocco immagine risultante da un upload. */
export type ImagePlacement = 'self' | 'after' | 'card'

export interface EditorApi {
  updateBlock(id: string, patch: Partial<Block>): void
  /** Registro degli elementi editabili, per il focus senza rimontaggi. */
  registerRef(id: string, el: HTMLElement | null): void
  focusBlock(id: string, where: 'start' | 'end'): void
  /**
   * Inserisce un blocco dopo `afterId` e di default lo focalizza.
   * `afterId === null` inserisce in testa; se l'id non esiste, in coda.
   */
  insertAfter(afterId: string | null, init?: Partial<Block>, opts?: { focus?: boolean }): string
  duplicateBlock(id: string): void
  removeBlock(id: string): void
  moveBlock(id: string, dir: -1 | 1): void
  dropBlock(sourceId: string, targetId: string, pos: 'before' | 'after'): void
  dragStart(id: string): void
  dragEnd(): void
  setDrop(target: DropTarget | null): void
  toggleCheck(id: string): void
  /** Escape da un code block: focus al successivo (crea paragraph se serve). */
  escapeCode(id: string): void
  /** Backspace all'inizio di un code block: converte in paragraph (testo escapato). */
  convertFromCode(id: string): void
  /** Focus al blocco testuale precedente/successivo (salta divider/image/bookmark). */
  focusSiblingText(id: string, dir: -1 | 1): boolean
  /** Upload di un'immagine: valida, carica su /api/attachments e applica l'URL. */
  uploadImage(file: File, blockId: string | null, placement: ImagePlacement): void
  handleInput(el: HTMLDivElement, block: Block): void
  handleKeyDown(e: ReactKeyboardEvent<HTMLElement>, block: Block, el: HTMLElement): void
  handlePaste(e: ReactClipboardEvent<HTMLElement>, block: Block, el: HTMLElement): void
  handleCaptionKeyDown(e: ReactKeyboardEvent<HTMLDivElement>, block: Block): void
  handleBlur(block: Block): void
}
