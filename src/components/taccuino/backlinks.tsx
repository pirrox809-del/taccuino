'use client'

/**
 * Taccuino — sezione "Collegamenti" (backlink in entrata) in fondo alla pagina.
 * Carica da GET /api/pages/[id]/backlinks al mount e al cambio pagina; il
 * snippet HTML (<mark>) è sanificato dal backend e viene renderizzato come HTML.
 */
import * as React from 'react'
import { ChevronRight, Link2 } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/lib/i18n'
import type { BacklinkHit } from '@/lib/types'

export interface BacklinksSectionProps {
  pageId: string
  onSelectPage: (pageId: string) => void
  /** Comunica al guscio il numero di backlink (per il footer della pagina). */
  onCount?: (n: number) => void
}

export function BacklinksSection({ pageId, onSelectPage, onCount }: BacklinksSectionProps) {
  const { t } = useI18n()
  const [links, setLinks] = React.useState<BacklinkHit[] | null>(null)
  const [open, setOpen] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    setLinks(null)
    setOpen(true)
    void (async () => {
      try {
        const res = await fetch(`/api/pages/${pageId}/backlinks`)
        if (!res.ok) throw new Error(String(res.status))
        const data = (await res.json()) as { backlinks: BacklinkHit[] }
        if (!cancelled) {
          const list = data.backlinks ?? []
          setLinks(list)
          onCount?.(list.length)
        }
      } catch {
        if (!cancelled) {
          setLinks([])
          onCount?.(0)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pageId, onCount])

  // Caricamento: piccolo skeleton
  if (links === null) {
    return (
      <div className="mt-10 flex items-center gap-2" aria-hidden>
        <Skeleton className="h-4 w-28" />
      </div>
    )
  }

  // Nessun backlink: forma minimale
  if (links.length === 0) {
    return (
      <p className="mt-10 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link2 className="size-3.5" aria-hidden />
        {t('backlinksNone')}
      </p>
    )
  }

  const countLabel =
    links.length === 1 ? t('backlinksCountOne') : t('backlinksCountMany', { n: links.length })

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-12">
      <CollapsibleTrigger className="group flex w-full cursor-pointer items-center gap-1.5 rounded-md py-1 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
        <ChevronRight
          className="size-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-90"
          aria-hidden
        />
        <Link2 className="size-3.5 shrink-0" aria-hidden />
        {t('backlinksTitle')}
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal">
          {countLabel}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="mt-2 flex flex-col gap-1">
          {links.map((hit) => (
            <li key={hit.pageId}>
              <button
                type="button"
                onClick={() => onSelectPage(hit.pageId)}
                className="flex w-full cursor-pointer items-start gap-2 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <span aria-hidden className="shrink-0 text-base leading-6">
                  {hit.icon ?? '📄'}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {hit.title.trim() || t('untitled')}
                  </span>
                  {hit.snippet ? (
                    <span
                      className="mt-0.5 line-clamp-2 block text-xs leading-5 text-muted-foreground [&>mark]:bg-amber-200/70 [&>mark]:dark:bg-amber-500/30"
                      dangerouslySetInnerHTML={{ __html: hit.snippet }}
                    />
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}
