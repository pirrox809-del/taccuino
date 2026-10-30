'use client'

/**
 * Taccuino — menu "/" per inserire blocchi.
 *
 * Renderizzato in portal su body, posizionato sotto il caret (con flip sopra
 * se non c'è spazio). Mentre è aperto intercetta in capture ArrowUp/ArrowDown
 * (wrap), Enter/Tab (selezione) ed Escape: gli altri tasti fluiscono nel
 * blocco e la query si aggiorna via input.
 */
import * as React from 'react'
import { createPortal } from 'react-dom'
import {
  Bookmark,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Lightbulb,
  List,
  ListOrdered,
  Minus,
  SquareCheckBig,
  SquareCode,
  TextQuote,
  Type,
  type LucideIcon,
} from 'lucide-react'
import { useI18n, type TranslationKey } from '@/lib/i18n'
import type { BlockType } from '@/lib/types'
import { cn } from '@/lib/utils'

interface SlashItem {
  type: BlockType
  labelKey: TranslationKey
  descKey: TranslationKey
  icon: LucideIcon
  alias: string
}

const SLASH_ITEMS: SlashItem[] = [
  { type: 'paragraph', labelKey: 'slashBlockText', descKey: 'slashBlockTextDesc', icon: Type, alias: 'text p paragrafo' },
  { type: 'heading1', labelKey: 'slashBlockH1', descKey: 'slashBlockH1Desc', icon: Heading1, alias: 'h1 titolo title big grande' },
  { type: 'heading2', labelKey: 'slashBlockH2', descKey: 'slashBlockH2Desc', icon: Heading2, alias: 'h2 titolo title medium medio' },
  { type: 'heading3', labelKey: 'slashBlockH3', descKey: 'slashBlockH3Desc', icon: Heading3, alias: 'h3 titolo title small piccolo' },
  { type: 'bullet', labelKey: 'slashBlockBullet', descKey: 'slashBlockBulletDesc', icon: List, alias: 'ul elenco list puntato' },
  { type: 'numbered', labelKey: 'slashBlockNumbered', descKey: 'slashBlockNumberedDesc', icon: ListOrdered, alias: 'ol elenco list numerato' },
  { type: 'checklist', labelKey: 'slashBlockChecklist', descKey: 'slashBlockChecklistDesc', icon: SquareCheckBig, alias: 'todo task spunta check da fare' },
  { type: 'quote', labelKey: 'slashBlockQuote', descKey: 'slashBlockQuoteDesc', icon: TextQuote, alias: 'citazione blockquote' },
  { type: 'code', labelKey: 'slashBlockCode', descKey: 'slashBlockCodeDesc', icon: SquareCode, alias: 'codice snippet mono' },
  { type: 'divider', labelKey: 'slashBlockDivider', descKey: 'slashBlockDividerDesc', icon: Minus, alias: 'divisore linea hr separatore' },
  { type: 'callout', labelKey: 'slashBlockCallout', descKey: 'slashBlockCalloutDesc', icon: Lightbulb, alias: 'nota evidenzia box' },
  { type: 'image', labelKey: 'slashBlockImage', descKey: 'slashBlockImageDesc', icon: Image, alias: 'immagine img foto picture' },
  { type: 'bookmark', labelKey: 'slashBlockBookmark', descKey: 'slashBlockBookmarkDesc', icon: Bookmark, alias: 'segnalibro link url web' },
]

export interface SlashMenuProps {
  anchor: { left: number; bottom: number; top: number }
  query: string
  onSelect: (type: BlockType) => void
  onClose: () => void
}

const MENU_WIDTH = 288

export function SlashMenu({ anchor, query, onSelect, onClose }: SlashMenuProps) {
  const { t } = useI18n()
  const [activeIndex, setActiveIndex] = React.useState(0)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const itemRefs = React.useRef<Array<HTMLDivElement | null>>([])

  const items = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return SLASH_ITEMS
    return SLASH_ITEMS.filter((item) => {
      const label = t(item.labelKey).toLowerCase()
      const desc = t(item.descKey).toLowerCase()
      return label.includes(q) || desc.includes(q) || item.alias.includes(q) || item.type.includes(q)
    })
  }, [query, t])

  React.useEffect(() => {
    setActiveIndex(0)
  }, [query])

  React.useEffect(() => {
    if (items.length > 0 && activeIndex >= items.length) setActiveIndex(0)
  }, [items.length, activeIndex])

  React.useEffect(() => {
    itemRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  // Tastiera: intercetta in capture PRIMA che i gestori React del blocco vedano i tasti.
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (items.length === 0) return
        e.preventDefault()
        e.stopPropagation()
        setActiveIndex((a) => (a + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        e.stopPropagation()
        // nessuna voce: chiudi senza spezzare il blocco
        if (items.length === 0) {
          onClose()
          return
        }
        onSelect(items[Math.min(activeIndex, items.length - 1)].type)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [items, activeIndex, onSelect, onClose])

  // Click fuori dal menu → chiudi.
  React.useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [onClose])

  const viewportW = window.innerWidth
  const viewportH = window.innerHeight
  const estHeight = Math.min(320, 44 + items.length * 44 + 8)
  const left = Math.min(Math.max(8, anchor.left), Math.max(8, viewportW - MENU_WIDTH - 8))
  let top = anchor.bottom + 6
  if (top + estHeight > viewportH - 8) top = Math.max(8, anchor.top - estHeight - 6)

  return createPortal(
    <div
      ref={rootRef}
      role="listbox"
      aria-label={t('slashMenuTitle')}
      className="fixed z-50 w-72 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg"
      style={{ left, top }}
    >
      <div className="px-3 py-2 text-xs font-medium text-muted-foreground">{t('slashMenuTitle')}</div>
      <div className="max-h-80 overflow-y-auto p-1">
        {items.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">{t('slashMenuNoResults')}</div>
        )}
        {items.map((item, i) => {
          const Icon = item.icon
          return (
            <div
              key={item.type}
              ref={(el) => {
                itemRefs.current[i] = el
              }}
              role="option"
              aria-selected={i === activeIndex}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2',
                i === activeIndex && 'bg-accent'
              )}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => onSelect(item.type)}
            >
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{t(item.labelKey)}</span>
                <span className="block truncate text-xs text-muted-foreground">{t(item.descKey)}</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>,
    document.body
  )
}
