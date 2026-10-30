'use client'

/**
 * Taccuino — toolbar di formattazione della selezione.
 *
 * Ascolta `selectionchange`: visibile solo con selezione non collassata
 * dentro un blocco testuale dell'editor. Le azioni usano execCommand (con
 * lettura dell'innerHTML del blocco per salvare) tranne il codice inline,
 * che è un toggle manuale con Range. Si nasconde su scroll e ricompare
 * alla selectionchange successiva.
 */
import * as React from 'react'
import { createPortal } from 'react-dom'
import { Bold, Code, Italic, Link, RemoveFormatting, Strikethrough, Underline } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

interface ToolbarState {
  x: number
  y: number
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  code: boolean
}

const LINK_RE = /^(https?:\/\/|mailto:|#)/i
const TOOLBAR_W = 232

function nodeToElement(node: Node | null): HTMLElement | null {
  if (!node) return null
  return node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement)
}

function editableFromSelection(): HTMLElement | null {
  const sel = document.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.anchorNode == null) return null
  const el = nodeToElement(sel.anchorNode)
  return el ? (el.closest('[data-editable="text"]') as HTMLElement | null) : null
}

function readActiveFlags(): Omit<ToolbarState, 'x' | 'y'> {
  const q = (cmd: string): boolean => {
    try {
      return document.queryCommandState(cmd)
    } catch {
      return false
    }
  }
  const sel = document.getSelection()
  const el = nodeToElement(sel?.anchorNode ?? null)
  return {
    bold: q('bold'),
    italic: q('italic'),
    underline: q('underline'),
    strike: q('strikeThrough'),
    code: !!el && !!el.closest('code'),
  }
}

function ToolbarButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      // non rubare il focus (e la selezione) al blocco editabile
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        active && 'bg-accent text-foreground'
      )}
    >
      {children}
    </button>
  )
}

export interface FormatToolbarProps {
  container: React.RefObject<HTMLDivElement | null>
  onContentChange: (blockId: string, html: string) => void
}

export function FormatToolbar({ container, onContentChange }: FormatToolbarProps) {
  const { lang, t } = useI18n()
  const [state, setState] = React.useState<ToolbarState | null>(null)

  React.useEffect(() => {
    const update = () => {
      const sel = document.getSelection()
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setState(null)
        return
      }
      const editable = editableFromSelection()
      if (!editable || !container.current?.contains(editable)) {
        setState(null)
        return
      }
      // selezione che attraversa blocchi diversi → non formattabile in sicurezza
      if (sel.focusNode && !editable.contains(sel.focusNode)) {
        setState(null)
        return
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect()
      if (!rect || (rect.width === 0 && rect.height === 0)) {
        setState(null)
        return
      }
      setState({ x: rect.left + rect.width / 2, y: rect.top, ...readActiveFlags() })
    }
    document.addEventListener('selectionchange', update)
    const hide = () => setState(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide()
    }
    document.addEventListener('scroll', hide, { capture: true, passive: true })
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('selectionchange', update)
      document.removeEventListener('scroll', hide, { capture: true })
      document.removeEventListener('keydown', onKey)
    }
  }, [container])

  const commitBlock = () => {
    const editable = editableFromSelection()
    const blockId = editable?.closest('[data-block-id]')?.getAttribute('data-block-id')
    if (editable && blockId) onContentChange(blockId, editable.innerHTML)
    setState((prev) => (prev ? { ...prev, ...readActiveFlags() } : prev))
  }

  const exec = (cmd: string) => {
    document.execCommand(cmd)
    commitBlock()
  }

  const toggleInlineCode = () => {
    const sel = document.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)
    const startEl = nodeToElement(range.startContainer)
    const existing = startEl?.closest('code') ?? null
    if (existing && existing.parentElement) {
      // unwrap: sostituisce il <code> con i suoi figli
      const parent = existing.parentElement
      const first = existing.firstChild
      const last = existing.lastChild
      while (existing.firstChild) parent.insertBefore(existing.firstChild, existing)
      parent.removeChild(existing)
      const after = document.createRange()
      if (first && last) {
        after.setStartBefore(first)
        after.setEndAfter(last)
      } else {
        after.setStart(parent, 0)
        after.collapse(true)
      }
      sel.removeAllRanges()
      sel.addRange(after)
    } else {
      const frag = range.extractContents()
      const code = document.createElement('code')
      code.appendChild(frag)
      range.insertNode(code)
      const after = document.createRange()
      after.selectNodeContents(code)
      sel.removeAllRanges()
      sel.addRange(after)
    }
    commitBlock()
  }

  const applyLink = () => {
    const url = window.prompt(t('toolbarLinkPrompt'))
    if (url === null) return
    const trimmed = url.trim()
    if (trimmed === '') {
      exec('unlink')
      return
    }
    if (!LINK_RE.test(trimmed)) return // URL non valido → ignora
    document.execCommand('createLink', false, trimmed)
    const editable = editableFromSelection()
    editable?.querySelectorAll('a').forEach((a) => {
      a.target = '_blank'
      a.rel = 'noopener noreferrer nofollow'
    })
    commitBlock()
  }

  if (!state) return null

  const half = TOOLBAR_W / 2
  const left = Math.min(Math.max(half + 8, state.x), Math.max(half + 8, window.innerWidth - half - 8)) - half
  const top = Math.max(8, state.y - 44)

  return createPortal(
    <div
      role="toolbar"
      aria-label={lang === 'it' ? 'Formattazione del testo' : 'Text formatting'}
      className="fixed z-50 flex items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-lg"
      style={{ left, top }}
    >
      <ToolbarButton label={t('toolbarBold')} active={state.bold} onClick={() => exec('bold')}>
        <Bold className="size-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton label={t('toolbarItalic')} active={state.italic} onClick={() => exec('italic')}>
        <Italic className="size-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton label={t('toolbarUnderline')} active={state.underline} onClick={() => exec('underline')}>
        <Underline className="size-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton label={t('toolbarStrike')} active={state.strike} onClick={() => exec('strikeThrough')}>
        <Strikethrough className="size-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton label={t('toolbarCode')} active={state.code} onClick={toggleInlineCode}>
        <Code className="size-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton label={t('toolbarLink')} active={false} onClick={applyLink}>
        <Link className="size-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton label={t('toolbarClear')} active={false} onClick={() => exec('removeFormat')}>
        <RemoveFormatting className="size-4" aria-hidden />
      </ToolbarButton>
    </div>,
    document.body
  )
}
