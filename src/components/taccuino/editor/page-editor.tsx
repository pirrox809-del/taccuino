'use client'

/**
 * Taccuino — editor a blocchi (PageEditor).
 *
 * Architettura stato (critica per le prestazioni):
 * - `blocksRef.current` è la fonte di verità SEMPRE fresca; lo state `blocks`
 *   serve solo da trigger di render per le operazioni strutturali
 *   (add/delete/move/type-change/checked/url/…). Un keystroke su un blocco
 *   testuale NON causa render: `updateBlock` sostituisce solo quell'oggetto
 *   nel ref e notifica `onChange`.
 * - Ogni blocco è un `BlockItem` React.memo: riceve props stabili, quindi la
 *   lista non si ri-renderizza mai a ogni battitura.
 * - I blocchi testuali sono `div[contenteditable]` non controllati: l'innerHTML
 *   viene scritto imperativamente solo a mount, al cambio tipo, o quando la
 *   prop diverge dal DOM con elemento non focalizzato (mai durante la digitazione).
 * - `pendingFocus` applica il focus dopo il commit, quando i nuovi elementi si
 *   sono già registrati nel registry degli editabili.
 */
import * as React from 'react'
import { useI18n } from '@/lib/i18n'
import type { Block, BlockType } from '@/lib/types'
import { BlockItem } from './block-item'
import { FormatToolbar } from './format-toolbar'
import { SlashMenu } from './slash-menu'
import { PageLinkPicker } from './page-link-picker'
import type { DropTarget, EditorApi, ImagePlacement, ImageStatus } from './editor-api'
import { isTextType } from './editor-api'
import {
  caretAnchor,
  convertContent,
  createRangeFromTextOffsets,
  escapeHtml,
  focusEditable,
  getCaretTextOffset,
  isEmptyContent,
  isCaretAtEnd,
  isCaretAtStart,
  splitContentAtCaret,
  uid,
  updateEmptyState,
} from './dom'
import { uploadImageFile, validateImageFile } from './upload'

export { EmojiPicker } from './emoji-picker'

export interface PageEditorProps {
  pageId: string
  initialBlocks: Block[]
  /** incrementa per forzare il ricaricamento da initialBlocks */
  resetSignal?: number
  /** scatta a OGNI modifica con l'array completo (il parent fa il debounce di rete) */
  onChange: (blocks: Block[]) => void
  /** apertura di una pagina collegata via [[...]] (click su a[data-page-id]) */
  onOpenPage?: (pageId: string) => void
  /** modalità focus: scorrimento “macchina da scrivere” (caret centrato) */
  typewriter?: boolean
}

interface SlashState {
  blockId: string
  anchor: { left: number; bottom: number; top: number }
}

interface LinkPickerState {
  blockId: string
  anchor: { left: number; bottom: number; top: number }
  /** offset di testo dell'inizio di "[[..." e del caret nel blocco */
  from: number
  to: number
}

interface MarkdownHit {
  type: BlockType
  prefixLen: number
}

/** Query del menu "/": il testo dallo slash al caret, con slash a inizio blocco o dopo spazio. */
const SLASH_QUERY_RE = /(?:^|\s)\/(\S*)$/

/** Query del picker "[[": la sequenza "[[" seguita da testo (senza parentesse) fino al caret. */
const LINK_QUERY_RE = /\[\[([^\[\]]*)$/

const MARKDOWN_RULES: Array<[RegExp, BlockType]> = [
  [/^###\s/, 'heading3'],
  [/^##\s/, 'heading2'],
  [/^#\s/, 'heading1'],
  [/^[-*]\s/, 'bullet'],
  [/^\d+\.\s/, 'numbered'],
  [/^\[[ xX]\]\s/, 'checklist'],
  [/^\[\]\s/, 'checklist'],
  [/^>\s/, 'quote'],
]

const PLACEHOLDER_CSS = `
[data-editable]{position:relative}
[data-editable][data-empty='true']:before{content:attr(data-placeholder);color:var(--muted-foreground);pointer-events:none;position:absolute}
`

/** La pagina ha SEMPRE almeno un blocco. */
function normalizeBlocks(blocks: Block[]): Block[] {
  const copy = blocks.map((b) => ({ ...b }))
  if (copy.length === 0) return [{ id: uid(), type: 'paragraph', content: '' }]
  return copy
}

/** Patch standard per una conversione di tipo: pulisce i campi non pertinenti. */
function conversionPatch(type: BlockType, content: string): Partial<Block> {
  return {
    type,
    content,
    checked: type === 'checklist' ? false : undefined,
    language: undefined,
    url: undefined,
    caption: undefined,
    icon: undefined,
  }
}

export function PageEditor({ pageId, initialBlocks, resetSignal = 0, onChange, onOpenPage, typewriter = false }: PageEditorProps) {
  const { t } = useI18n()
  const onChangeRef = React.useRef(onChange)
  React.useLayoutEffect(() => {
    onChangeRef.current = onChange
  })
  const onOpenPageRef = React.useRef(onOpenPage)
  React.useLayoutEffect(() => {
    onOpenPageRef.current = onOpenPage
  })
  // fallback localizzato per il titolo del link ("Senza titolo")
  const untitledRef = React.useRef(t('untitled'))
  React.useLayoutEffect(() => {
    untitledRef.current = t('untitled')
  })

  const [blocks, setBlocks] = React.useState<Block[]>(() => normalizeBlocks(initialBlocks))
  const blocksRef = React.useRef<Block[]>(blocks)
  const editableRefs = React.useRef(new Map<string, HTMLElement>())
  const pendingFocusRef = React.useRef<{ id: string; where: 'start' | 'end' } | null>(null)
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const slashBlockRef = React.useRef<string | null>(null)
  const linkBlockRef = React.useRef<string | null>(null)
  const dropTargetRef = React.useRef<DropTarget | null>(null)
  const draggingIdRef = React.useRef<string | null>(null)

  const [slash, setSlash] = React.useState<SlashState | null>(null)
  const [slashQuery, setSlashQuery] = React.useState('')
  const [linkPicker, setLinkPicker] = React.useState<LinkPickerState | null>(null)
  const linkPickerRef = React.useRef<LinkPickerState | null>(null)
  React.useLayoutEffect(() => {
    linkPickerRef.current = linkPicker
  }, [linkPicker])
  /** Sequenza [[ già chiusa senza inserimento: non riapre finché resta identica. */
  const linkDismissedRef = React.useRef<{ blockId: string; from: number } | null>(null)
  const [dropTarget, setDropTarget] = React.useState<DropTarget | null>(null)
  const [imageStatus, setImageStatus] = React.useState<Record<string, ImageStatus>>({})
  const [resetKey, setResetKey] = React.useState(0)

  // --- Reset: cambio pageId o resetSignal → ricarica da initialBlocks e rimonta la lista.
  // In useLayoutEffect (sincrono, prima del paint): nessun flash del contenuto vecchio.
  const pageKey = `${pageId}:${resetSignal}`
  const pageKeyRef = React.useRef(pageKey)
  React.useLayoutEffect(() => {
    if (pageKeyRef.current === pageKey) return
    pageKeyRef.current = pageKey
    const next = normalizeBlocks(initialBlocks)
    blocksRef.current = next
    setBlocks(next)
    setResetKey((k) => k + 1)
    setSlash(null)
    slashBlockRef.current = null
    setSlashQuery('')
    setLinkPicker(null)
    linkBlockRef.current = null
    linkDismissedRef.current = null
    setDropTarget(null)
    dropTargetRef.current = null
    setImageStatus({})
    pendingFocusRef.current = null
    editableRefs.current.clear()
  }, [pageKey, initialBlocks])

  // Focus posticipato: scatta dopo che i nuovi blocchi hanno registrato i loro elementi.
  React.useLayoutEffect(() => {
    const p = pendingFocusRef.current
    if (!p) return
    pendingFocusRef.current = null
    const el = editableRefs.current.get(p.id)
    if (el) focusEditable(el, p.where)
  }, [blocks])

  // --- Typewriter (modalità focus): mantiene il caret nella fascia centrale
  // dello schermo scorrendo il contenitore della pagina. ---
  React.useEffect(() => {
    if (!typewriter) return
    let raf = 0
    const keepCentered = () => {
      raf = 0
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return
      const anchor = sel.anchorNode
      if (!anchor) return
      const el =
        anchor.nodeType === Node.ELEMENT_NODE ? (anchor as Element) : anchor.parentElement
      if (!el || !containerRef.current?.contains(el)) return
      const rect = sel.getRangeAt(0).getBoundingClientRect()
      const top = rect.height > 0 || rect.top !== 0 ? rect.top : el.getBoundingClientRect().top
      const vh = window.innerHeight
      // fascia comoda: 25%–60% dell'altezza; fuori si riallinea al 40%
      if (top > vh * 0.25 && top < vh * 0.6) return
      const delta = top - vh * 0.4
      let cur: HTMLElement | null = el
      while (cur && cur !== document.body) {
        const style = window.getComputedStyle(cur)
        const overflowY = style.overflowY
        if ((overflowY === 'auto' || overflowY === 'scroll') && cur.scrollHeight > cur.clientHeight) {
          cur.scrollBy({ top: delta, behavior: 'smooth' })
          return
        }
        cur = cur.parentElement
      }
    }
    const onSelectionChange = () => {
      if (raf === 0) raf = requestAnimationFrame(keepCentered)
    }
    document.addEventListener('selectionchange', onSelectionChange)
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange)
      if (raf !== 0) cancelAnimationFrame(raf)
    }
  }, [typewriter])

  // Numerazione degli elenchi: conta i `numbered` consecutivi, reset al primo non-numbered.
  const numbers = React.useMemo(() => {
    const map = new Map<string, number>()
    let n = 0
    for (const b of blocks) {
      if (b.type === 'numbered') {
        n += 1
        map.set(b.id, n)
      } else {
        n = 0
      }
    }
    return map
  }, [blocks])

  // ---------------------------------------------------------------------------
  // API stabile passata a ogni blocco (identità costante → React.memo intatta)
  // ---------------------------------------------------------------------------
  const editor = React.useMemo(() => {
    const findById = (id: string): Block | null => {
      return blocksRef.current.find((b) => b.id === id) ?? null
    }

    /** Commit strutturale: aggiorna ref, triggera il render e notifica il parent. */
    const commit = (next: Block[]): void => {
      blocksRef.current = next
      setBlocks(next)
      onChangeRef.current([...next])
    }

    const updateBlock = (id: string, patch: Partial<Block>): void => {
      const arr = blocksRef.current
      const idx = arr.findIndex((b) => b.id === id)
      if (idx === -1) return
      const keys = Object.keys(patch)
      if (keys.length === 0) return
      const next = arr.slice()
      next[idx] = { ...arr[idx], ...patch }
      blocksRef.current = next
      // Il puro contenuto dei blocchi testuali (non code) non richiede render:
      // gli editabili non sono controllati e dataset.empty è gestito in onInput.
      const contentOnly =
        keys.every((k) => k === 'content' || k === 'caption') && arr[idx].type !== 'code'
      if (!contentOnly) setBlocks(next)
      onChangeRef.current([...next])
    }

    const registerRef = (id: string, el: HTMLElement | null): void => {
      if (el) editableRefs.current.set(id, el)
      else editableRefs.current.delete(id)
    }

    const focusBlock = (id: string, where: 'start' | 'end'): void => {
      const el = editableRefs.current.get(id)
      if (el) focusEditable(el, where)
    }

    const focusSiblingText = (id: string, dir: -1 | 1): boolean => {
      const arr = blocksRef.current
      const idx = arr.findIndex((b) => b.id === id)
      if (idx === -1) return false
      for (let i = idx + dir; i >= 0 && i < arr.length; i += dir) {
        const b = arr[i]
        if (isTextType(b.type) || b.type === 'code') {
          focusBlock(b.id, dir === -1 ? 'end' : 'start')
          return true
        }
        // divider / image / bookmark: saltati
      }
      return false
    }

    const insertAfter = (
      afterId: string | null,
      init: Partial<Block> = {},
      opts: { focus?: boolean } = {}
    ): string => {
      const nb: Block = { id: uid(), type: 'paragraph', content: '', ...init }
      const next = blocksRef.current.slice()
      let idx = next.length
      if (afterId === null) {
        idx = 0
      } else {
        const i = next.findIndex((b) => b.id === afterId)
        idx = i === -1 ? next.length : i + 1
      }
      next.splice(idx, 0, nb)
      if (opts.focus !== false) pendingFocusRef.current = { id: nb.id, where: 'start' }
      commit(next)
      return nb.id
    }

    const duplicateBlock = (id: string): void => {
      const arr = blocksRef.current
      const idx = arr.findIndex((b) => b.id === id)
      if (idx === -1) return
      const next = arr.slice()
      next.splice(idx + 1, 0, { ...arr[idx], id: uid() })
      commit(next)
    }

    const removeBlock = (id: string): void => {
      const arr = blocksRef.current
      const idx = arr.findIndex((b) => b.id === id)
      if (idx === -1) return
      let next = arr.filter((b) => b.id !== id)
      if (next.length === 0) next = [{ id: uid(), type: 'paragraph', content: '' }]
      const target = next[idx] ?? next[next.length - 1]
      if (target && (isTextType(target.type) || target.type === 'code')) {
        pendingFocusRef.current = { id: target.id, where: 'start' }
      }
      commit(next)
      clearImageStatus(id)
    }

    const moveBlock = (id: string, dir: -1 | 1): void => {
      const arr = blocksRef.current
      const idx = arr.findIndex((b) => b.id === id)
      const j = idx + dir
      if (idx === -1 || j < 0 || j >= arr.length) return
      const next = arr.slice()
      const [moved] = next.splice(idx, 1)
      next.splice(j, 0, moved)
      commit(next)
    }

    const dropBlock = (sourceId: string, targetId: string, pos: 'before' | 'after'): void => {
      const arr = blocksRef.current
      const s = arr.findIndex((b) => b.id === sourceId)
      if (s === -1) return
      const next = arr.slice()
      const [moved] = next.splice(s, 1)
      let t = next.findIndex((b) => b.id === targetId)
      if (t === -1) return
      if (pos === 'after') t += 1
      next.splice(t, 0, moved)
      commit(next)
    }

    const dragStart = (id: string): void => {
      draggingIdRef.current = id
      containerRef.current
        ?.querySelector(`[data-block-id="${id}"]`)
        ?.classList.add('opacity-40')
    }

    const dragEnd = (): void => {
      const id = draggingIdRef.current
      draggingIdRef.current = null
      if (id) {
        containerRef.current
          ?.querySelector(`[data-block-id="${id}"]`)
          ?.classList.remove('opacity-40')
      }
      dropTargetRef.current = null
      setDropTarget(null)
    }

    const setDrop = (target: DropTarget | null): void => {
      const cur = dropTargetRef.current
      if (cur && target && cur.id === target.id && cur.pos === target.pos) return
      if (!cur && !target) return
      dropTargetRef.current = target
      setDropTarget(target)
    }

    const toggleCheck = (id: string): void => {
      const b = findById(id)
      if (!b || b.type !== 'checklist') return
      updateBlock(id, { checked: !(b.checked ?? false) })
    }

    const escapeCode = (id: string): void => {
      const arr = blocksRef.current
      const idx = arr.findIndex((b) => b.id === id)
      if (idx === -1) return
      for (let i = idx + 1; i < arr.length; i++) {
        if (isTextType(arr[i].type) || arr[i].type === 'code') {
          focusBlock(arr[i].id, 'start')
          return
        }
      }
      insertAfter(id, { type: 'paragraph', content: '' })
    }

    const convertFromCode = (id: string): void => {
      const b = findById(id)
      if (!b || b.type !== 'code') return
      pendingFocusRef.current = { id, where: 'start' }
      updateBlock(id, conversionPatch('paragraph', escapeHtml(b.content)))
    }

    // ---- upload immagini ----

    const clearImageStatus = (id: string): void => {
      setImageStatus((s) => {
        if (!(id in s)) return s
        const n = { ...s }
        delete n[id]
        return n
      })
    }

    const doUpload = async (file: File, id: string): Promise<void> => {
      try {
        const url = await uploadImageFile(file)
        updateBlock(id, { url })
      } catch {
        setImageStatus((s) => ({ ...s, [id]: { uploading: false, error: 'imageUploadFailed' } }))
        return
      }
      clearImageStatus(id)
    }

    const uploadImage = (file: File, blockId: string | null, placement: ImagePlacement): void => {
      const targetId = blockId ?? ''
      const invalid = validateImageFile(file)
      if (invalid) {
        // gli errori di validazione sono mostrati solo nella card del blocco immagine
        if (placement === 'card' && targetId) {
          setImageStatus((s) => ({ ...s, [targetId]: { uploading: false, error: invalid } }))
        }
        return
      }
      if (!targetId) return
      if (placement === 'after') {
        const id = insertAfter(targetId, { type: 'image', content: '' }, { focus: false })
        setImageStatus((s) => ({ ...s, [id]: { uploading: true } }))
        void doUpload(file, id)
        return
      }
      if (placement === 'self') {
        updateBlock(targetId, conversionPatch('image', ''))
        setImageStatus((s) => ({ ...s, [targetId]: { uploading: true } }))
        void doUpload(file, targetId)
        return
      }
      setImageStatus((s) => ({ ...s, [targetId]: { uploading: true } }))
      void doUpload(file, targetId)
    }

    // ---- menu "/" ----

    const closeSlash = (): void => {
      if (!slashBlockRef.current) return
      slashBlockRef.current = null
      setSlash(null)
      setSlashQuery('')
    }

    const updateSlashFromElement = (el: HTMLElement, blockId: string): void => {
      const caret = getCaretTextOffset(el)
      const text = el.textContent ?? ''
      const before = caret >= 0 ? text.slice(0, caret) : ''
      const m = SLASH_QUERY_RE.exec(before)
      if (m) {
        if (slashBlockRef.current === blockId) {
          setSlashQuery(m[1])
          return
        }
        slashBlockRef.current = blockId
        setSlash({ blockId, anchor: caretAnchor(el) })
        setSlashQuery(m[1])
      } else {
        closeSlash()
      }
    }

    // ---- picker link [[...]] ----

    const closeLinkPicker = (): void => {
      const cur = linkPickerRef.current
      if (cur) linkDismissedRef.current = { blockId: cur.blockId, from: cur.from }
      if (!linkBlockRef.current) return
      linkBlockRef.current = null
      setLinkPicker(null)
    }

    const updateLinkPickerFromElement = (el: HTMLElement, blockId: string): void => {
      const caret = getCaretTextOffset(el)
      const text = el.textContent ?? ''
      const before = caret >= 0 ? text.slice(0, caret) : ''
      const m = LINK_QUERY_RE.exec(before)
      if (m) {
        const from = caret - m[0].length
        if (linkBlockRef.current === blockId) {
          // già aperto: aggiorna solo il caret finale (testo digitato a cavallo del focus)
          setLinkPicker((prev) => (prev && prev.blockId === blockId ? { ...prev, to: caret } : prev))
          return
        }
        // se l'utente aveva chiuso il picker su questa stessa sequenza, non riaprire
        const dismissed = linkDismissedRef.current
        if (dismissed && dismissed.blockId === blockId && dismissed.from === from) return
        linkDismissedRef.current = null
        linkBlockRef.current = blockId
        setLinkPicker({
          blockId,
          anchor: caretAnchor(el),
          from,
          to: caret,
        })
      } else {
        closeLinkPicker()
      }
    }

    /**
     * Inserisce il link pagina al posto di "[[...": elimina la sequenza
     * salvata, inserisce <a data-page-id> via execCommand (per undo e caret)
     * e aggiorna il blocco.
     */
    const insertPageLink = (hit: { pageId: string; title: string }): void => {
      const st = linkPickerRef.current
      // inserimento riuscito: la sequenza sparisce, nessuna "dismissal" da ricordare
      linkDismissedRef.current = null
      closeLinkPicker()
      if (!st) return
      const el = editableRefs.current.get(st.blockId)
      if (!el) return
      el.focus()
      const range = createRangeFromTextOffsets(el, st.from, st.to)
      range.deleteContents()
      const sel = window.getSelection()
      if (sel) {
        sel.removeAllRanges()
        sel.addRange(range)
      }
      const title = escapeHtml(hit.title.trim() || untitledRef.current)
      const html = `<a data-page-id="${escapeHtml(hit.pageId)}" href="#" class="page-link">${title}</a>`
      document.execCommand('insertHTML', false, html)
      updateEmptyState(el)
      updateBlock(st.blockId, { content: el.innerHTML })
    }

    // ---- scorciatoie Markdown ----

    const matchMarkdown = (el: HTMLElement): MarkdownHit | null => {
      const text = el.textContent ?? ''
      const caret = getCaretTextOffset(el)
      if (caret <= 0) return null
      for (const [re, type] of MARKDOWN_RULES) {
        const m = re.exec(text)
        if (m && caret === m[0].length) return { type, prefixLen: m[0].length }
      }
      if (caret === 3) {
        // il terzo backtick / il terzo trattino: il blocco contiene SOLO i caratteri digitati
        if (text === '```') return { type: 'code', prefixLen: 3 }
        if (text === '---') return { type: 'divider', prefixLen: 3 }
      }
      return null
    }

    const applyMarkdown = (el: HTMLElement, blockId: string, hit: MarkdownHit): void => {
      closeSlash()
      closeLinkPicker()
      const b = findById(blockId)
      if (!b) return
      const range = createRangeFromTextOffsets(el, 0, hit.prefixLen)
      range.deleteContents()
      updateEmptyState(el)
      if (hit.type === 'divider') {
        const arr = blocksRef.current
        const idx = arr.findIndex((x) => x.id === blockId)
        if (idx === -1) return
        const next = arr.slice()
        next[idx] = { ...b, ...conversionPatch('divider', '') }
        const nb: Block = { id: uid(), type: 'paragraph', content: '', indent: b.indent }
        next.splice(idx + 1, 0, nb)
        pendingFocusRef.current = { id: nb.id, where: 'start' }
        commit(next)
        return
      }
      const newContent = convertContent(b.type, hit.type, el.innerHTML)
      pendingFocusRef.current = { id: blockId, where: 'start' }
      updateBlock(blockId, conversionPatch(hit.type, newContent))
    }

    // ---- input ----

    const handleInput = (el: HTMLDivElement, block: Block): void => {
      updateEmptyState(el)
      const cur = findById(block.id)
      if (!cur) return
      updateSlashFromElement(el, block.id)
      updateLinkPickerFromElement(el, block.id)
      if (isTextType(cur.type)) {
        const hit = matchMarkdown(el)
        if (hit) {
          applyMarkdown(el, block.id, hit)
          return
        }
      }
      updateBlock(block.id, { content: el.innerHTML })
    }

    // ---- tastiera ----

    const handleEnter = (cur: Block, el: HTMLElement): void => {
      const arr = blocksRef.current
      const idx = arr.findIndex((b) => b.id === cur.id)
      if (idx === -1) return
      const isList =
        cur.type === 'bullet' || cur.type === 'numbered' || cur.type === 'checklist'
      // voce di elenco vuota → diventa paragrafo
      if (isList && isEmptyContent(el.innerHTML)) {
        pendingFocusRef.current = { id: cur.id, where: 'start' }
        updateBlock(cur.id, conversionPatch('paragraph', ''))
        return
      }
      // split al caret: il corrente tiene "before", il nuovo va DOPO
      const { before, after } = splitContentAtCaret(el)
      el.innerHTML = before
      updateEmptyState(el)
      const nb: Block = {
        id: uid(),
        type: isList ? cur.type : 'paragraph',
        content: after,
        indent: cur.indent,
      }
      if (nb.type === 'checklist') nb.checked = false
      const next = arr.slice()
      next[idx] = { ...cur, content: before }
      next.splice(idx + 1, 0, nb)
      pendingFocusRef.current = { id: nb.id, where: 'start' }
      commit(next)
    }

    /** Elimina il blocco a `idx` (paragrafo vuoto) e focalizza il testo più vicino. */
    const deleteEmptyAndFocus = (idx: number): void => {
      const arr = blocksRef.current
      const id = arr[idx].id
      let next = arr.filter((_, i) => i !== idx)
      if (next.length === 0) {
        // la pagina ha SEMPRE almeno un blocco
        const nb: Block = { id: uid(), type: 'paragraph', content: '' }
        next = [nb]
        pendingFocusRef.current = { id: nb.id, where: 'start' }
        commit(next)
        clearImageStatus(id)
        return
      }
      let focused = false
      for (let i = idx - 1; i >= 0; i--) {
        if (isTextType(next[i].type) || next[i].type === 'code') {
          pendingFocusRef.current = { id: next[i].id, where: 'end' }
          focused = true
          break
        }
      }
      if (!focused) {
        for (let i = idx; i < next.length; i++) {
          if (isTextType(next[i].type) || next[i].type === 'code') {
            pendingFocusRef.current = { id: next[i].id, where: 'start' }
            break
          }
        }
      }
      commit(next)
      clearImageStatus(id)
    }

    const handleBackspaceText = (cur: Block, el: HTMLElement): void => {
      const arr = blocksRef.current
      const idx = arr.findIndex((b) => b.id === cur.id)
      if (idx === -1) return

      // 1. tipo ≠ paragraph → converti in paragraph (contenuto conservato)
      if (cur.type !== 'paragraph') {
        const content = convertContent(cur.type, 'paragraph', cur.content)
        pendingFocusRef.current = { id: cur.id, where: 'start' }
        updateBlock(cur.id, conversionPatch('paragraph', content))
        return
      }
      // 2. rientro → diminuisce di uno
      const indent = cur.indent ?? 0
      if (indent > 0) {
        updateBlock(cur.id, { indent: indent - 1 })
        return
      }
      // 3. paragrafo vuoto → elimina e focalizza il precedente
      if (isEmptyContent(el.innerHTML) || isEmptyContent(cur.content)) {
        deleteEmptyAndFocus(idx)
        return
      }
      // 4. paragrafo non vuoto: fusione o eliminazione del precedente
      if (idx === 0) return
      const prev = arr[idx - 1]
      if (isTextType(prev.type)) {
        const next = arr.slice()
        next[idx - 1] = { ...prev, content: prev.content + cur.content }
        next.splice(idx, 1)
        pendingFocusRef.current = { id: prev.id, where: 'end' }
        commit(next)
        return
      }
      if (prev.type === 'divider' || prev.type === 'image' || prev.type === 'bookmark') {
        const next = arr.filter((b) => b.id !== prev.id)
        if (next.length === 0) next.push({ id: uid(), type: 'paragraph', content: '' })
        commit(next)
        clearImageStatus(prev.id)
        return
      }
      // precedente code → nulla
    }

    const handleKeyDown = (
      e: React.KeyboardEvent<HTMLElement>,
      block: Block,
      el: HTMLElement
    ): void => {
      const cur = findById(block.id)
      if (!cur) return
      const mod = e.metaKey || e.ctrlKey

      if (e.key === 'Enter') {
        if (mod) {
          // Cmd/Ctrl+Enter su checklist → toggle della spunta
          if (cur.type === 'checklist') {
            e.preventDefault()
            toggleCheck(cur.id)
          }
          return
        }
        if (e.shiftKey) return // Shift+Enter: <br> nativo
        // menu "/" aperto: Enter/Tab sono già intercettati in capture da SlashMenu
        e.preventDefault()
        handleEnter(cur, el)
        return
      }
      if (e.key === 'Backspace') {
        if (!isCaretAtStart(el)) return
        e.preventDefault()
        handleBackspaceText(cur, el)
        return
      }
      if (e.key === 'ArrowUp') {
        if (isCaretAtStart(el) && focusSiblingText(cur.id, -1)) e.preventDefault()
        return
      }
      if (e.key === 'ArrowDown') {
        if (isCaretAtEnd(el) && focusSiblingText(cur.id, 1)) e.preventDefault()
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        const cur2 = cur.indent ?? 0
        const nextIndent = Math.min(4, Math.max(0, cur2 + (e.shiftKey ? -1 : 1)))
        if (nextIndent !== cur2) updateBlock(cur.id, { indent: nextIndent })
        return
      }
      if (e.key === 'Escape') {
        closeSlash()
        closeLinkPicker()
      }
    }

    // ---- incolla (mai HTML grezzo) ----

    const handlePaste = (
      e: React.ClipboardEvent<HTMLElement>,
      block: Block,
      el: HTMLElement
    ): void => {
      e.preventDefault()
      closeSlash()
      const files = e.clipboardData?.files
      if (files && files.length > 0) {
        const file = Array.from(files).find((f) => f.type.startsWith('image/'))
        if (file && !validateImageFile(file)) {
          const cur = findById(block.id)
          const placement: ImagePlacement = cur && isEmptyContent(el.innerHTML) ? 'self' : 'after'
          uploadImage(file, block.id, placement)
          return
        }
      }
      const text = e.clipboardData?.getData('text/plain') ?? ''
      if (text) document.execCommand('insertText', false, text)
    }

    const handleCaptionKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, block: Block): void => {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (!focusSiblingText(block.id, 1)) {
          insertAfter(block.id, { type: 'paragraph', content: '' })
        }
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        e.currentTarget.blur()
      }
    }

    const handleBlur = (block: Block): void => {
      if (slashBlockRef.current === block.id) closeSlash()
    }

    // ---- selezione dal menu "/" ----

    const slashSelect = (type: BlockType): void => {
      const blockId = slashBlockRef.current
      closeSlash()
      if (!blockId) return
      const el = editableRefs.current.get(blockId)
      const b = findById(blockId)
      if (!el || !b) return
      // rimuove "/query" (dallo slash al caret)
      const caret = getCaretTextOffset(el)
      const text = el.textContent ?? ''
      const beforeText = caret >= 0 ? text.slice(0, caret) : ''
      const m = SLASH_QUERY_RE.exec(beforeText)
      if (m && caret - m[1].length - 1 >= 0) {
        const range = createRangeFromTextOffsets(el, caret - m[1].length - 1, caret)
        range.deleteContents()
        updateEmptyState(el)
      }
      const remaining = (el.textContent ?? '').trim()
      if (isTextType(type)) {
        pendingFocusRef.current = { id: blockId, where: 'start' }
        updateBlock(blockId, conversionPatch(type, el.innerHTML))
        return
      }
      // divider / image / bookmark
      if (remaining === '') {
        updateBlock(blockId, conversionPatch(type, ''))
        if (type === 'divider') {
          insertAfter(blockId, { type: 'paragraph', content: '' })
        }
        return
      }
      // c'è del testo prima del comando: il blocco resta, il nuovo va dopo
      updateBlock(blockId, { content: el.innerHTML })
      const newId = insertAfter(blockId, { type, content: '' }, { focus: false })
      if (type === 'divider') {
        insertAfter(newId, { type: 'paragraph', content: '' })
      }
    }

    const onToolbarContentChange = (blockId: string, html: string): void => {
      updateBlock(blockId, { content: html })
    }

    const api: EditorApi = {
      updateBlock,
      registerRef,
      focusBlock,
      insertAfter,
      duplicateBlock,
      removeBlock,
      moveBlock,
      dropBlock,
      dragStart,
      dragEnd,
      setDrop,
      toggleCheck,
      escapeCode,
      convertFromCode,
      focusSiblingText,
      uploadImage,
      handleInput,
      handleKeyDown,
      handlePaste,
      handleCaptionKeyDown,
      handleBlur,
    }

    return { api, closeSlash, closeLinkPicker, insertPageLink, slashSelect, onToolbarContentChange }
  }, [])

  const { api, closeSlash, closeLinkPicker, insertPageLink, slashSelect, onToolbarContentChange } = editor

  // ---------------------------------------------------------------------------
  // Drag & drop: dragover sul contenitore (area vuota → in coda)
  // ---------------------------------------------------------------------------
  const dragTypes = (e: React.DragEvent<HTMLDivElement>): string[] => {
    return Array.from(e.dataTransfer?.types ?? [])
  }

  const onDragOverContainer = (e: React.DragEvent<HTMLDivElement>): void => {
    const types = dragTypes(e)
    if (!types.includes('text/block-id') && !types.includes('Files')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = types.includes('text/block-id') ? 'move' : 'copy'
    const target = e.target as HTMLElement
    if (target.closest('[data-block-id]')) return // il blocco gestisce il proprio target
    const last = blocksRef.current[blocksRef.current.length - 1]
    if (last) api.setDrop({ id: last.id, pos: 'after' })
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    const types = dragTypes(e)
    if (!types.includes('text/block-id') && !types.includes('Files')) return
    e.preventDefault()
    const target = dropTargetRef.current
    api.dragEnd()
    const sourceId = e.dataTransfer.getData('text/block-id')
    if (sourceId) {
      if (target && target.id !== sourceId) api.dropBlock(sourceId, target.id, target.pos)
      return
    }
    // drop di file immagine → blocco image nel punto di inserimento
    const file = Array.from(e.dataTransfer.files ?? []).find((f) => f.type.startsWith('image/'))
    if (!file || validateImageFile(file)) return
    let afterId: string | null = null
    if (target) {
      if (target.pos === 'after') {
        afterId = target.id
      } else {
        const idx = blocksRef.current.findIndex((b) => b.id === target.id)
        afterId = idx > 0 ? blocksRef.current[idx - 1].id : null
      }
    } else {
      afterId = blocksRef.current[blocksRef.current.length - 1]?.id ?? null
    }
    const newId = api.insertAfter(afterId, { type: 'image', content: '' }, { focus: false })
    api.uploadImage(file, newId, 'card')
  }

  const onDragLeave = (e: React.DragEvent<HTMLDivElement>): void => {
    if (!draggingIdRef.current && !dropTargetRef.current) return
    const related = e.relatedTarget as Node | null
    if (related && e.currentTarget.contains(related)) return
    api.dragEnd()
  }

  // Click sui link pagina: delegazione a livello di contenitore editor.
  const onContainerClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    const anchor = (e.target as HTMLElement).closest('a[data-page-id]')
    if (!anchor) return
    e.preventDefault()
    const pageId = anchor.getAttribute('data-page-id')
    if (pageId) onOpenPageRef.current?.(pageId)
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onDragOver={onDragOverContainer}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
      onClick={onContainerClick}
    >
      <style>{PLACEHOLDER_CSS}</style>
      <div key={resetKey} className="flex flex-col gap-0.5 pl-6 pr-1 md:pl-14">
        {blocks.map((b) => (
          <React.Fragment key={b.id}>
            {dropTarget && dropTarget.id === b.id && dropTarget.pos === 'before' && (
              <div aria-hidden className="h-0.5 rounded-full bg-primary" />
            )}
            {/* key include il tipo: la conversione di tipo rimonta il blocco
                con DOM fresco — il vecchio editabile non viene mai riusato
                come wrapper della nuova struttura (fonte di caret corrotti). */}
            <BlockItem
              key={`${b.id}:${b.type}`}
              block={b}
              number={numbers.get(b.id)}
              api={api}
              imageStatus={imageStatus[b.id]}
            />
            {dropTarget && dropTarget.id === b.id && dropTarget.pos === 'after' && (
              <div aria-hidden className="h-0.5 rounded-full bg-primary" />
            )}
          </React.Fragment>
        ))}
      </div>
      {slash ? (
        <SlashMenu
          anchor={slash.anchor}
          query={slashQuery}
          onSelect={slashSelect}
          onClose={closeSlash}
        />
      ) : null}
      {linkPicker ? (
        <PageLinkPicker
          anchor={linkPicker.anchor}
          onSelect={insertPageLink}
          onClose={closeLinkPicker}
        />
      ) : null}
      <FormatToolbar container={containerRef} onContentChange={onToolbarContentChange} />
    </div>
  )
}
