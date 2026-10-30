'use client'

/**
 * Taccuino — pannello "Struttura": indice navigabile dei titoli della pagina
 * corrente, con evidenziazione automatica della sezione in lettura
 * (scroll-spy). Notion non ha un indice laterale: qui c'è, ed è vivo.
 */
import * as React from 'react'
import { Hash } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import type { Block } from '@/lib/types'
import { cn } from '@/lib/utils'

export interface OutlineItem {
  id: string
  level: 1 | 2 | 3
  text: string
}

/** Ricava l'indice dai blocchi (titoli h1–h3, in ordine). */
export function outlineFromBlocks(blocks: Block[]): OutlineItem[] {
  const items: OutlineItem[] = []
  for (const b of blocks) {
    if (b.type === 'heading1' || b.type === 'heading2' || b.type === 'heading3') {
      const text = b.content
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim()
      items.push({ id: b.id, level: Number(b.type.slice(-1)) as 1 | 2 | 3, text })
    }
  }
  return items
}

export interface OutlinePanelProps {
  blocks: Block[]
  /** Contenitore scrollabile della pagina (per lo scroll-spy). */
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
}

export function OutlinePanel({ blocks, scrollContainerRef }: OutlinePanelProps) {
  const { t } = useI18n()
  const items = React.useMemo(() => outlineFromBlocks(blocks), [blocks])
  const [activeId, setActiveId] = React.useState<string | null>(null)

  // scroll-spy: ultimo titolo sopra la piega
  React.useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    let raf = 0
    const update = () => {
      raf = 0
      // soglia: ~30% dell'altezza della finestra (min 180px), come negli
      // editor di testo: la sezione "in lettura" è l'ultimo titolo sopra la piega
      const threshold = Math.max(180, window.innerHeight * 0.3)
      let current: string | null = null
      for (const item of items) {
        const el = container.querySelector(`[data-block-id="${CSS.escape(item.id)}"]`)
        if (el && el.getBoundingClientRect().top <= threshold) current = item.id
      }
      setActiveId(current)
    }
    const onScroll = () => {
      if (raf === 0) raf = requestAnimationFrame(update)
    }
    update()
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', onScroll)
      if (raf !== 0) cancelAnimationFrame(raf)
    }
  }, [scrollContainerRef, items])

  const goTo = (id: string) => {
    const container = scrollContainerRef.current
    if (!container) return
    const el = container.querySelector(`[data-block-id="${CSS.escape(id)}"]`)
    if (!el) return
    const top = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop
    container.scrollTo({ top: Math.max(0, top - 80), behavior: 'smooth' })
  }

  if (items.length === 0) return null

  return (
    <nav
      aria-label={t('outlineAria')}
      className="absolute right-3 top-16 z-20 hidden w-60 xl:block"
    >
      <div className="rounded-xl border bg-background/85 p-2.5 shadow-sm backdrop-blur">
        <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Hash className="size-3" aria-hidden />
          {t('outlineTitle')}
        </p>
        <ul className="max-h-80 overflow-y-auto pr-0.5" style={{ scrollbarWidth: 'thin' }}>
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => goTo(item.id)}
                aria-current={activeId === item.id ? 'true' : undefined}
                className={cn(
                  'block w-full cursor-pointer truncate rounded-md px-2 py-1 text-left text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  item.level === 1 && 'font-medium',
                  item.level === 2 && 'pl-4',
                  item.level === 3 && 'pl-6 text-muted-foreground',
                  activeId === item.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                )}
                title={item.text || t('untitled')}
              >
                {item.text || t('untitled')}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
