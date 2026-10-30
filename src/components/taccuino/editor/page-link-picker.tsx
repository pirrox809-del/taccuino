'use client'

/**
 * Taccuino — picker di link pagina `[[…]]`: piccolo layer inline posizionato
 * vicino al caret, con input di ricerca (GET /api/search, debounce 150 ms,
 * richieste abortite se superate). Frecce + Enter o click selezionano,
 * Escape chiude. Il rendering segue il pattern del menu "/" (portal su body).
 */
import * as React from 'react'
import { createPortal } from 'react-dom'
import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useI18n } from '@/lib/i18n'
import type { SearchHit } from '@/lib/types'
import { cn } from '@/lib/utils'

export interface PageLinkPickerProps {
  anchor: { left: number; bottom: number; top: number }
  onSelect: (hit: SearchHit) => void
  onClose: () => void
}

const PICKER_WIDTH = 320
const MAX_HITS = 8

export function PageLinkPicker({ anchor, onSelect, onClose }: PageLinkPickerProps) {
  const { t } = useI18n()
  const [query, setQuery] = React.useState('')
  const [hits, setHits] = React.useState<SearchHit[]>([])
  const [loading, setLoading] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(0)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Ricerca debounced con abort (come nella palette Ctrl+K)
  React.useEffect(() => {
    const q = query.trim()
    if (q === '') {
      setHits([])
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(String(res.status))
        const data = (await res.json()) as { results: SearchHit[] }
        setHits(data.results.slice(0, MAX_HITS))
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setHits([])
      } finally {
        setLoading(false)
      }
    }, 150)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [query])

  React.useEffect(() => {
    setActiveIndex(0)
  }, [hits])

  React.useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Tastiera: intercetta in capture prima degli altri gestori (pattern SlashMenu)
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (hits.length === 0) return
        e.preventDefault()
        e.stopPropagation()
        setActiveIndex((a) => (a + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        if (hits.length === 0) {
          onClose()
          return
        }
        onSelect(hits[Math.min(activeIndex, hits.length - 1)])
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
  }, [hits, activeIndex, onSelect, onClose])

  // Click fuori → chiudi
  React.useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [onClose])

  const viewportW = window.innerWidth
  const viewportH = window.innerHeight
  const estHeight = 44 + Math.min(hits.length, MAX_HITS) * 40 + 8
  const left = Math.min(Math.max(8, anchor.left), Math.max(8, viewportW - PICKER_WIDTH - 8))
  let top = anchor.bottom + 6
  if (top + estHeight > viewportH - 8) top = Math.max(8, anchor.top - estHeight - 6)

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-label={t('pageLinkSearch')}
      className="fixed z-50 w-80 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg"
      style={{ left, top }}
    >
      <div className="flex items-center gap-2 border-b px-3">
        <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('pageLinkSearch')}
          aria-label={t('pageLinkSearch')}
          className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div className="max-h-64 overflow-y-auto p-1" role="listbox" aria-label={t('pageLinkSearch')}>
        {hits.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            {loading ? t('loading') : t('pageLinkNoResults')}
          </div>
        ) : (
          hits.map((hit, i) => (
            <div
              key={`${hit.pageId}:${hit.rowId ?? 'page'}`}
              role="option"
              aria-selected={i === activeIndex}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2',
                i === activeIndex && 'bg-accent'
              )}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => onSelect(hit)}
            >
              <span aria-hidden className="shrink-0 text-base leading-none">
                {hit.icon ?? '📄'}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">
                {hit.title.trim() || t('untitled')}
              </span>
              {hit.isRow ? (
                <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px] font-medium">
                  {t('rowBadge')}
                </Badge>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>,
    document.body
  )
}
