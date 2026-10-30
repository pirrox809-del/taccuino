'use client'

/**
 * Taccuino — helper DOM per caret, selezione e conversioni di contenuto.
 * Tutte le funzioni girano solo nel browser (chiamate da gestori d'evento).
 */
import type { BlockType } from '@/lib/types'

/** Colloca il caret (collassato) all'inizio o alla fine del contenuto di `el`. */
export function placeCaret(el: HTMLElement, where: 'start' | 'end'): void {
  const sel = window.getSelection()
  if (!sel) return
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(where === 'start')
  sel.removeAllRanges()
  sel.addRange(range)
}

/**
 * Vero se la selezione è collassata e il caret si trova all'inizio assoluto
 * del contenuto di `el`. Il confronto avviene fra il range attuale e un range
 * che seleziona tutto il contenuto (via testo stringificato).
 */
export function isCaretAtStart(el: HTMLElement): boolean {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false
  const range = sel.getRangeAt(0)
  if (!el.contains(range.startContainer)) return false
  const probe = document.createRange()
  probe.selectNodeContents(el)
  try {
    probe.setEnd(range.startContainer, range.startOffset)
  } catch {
    return false
  }
  return probe.toString().length === 0
}

/** Vero se la selezione è collassata e il caret è alla fine assoluta di `el`. */
export function isCaretAtEnd(el: HTMLElement): boolean {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false
  const range = sel.getRangeAt(0)
  if (!el.contains(range.endContainer)) return false
  const probe = document.createRange()
  probe.selectNodeContents(el)
  try {
    probe.setStart(range.endContainer, range.endOffset)
  } catch {
    return false
  }
  return probe.toString().length === 0
}

/** Offset (in caratteri di testo) del caret dentro `el`, oppure -1. */
export function getCaretTextOffset(el: HTMLElement): number {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return -1
  const range = sel.getRangeAt(0)
  if (!el.contains(range.startContainer)) return -1
  const probe = document.createRange()
  probe.selectNodeContents(el)
  try {
    probe.setEnd(range.startContainer, range.startOffset)
  } catch {
    return -1
  }
  return probe.toString().length
}

/**
 * Range che copre i caratteri di testo [start, end) dentro `el`.
 * Se gli offset eccedono il testo disponibile, il range collassa a fine elemento.
 */
export function createRangeFromTextOffsets(el: HTMLElement, start: number, end: number): Range {
  const range = document.createRange()
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let remainingStart = Math.max(0, start)
  let remainingEnd = Math.max(remainingStart, end)
  let pos = 0
  let node = walker.nextNode() as Text | null
  let startSet = false
  let endSet = false
  while (node) {
    const len = node.data.length
    if (!startSet && remainingStart <= pos + len) {
      range.setStart(node, remainingStart - pos)
      startSet = true
    }
    if (!endSet && remainingEnd <= pos + len) {
      range.setEnd(node, remainingEnd - pos)
      endSet = true
      break
    }
    pos += len
    node = walker.nextNode() as Text | null
  }
  if (!startSet) range.setStart(el, el.childNodes.length)
  if (!endSet) range.setEnd(el, el.childNodes.length)
  return range
}

/** Colloca il caret a un preciso offset di testo dentro `el`. */
export function placeCaretAtTextOffset(el: HTMLElement, offset: number): void {
  const sel = window.getSelection()
  if (!sel) return
  const range = createRangeFromTextOffsets(el, offset, offset)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
}

/**
 * Ancora visiva del caret per posizionare i menu. Se il rect del range è
 * degenere (elemento vuoto), ricade sul bounding rect dell'elemento.
 */
export function caretAnchor(el: HTMLElement): { left: number; bottom: number; top: number } {
  const sel = window.getSelection()
  if (sel && sel.rangeCount > 0) {
    const rect = sel.getRangeAt(0).getBoundingClientRect()
    if (rect && (rect.height > 0 || rect.top > 0 || rect.left > 0)) {
      return { left: rect.left, bottom: rect.bottom, top: rect.top }
    }
  }
  const r = el.getBoundingClientRect()
  return { left: r.left, bottom: r.bottom, top: r.top }
}

/** Vero se un frammento HTML è visivamente vuoto (nessun testo, solo tag/br). */
export function isEmptyContent(html: string): boolean {
  if (!html) return true
  return html
    .replace(/<br\s*\/?>/gi, '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .trim().length === 0
}

/** Aggiorna `data-empty` su un editabile in base al suo contenuto testuale. */
export function updateEmptyState(el: HTMLElement): void {
  const hasText = !!el.textContent && el.textContent.length > 0
  el.dataset.empty = hasText ? 'false' : 'true'
}

/**
 * Divide il contenuto di `el` al caret (collassato) in due frammenti HTML:
 * `before` = dall'inizio al caret, `after` = dal caret alla fine.
 * Se non c'è una selezione valida dentro `el`, tutto il contenuto va in `before`.
 */
export function splitContentAtCaret(el: HTMLElement): { before: string; after: string } {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return { before: el.innerHTML, after: '' }
  const range = sel.getRangeAt(0)
  if (!el.contains(range.startContainer)) return { before: el.innerHTML, after: '' }
  const beforeRange = document.createRange()
  beforeRange.selectNodeContents(el)
  beforeRange.setEnd(range.startContainer, range.startOffset)
  const afterRange = document.createRange()
  // NB: mai usare selectNodeContents qui dopo setStart: azzererebbe lo start
  // appena impostato. Il range "after" va dal caret alla fine dell'elemento.
  afterRange.setStart(range.endContainer, range.endOffset)
  afterRange.setEnd(el, el.childNodes.length)
  const fragmentToHtml = (frag: DocumentFragment): string => {
    const holder = document.createElement('div')
    holder.appendChild(frag)
    return holder.innerHTML
  }
  return {
    before: fragmentToHtml(beforeRange.cloneContents()),
    after: fragmentToHtml(afterRange.cloneContents()),
  }
}

/**
 * Porta il focus su un contenitore editabile (contenteditable o textarea)
 * all'inizio o alla fine del contenuto, con scrollIntoView non invasivo.
 */
export function focusEditable(el: HTMLElement, where: 'start' | 'end'): void {
  el.focus()
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    const pos = where === 'end' ? el.value.length : 0
    el.setSelectionRange(pos, pos)
  } else {
    placeCaret(el, where)
  }
  el.scrollIntoView({ block: 'nearest' })
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** HTML → testo semplice (per conversioni verso blocchi code). */
export function htmlToPlainText(html: string): string {
  if (!html) return ''
  const holder = document.createElement('div')
  holder.innerHTML = html
  return holder.textContent ?? ''
}

/**
 * Conversione del contenuto quando cambia il tipo di blocco.
 * - verso `code`: strip dell'HTML in testo semplice;
 * - da `code`: escape delle entità;
 * - verso divider/image/bookmark: contenuto azzerato;
 * - altrimenti: invariato.
 */
export function convertContent(from: BlockType, to: BlockType, content: string): string {
  if (to === 'code') return htmlToPlainText(content)
  if (from === 'code') return escapeHtml(content)
  if (to === 'divider' || to === 'image' || to === 'bookmark') return ''
  return content
}

/** Generatore di id per i blocchi (con fallback per contesti senza randomUUID). */
export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
