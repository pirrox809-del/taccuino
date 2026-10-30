'use client'

/**
 * Taccuino — vista pagina: copertina, breadcrumb, icona, titolo, editor a
 * blocchi (o vista database), sezione Collegamenti, indicatore di salvataggio
 * e conteggio parole/blocchi. In modalità focus la pagina si restringe al
 * testo e una pillola in basso mostra le statistiche live.
 *
 * Il titolo è un input controllato LOCALMENTE (bozza) resettato solo al
 * cambio pagina, così i refresh dei metadati non spostano il caret.
 * Per le pagine di tipo database il contenuto è uno slot React passato
 * dal guscio (`database`), al posto di PageEditor.
 */
import * as React from 'react'
import {
  ChevronRight,
  Clock,
  Copy,
  Download,
  Image as ImageIcon,
  ImageOff,
  MoreHorizontal,
  Star,
  Trash2,
  Type,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useI18n } from '@/lib/i18n'
import { usePrefsStore } from '@/lib/prefs-store'
import { coverToStyle, isCoverUrl } from '@/lib/covers'
import type { Block, PageMeta, PageWithBlocks } from '@/lib/types'
import { cn } from '@/lib/utils'
import { BacklinksSection } from './backlinks'
import { CoverPicker } from './cover-picker'
import { PageEditor } from './editor/page-editor'
import { EmojiPicker } from './editor/page-editor'

export type SaveStatus = 'saved' | 'saving' | 'error'

export interface PageStats {
  words: number
  blocks: number
  chars: number
}

/** Minuti di lettura stimati (200 parole/minuto). */
function readingMinutes(words: number): number {
  return words > 0 ? Math.max(1, Math.round(words / 200)) : 0
}

export interface PageViewProps {
  page: PageWithBlocks
  pages: PageMeta[]
  saveStatus: SaveStatus
  stats: PageStats
  resetSignal: number
  /** Contenuto alternativo per le pagine di tipo database (vista tabella/kanban). */
  database?: React.ReactNode
  /** true in modalità focus: colonna stretta, chrome ridotto, pillola statistiche. */
  focus?: boolean
  onBlocksChange: (blocks: Block[]) => void
  onTitleChange: (title: string) => void
  onIconChange: (icon: string | null) => void
  onToggleFavorite: (favorite: boolean) => void
  onCoverChange: (cover: string | null) => void
  onOpenPage: (pageId: string) => void
  onBacklinksCount?: (n: number) => void
  onDuplicate: () => void
  onExport: () => void
  onOpenHistory: () => void
  onTrash: () => void
  onExitFocus?: () => void
}

export function PageView(props: PageViewProps) {
  const {
    page,
    pages,
    saveStatus,
    stats,
    resetSignal,
    database,
    focus = false,
    onBlocksChange,
    onTitleChange,
    onIconChange,
    onToggleFavorite,
    onCoverChange,
    onOpenPage,
    onBacklinksCount,
    onDuplicate,
    onExport,
    onOpenHistory,
    onTrash,
    onExitFocus,
  } = props
  const { t } = useI18n()
  const typewriter = usePrefsStore((s) => s.typewriter)
  const setTypewriter = usePrefsStore((s) => s.setTypewriter)
  const [coverPickerOpen, setCoverPickerOpen] = React.useState(false)

  // Bozza titolo locale: resettata solo al cambio pagina.
  const [titleDraft, setTitleDraft] = React.useState(page.title)
  React.useEffect(() => {
    setTitleDraft(page.title)
  }, [page.id, page.title])

  // Breadcrumb: catena dei genitori (dalla radice alla pagina).
  const breadcrumbs = React.useMemo(() => {
    const chain: PageMeta[] = []
    let cur: PageMeta | undefined = pages.find((p) => p.id === page.id)
    const guard = new Set<string>()
    while (cur && cur.parentId && !guard.has(cur.id)) {
      guard.add(cur.id)
      const parent: PageMeta | undefined = pages.find((p) => p.id === cur!.parentId)
      if (!parent) break
      chain.unshift(parent)
      cur = parent
    }
    return chain
  }, [pages, page.id])

  const statusColor =
    saveStatus === 'saved'
      ? 'bg-emerald-500'
      : saveStatus === 'saving'
        ? 'bg-amber-500 animate-pulse'
        : 'bg-destructive'

  const isDatabase = page.kind === 'database'

  const readingTime = readingMinutes(stats.words)
  const readingLabel =
    readingTime === 1 ? t('focusReadingTimeOne') : t('focusReadingTimeMany', { n: readingTime })

  const coverStyle = coverToStyle(page.cover)
  const coverIsUrl = page.cover ? isCoverUrl(page.cover) : false
  const hasCover = page.cover != null

  const iconTriggerClass =
    'mt-1 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-2xl transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

  return (
    <div className={cn('relative w-full', focus ? 'pb-28' : 'pb-24')}>
      {/* Copertina (sopra breadcrumb, larghezza piena) */}
      {hasCover ? (
        <div className="h-32 w-full sm:h-40" role="img" aria-label={t('coverPageImage')}>
          {coverIsUrl ? (
            <img src={page.cover ?? undefined} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-cover bg-center" style={coverStyle ?? undefined} />
          )}
        </div>
      ) : null}

      <div
        className={cn(
          'mx-auto w-full px-4 sm:px-8',
          focus ? 'max-w-2xl' : isDatabase ? 'max-w-5xl' : 'max-w-3xl',
          hasCover ? 'pt-3' : focus ? 'pt-16' : 'pt-6'
        )}
      >
        {/* Breadcrumb (nascosta in modalità focus) */}
        {!focus ? (
        <nav
          aria-label="breadcrumb"
          className="mb-3 flex min-h-6 flex-wrap items-center gap-0.5 text-sm text-muted-foreground"
        >
          <span className="px-1">{t('breadcrumbsRoot')}</span>
          {breadcrumbs.map((crumb) => (
            <React.Fragment key={crumb.id}>
              <ChevronRight className="size-3.5 shrink-0" aria-hidden />
              <span className="max-w-40 truncate px-1">
                {crumb.icon ? `${crumb.icon} ` : ''}
                {crumb.title.trim() || t('untitled')}
              </span>
            </React.Fragment>
          ))}
          <ChevronRight className="size-3.5 shrink-0" aria-hidden />
          <span className="max-w-40 truncate px-1 font-medium text-foreground">
            {page.icon ? `${page.icon} ` : ''}
            {titleDraft.trim() || t('untitled')}
          </span>
        </nav>
        ) : null}

        {/* Icona sovrapposta alla copertina (stile Notion) */}
        {hasCover ? (
          <div className="-mt-11 mb-1 flex">
            <EmojiPicker value={page.icon} onPick={onIconChange} align="start">
              <button
                type="button"
                title={page.icon ? t('changeIcon') : t('addIcon')}
                aria-label={page.icon ? t('changeIcon') : t('addIcon')}
                className="flex size-16 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-background/70 text-5xl ring-4 ring-background backdrop-blur transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {page.icon ?? <span className="text-xl text-muted-foreground">⊕</span>}
              </button>
            </EmojiPicker>
          </div>
        ) : null}

        {/* Intestazione pagina: icona (solo senza copertina) + titolo + azioni */}
        <div className="mb-2 flex items-start gap-3">
          {!hasCover ? (
            <EmojiPicker value={page.icon} onPick={onIconChange} align="start">
              <button
                type="button"
                title={page.icon ? t('changeIcon') : t('addIcon')}
                aria-label={page.icon ? t('changeIcon') : t('addIcon')}
                className={iconTriggerClass}
              >
                {page.icon ?? <span className="text-base text-muted-foreground">⊕</span>}
              </button>
            </EmojiPicker>
          ) : null}

          <input
            value={titleDraft}
            onChange={(e) => {
              setTitleDraft(e.target.value)
              onTitleChange(e.target.value)
            }}
            placeholder={t('untitled')}
            aria-label={t('untitled')}
            className="min-w-0 flex-1 self-center bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/50 focus:outline-none focus-visible:ring-0"
          />

          <div className="mt-1 flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'size-8 cursor-pointer text-muted-foreground hover:text-foreground',
                page.isFavorite && 'text-amber-500 hover:text-amber-500'
              )}
              onClick={() => onToggleFavorite(!page.isFavorite)}
              aria-label={page.isFavorite ? t('unfavoriteAction') : t('favoriteAction')}
              title={page.isFavorite ? t('unfavoriteAction') : t('favoriteAction')}
            >
              <Star
                className={cn('size-4', page.isFavorite && 'fill-amber-400 text-amber-400')}
                aria-hidden
              />
            </Button>
            {/* Ancora zero-size del popover copertina (aperto dal menu qui sotto) */}
            <CoverPicker
              open={coverPickerOpen}
              onOpenChange={setCoverPickerOpen}
              current={page.cover}
              onApply={onCoverChange}
            >
              <span aria-hidden className="size-0" />
            </CoverPicker>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 cursor-pointer text-muted-foreground hover:text-foreground"
                  aria-label={t('moreActions')}
                  title={t('moreActions')}
                >
                  <MoreHorizontal className="size-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={() => setCoverPickerOpen(true)}>
                  <ImageIcon className="size-4" aria-hidden />
                  {t('coverChange')}
                </DropdownMenuItem>
                {hasCover ? (
                  <DropdownMenuItem onSelect={() => onCoverChange(null)}>
                    <ImageOff className="size-4" aria-hidden />
                    {t('coverRemove')}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDuplicate}>
                  <Copy className="size-4" aria-hidden />
                  {t('duplicateAction')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onExport}>
                  <Download className="size-4" aria-hidden />
                  {t('exportPageAction')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onOpenHistory}>
                  <Clock className="size-4" aria-hidden />
                  {t('historyAction')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={onTrash}>
                  <Trash2 className="size-4" aria-hidden />
                  {t('trashAction')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Contenuto: editor a blocchi oppure vista database */}
        {database ?? (
          <PageEditor
            pageId={page.id}
            initialBlocks={page.blocks}
            resetSignal={resetSignal}
            onChange={onBlocksChange}
            onOpenPage={onOpenPage}
            typewriter={focus && typewriter}
          />
        )}

        {/* Collegamenti in entrata */}
        {!focus ? (
          <BacklinksSection pageId={page.id} onSelectPage={onOpenPage} onCount={onBacklinksCount} />
        ) : null}

        {/* Statistiche di fine pagina (solo documenti, non in focus) */}
        {!isDatabase && !focus ? (
          <p className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
            <span>
              {stats.words} {t('statusWords')}
            </span>
            <span aria-hidden>·</span>
            <span>
              {stats.chars} {t('statsChars')}
            </span>
            <span aria-hidden>·</span>
            <span>{readingLabel}</span>
          </p>
        ) : null}

        {/* Barra di stato */}
        <div className="pointer-events-none fixed bottom-12 left-1/2 z-10 -translate-x-1/2 lg:bottom-14">
          <div
            className={cn(
              'flex items-center gap-2 rounded-full border bg-background/90 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur transition-opacity',
              saveStatus === 'saved' ? 'opacity-0' : 'opacity-100'
            )}
            role="status"
            aria-live="polite"
          >
            <span className={cn('size-1.5 rounded-full', statusColor)} aria-hidden />
            {saveStatus === 'saving'
              ? t('statusSaving')
              : saveStatus === 'error'
                ? t('statusSaveError')
                : t('statusSaved')}
          </div>
        </div>
        <p className="sr-only" aria-live="polite">
          {saveStatus === 'saving'
            ? t('statusSaving')
            : saveStatus === 'error'
              ? t('statusSaveError')
              : `${t('statusSaved')} — ${stats.words} ${t('statusWords')}, ${stats.blocks} ${t('statusBlocks')}`}
        </p>
      </div>

      {/* Pillola statistiche della modalità focus */}
      {focus && !isDatabase ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-4">
          <div
            className="pointer-events-auto flex items-center gap-2.5 rounded-full border bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur"
            role="status"
          >
            <span className={cn('size-1.5 rounded-full', statusColor)} aria-hidden />
            <span>
              {stats.words} {t('statusWords')}
            </span>
            <span aria-hidden>·</span>
            <span>{readingLabel}</span>
            <span aria-hidden>·</span>
            <button
              type="button"
              onClick={() => setTypewriter(!typewriter)}
              aria-pressed={typewriter}
              title={`${t('focusTypewriter')} — ${t('focusTypewriterHint')}`}
              aria-label={t('focusTypewriter')}
              className={cn(
                'flex size-6 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                typewriter && 'bg-accent text-accent-foreground'
              )}
            >
              <Type className="size-3.5" aria-hidden />
            </button>
            {onExitFocus ? (
              <button
                type="button"
                onClick={onExitFocus}
                title={`${t('focusExit')} (Esc)`}
                aria-label={t('focusExit')}
                className="flex size-6 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
