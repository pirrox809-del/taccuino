'use client'

/**
 * Taccuino — palette di ricerca (Ctrl/Cmd+K): azioni rapide + risultati
 * full-text dal backend (debounce 150 ms, richieste abortite se superate).
 */
import * as React from 'react'
import {
  Download,
  FilePlus2,
  Languages,
  Search,
  SunMoon,
  Trash2,
  Upload,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useI18n } from '@/lib/i18n'
import type { SearchHit, SearchResponse } from '@/lib/types'

export interface SearchPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectPage: (pageId: string) => void
  onCreatePage: () => void
  onOpenTrash: () => void
  onOpenImport: () => void
  onExportZip: () => void
}

export function SearchPalette(props: SearchPaletteProps) {
  const {
    open,
    onOpenChange,
    onSelectPage,
    onCreatePage,
    onOpenTrash,
    onOpenImport,
    onExportZip,
  } = props
  const { t, lang, setLang } = useI18n()
  const { theme, setTheme } = useTheme()
  const [query, setQuery] = React.useState('')
  const [hits, setHits] = React.useState<SearchHit[]>([])
  const [loading, setLoading] = React.useState(false)

  // Reset a ogni apertura
  React.useEffect(() => {
    if (open) {
      setQuery('')
      setHits([])
      setLoading(false)
    }
  }, [open])

  // Ricerca debounced con abort
  React.useEffect(() => {
    const q = query.trim()
    if (!open || q === '') {
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
        const data = (await res.json()) as SearchResponse
        setHits(data.results)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setHits([])
      } finally {
        setLoading(false)
      }
    }, 150)
    return () => {
      controller.abort()
      clearTimeout(timer)
      setLoading(false)
    }
  }, [query, open])

  const run = (action: () => void) => {
    onOpenChange(false)
    action()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-lg" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>{t('search')}</DialogTitle>
          <DialogDescription>{t('searchPlaceholder')}</DialogDescription>
        </DialogHeader>
        <Command shouldFilter={false} className="[&_[cmdk-group-heading]]:text-muted-foreground">
          <div className="flex h-12 items-center gap-2 border-b px-3" data-slot="command-input-wrapper">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder={t('searchPlaceholder')}
              className="h-12 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground focus:ring-0 focus:outline-none disabled:opacity-50"
            />
          </div>
          <CommandList className="max-h-80">
            <CommandEmpty>{t('searchNoResults')}</CommandEmpty>

            {query.trim() === '' ? (
              <CommandGroup heading={t('searchActionsGroup')}>
                <CommandItem onSelect={() => run(onCreatePage)}>
                  <FilePlus2 className="size-4" aria-hidden />
                  {t('searchNewPage')}
                </CommandItem>
                <CommandItem onSelect={() => run(onOpenTrash)}>
                  <Trash2 className="size-4" aria-hidden />
                  {t('searchGoTrash')}
                </CommandItem>
                <CommandItem onSelect={() => run(onOpenImport)}>
                  <Upload className="size-4" aria-hidden />
                  {t('searchImportFile')}
                </CommandItem>
                <CommandItem onSelect={() => run(onExportZip)}>
                  <Download className="size-4" aria-hidden />
                  {t('searchExportZip')}
                </CommandItem>
                <CommandItem onSelect={() => run(() => setTheme(theme === 'dark' ? 'light' : 'dark'))}>
                  <SunMoon className="size-4" aria-hidden />
                  {t('searchToggleTheme')}
                </CommandItem>
                <CommandItem onSelect={() => run(() => setLang(lang === 'it' ? 'en' : 'it'))}>
                  <Languages className="size-4" aria-hidden />
                  {t('searchToggleLang')}
                </CommandItem>
              </CommandGroup>
            ) : null}

            {query.trim() !== '' ? (
              <CommandGroup heading={loading ? t('loading') : t('searchResultsGroup')}>
                {hits.map((hit) => (
                  <CommandItem
                    key={`${hit.pageId}:${hit.rowId ?? 'page'}`}
                    value={`${hit.pageId}:${hit.rowId ?? 'page'}`}
                    onSelect={() => run(() => onSelectPage(hit.pageId))}
                  >
                    <span aria-hidden className="shrink-0 text-base leading-none">
                      {hit.icon ?? '📄'}
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate font-medium">
                          {hit.title.trim() || t('untitled')}
                        </span>
                        {hit.isRow ? (
                          <Badge
                            variant="outline"
                            className="shrink-0 px-1.5 py-0 text-[10px] font-medium"
                          >
                            {t('rowBadge')}
                          </Badge>
                        ) : null}
                      </span>
                      {hit.snippet ? (
                        <span className="line-clamp-2 text-xs text-muted-foreground">
                          {hit.snippet}
                        </span>
                      ) : null}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
          <div className="border-t px-3 py-2 text-[11px] text-muted-foreground">
            {t('searchHint')}
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
