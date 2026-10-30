'use client'

/**
 * Taccuino — barra laterale: albero delle pagine con drag & drop
 * (zone: sopra / sotto / dentro), preferiti, cestino, import/export,
 * tema e lingua.
 *
 * Il drag & drop usa l'API HTML5 nativa: tre zone determinate dalla
 * posizione orizzontale del puntatore (30% sinistra = prima, 30% destra =
 * dopo, centro = annida come figlia). Calcolo e validazioni (niente drop
 * dentro i propri discendenti) lato client, PATCH al backend poi refresh.
 */
import * as React from 'react'
import {
  ChevronRight,
  Download,
  FileText,
  Flame,
  Languages,
  MoreHorizontal,
  Moon,
  PanelLeftClose,
  Palette,
  Plus,
  Search,
  Star,
  Sun,
  Table2,
  Trash2,
  Upload,
  Waypoints,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useI18n } from '@/lib/i18n'
import type { PageMeta } from '@/lib/types'
import { cn } from '@/lib/utils'
import { AccentPicker } from './accent-picker'
import { ActivityPopover } from './activity-popover'
import { Logo } from './logo'

export type DropZone = 'before' | 'after' | 'inside'

export interface SidebarProps {
  pages: PageMeta[]
  selectedId: string | null
  expandedIds: ReadonlySet<string>
  onToggleExpand: (id: string) => void
  onSelect: (id: string) => void
  onCreatePage: (parentId: string | null) => void
  onMovePage: (draggedId: string, targetId: string, zone: DropZone) => void
  onToggleFavorite: (id: string, favorite: boolean) => void
  onDuplicatePage: (id: string) => void
  onExportPage: (id: string) => void
  onTrashPage: (id: string) => void
  onOpenSearch: () => void
  onOpenImport: () => void
  onOpenTrash: () => void
  onOpenGraph: () => void
  onExportZip: () => void
  onCollapse: () => void
}

interface RowProps {
  page: PageMeta
  depth: number
  hasChildren: boolean
  expanded: boolean
  selected: boolean
  isDescendantOfSelected?: boolean
  onSelect: () => void
  onToggleExpand: () => void
  onCreateChild: () => void
  onToggleFavorite: (favorite: boolean) => void
  onDuplicate: () => void
  onExport: () => void
  onTrash: () => void
  onDragStartPage: (id: string) => void
  onDragEndPage: () => void
  onDropPage: (draggedId: string, targetId: string, zone: DropZone) => void
  pages: PageMeta[]
  isDragging: boolean
}

function PageRow(props: RowProps) {
  const { t } = useI18n()
  const {
    page,
    depth,
    hasChildren,
    expanded,
    selected,
    onSelect,
    onToggleExpand,
    onCreateChild,
    onToggleFavorite,
    onDuplicate,
    onExport,
    onTrash,
    onDragStartPage,
    onDragEndPage,
    onDropPage,
    pages,
    isDragging,
  } = props

  const [dropZone, setDropZone] = React.useState<DropZone | null>(null)
  const rowRef = React.useRef<HTMLDivElement | null>(null)

  /** true se `maybeAncestorId` è un antenato di `pageId` (catena parentId). */
  const isAncestor = React.useCallback(
    (maybeAncestorId: string, pageId: string): boolean => {
      let cur = pages.find((p) => p.id === pageId)
      while (cur && cur.parentId) {
        if (cur.parentId === maybeAncestorId) return true
        cur = pages.find((p) => p.id === cur!.parentId)
      }
      return false
    },
    [pages]
  )

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes('application/x-taccuino-page')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const rel = (e.clientX - rect.left) / rect.width
    const zone: DropZone = rel < 0.3 ? 'before' : rel > 0.7 ? 'after' : 'inside'
    setDropZone(zone)
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const draggedId = e.dataTransfer.getData('application/x-taccuino-page')
    setDropZone(null)
    if (!draggedId || draggedId === page.id) return
    if (isAncestor(draggedId, page.id)) return // mai dentro i propri discendenti
    const rect = e.currentTarget.getBoundingClientRect()
    const rel = (e.clientX - rect.left) / rect.width
    const zone: DropZone = rel < 0.3 ? 'before' : rel > 0.7 ? 'after' : 'inside'
    onDropPage(draggedId, page.id, zone)
  }

  return (
    <div
      ref={rowRef}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-taccuino-page', page.id)
        e.dataTransfer.effectAllowed = 'move'
        onDragStartPage(page.id)
      }}
      onDragEnd={onDragEndPage}
      onDragOver={onDragOver}
      onDragLeave={() => setDropZone(null)}
      onDrop={onDrop}
      style={{ paddingLeft: depth * 14 }}
      className={cn(
        'group/row relative flex items-center gap-0.5 rounded-md py-0.5 pr-1 transition-colors',
        'hover:bg-sidebar-accent',
        selected && 'bg-sidebar-accent font-medium',
        isDragging && 'opacity-40',
        dropZone === 'inside' && 'ring-2 ring-inset ring-primary',
        dropZone === 'before' && 'before:absolute before:inset-x-1 before:top-0 before:h-0.5 before:rounded-full before:bg-primary',
        dropZone === 'after' && 'after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary'
      )}
    >
      <button
        type="button"
        aria-label={t('toggleSidebar')}
        aria-expanded={expanded}
        onClick={onToggleExpand}
        className={cn(
          'flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground transition-transform hover:bg-accent',
          !hasChildren && 'invisible pointer-events-none',
          expanded && 'rotate-90'
        )}
        tabIndex={hasChildren ? 0 : -1}
      >
        <ChevronRight className="size-3.5" aria-hidden />
      </button>

      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'page' : undefined}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-sm px-1 py-1 text-left text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {page.icon ? (
          <span aria-hidden className="shrink-0 text-sm leading-none">{page.icon}</span>
        ) : (
          <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <span className="truncate">{page.title.trim() || t('untitled')}</span>
        {page.kind === 'database' ? (
          <Table2 className="size-3 shrink-0 text-muted-foreground" aria-hidden />
        ) : null}
      </button>

      {page.isFavorite ? (
        <Star className="size-3 shrink-0 fill-amber-400 text-amber-400" aria-hidden />
      ) : null}

      <span className="flex shrink-0 items-center opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          title={t('newPage')}
          aria-label={t('newPage')}
          onClick={onCreateChild}
          className="flex size-5 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <Plus className="size-3.5" aria-hidden />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title={t('moreActions')}
              aria-label={t('moreActions')}
              className="flex size-5 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <MoreHorizontal className="size-3.5" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="right" className="w-44">
            <DropdownMenuItem onClick={() => onToggleFavorite(!page.isFavorite)}>
              <Star className="size-4" aria-hidden />
              {page.isFavorite ? t('unfavoriteAction') : t('favoriteAction')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Plus className="size-4" aria-hidden />
              {t('duplicateAction')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExport}>
              <Download className="size-4" aria-hidden />
              {t('exportPageAction')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onTrash}>
              <Trash2 className="size-4" aria-hidden />
              {t('trashAction')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </div>
  )
}

export function Sidebar(props: SidebarProps) {
  const {
    pages,
    selectedId,
    expandedIds,
    onToggleExpand,
    onSelect,
    onCreatePage,
    onMovePage,
    onToggleFavorite,
    onDuplicatePage,
    onExportPage,
    onTrashPage,
    onOpenSearch,
    onOpenImport,
    onOpenTrash,
    onOpenGraph,
    onExportZip,
    onCollapse,
  } = props
  const { t, lang, setLang } = useI18n()
  const { theme, setTheme } = useTheme()
  const [draggingId, setDraggingId] = React.useState<string | null>(null)

  const livePages = React.useMemo(() => pages.filter((p) => p.deletedAt === null), [pages])
  const trashedCount = React.useMemo(
    () => pages.filter((p) => p.deletedAt !== null).length,
    [pages]
  )
  const favorites = React.useMemo(
    () => livePages.filter((p) => p.isFavorite).sort((a, b) => a.title.localeCompare(b.title)),
    [livePages]
  )

  const childrenOf = React.useCallback(
    (parentId: string | null): PageMeta[] =>
      livePages
        .filter((p) => p.parentId === parentId)
        .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt)),
    [livePages]
  )

  const renderTree = (parentId: string | null, depth: number): React.ReactNode =>
    childrenOf(parentId).map((page) => {
      const hasChildren = childrenOf(page.id).length > 0
      const expanded = expandedIds.has(page.id)
      return (
        <React.Fragment key={page.id}>
          <PageRow
            page={page}
            depth={depth}
            hasChildren={hasChildren}
            expanded={expanded}
            selected={selectedId === page.id}
            onSelect={() => onSelect(page.id)}
            onToggleExpand={() => onToggleExpand(page.id)}
            onCreateChild={() => onCreatePage(page.id)}
            onToggleFavorite={(favorite) => onToggleFavorite(page.id, favorite)}
            onDuplicate={() => onDuplicatePage(page.id)}
            onExport={() => onExportPage(page.id)}
            onTrash={() => onTrashPage(page.id)}
            onDragStartPage={setDraggingId}
            onDragEndPage={() => setDraggingId(null)}
            onDropPage={onMovePage}
            pages={pages}
            isDragging={draggingId === page.id}
          />
          {hasChildren && expanded ? renderTree(page.id, depth + 1) : null}
        </React.Fragment>
      )
    })

  const iconButtonClass =
    'flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Intestazione */}
      <div className="flex h-12 shrink-0 items-center gap-2 px-3">
        <Logo className="size-6 shrink-0" />
        <span className="truncate text-sm font-semibold tracking-tight">{t('appName')}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto size-7 cursor-pointer text-muted-foreground"
              onClick={onCollapse}
              aria-label={t('toggleSidebar')}
            >
              <PanelLeftClose className="size-4" aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{t('toggleSidebar')}</TooltipContent>
        </Tooltip>
      </div>

      {/* Ricerca + nuova pagina */}
      <div className="flex shrink-0 flex-col gap-1 px-3 pb-2">
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-md border border-sidebar-border bg-background/60 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <Search className="size-3.5 shrink-0" aria-hidden />
          <span className="flex-1 truncate text-left">{t('searchPlaceholder')}</span>
          <kbd className="hidden shrink-0 rounded border border-sidebar-border px-1 font-mono text-[10px] text-muted-foreground sm:inline">
            Ctrl K
          </kbd>
        </button>
        <Button
          size="sm"
          className="h-8 w-full cursor-pointer justify-start gap-2"
          onClick={() => onCreatePage(null)}
        >
          <Plus className="size-4" aria-hidden />
          {t('newPage')}
        </Button>
      </div>

      {/* Albero + sezioni */}
      <ScrollArea className="min-h-0 flex-1">
        <nav aria-label={t('sidebarSectionPages')} className="flex flex-col gap-4 px-3 pb-4">
          {favorites.length > 0 ? (
            <section aria-label={t('favoritesSection')}>
              <h3 className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t('favoritesSection')}
              </h3>
              <div className="flex flex-col">
                {favorites.map((page) => (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() => onSelect(page.id)}
                    aria-current={selectedId === page.id ? 'page' : undefined}
                    className={cn(
                      'flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-1 text-left text-sm transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                      selectedId === page.id && 'bg-sidebar-accent font-medium'
                    )}
                  >
                    <span aria-hidden className="shrink-0 text-sm leading-none">
                      {page.icon ?? '⭐'}
                    </span>
                    <span className="truncate">{page.title.trim() || t('untitled')}</span>
                    {page.kind === 'database' ? (
                      <Table2 className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                    ) : null}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section aria-label={t('pagesSection')}>
            <h3 className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t('pagesSection')}
            </h3>
            <div className="flex flex-col">
              {livePages.length > 0 ? (
                renderTree(null, 0)
              ) : (
                <p className="px-1 py-2 text-xs text-muted-foreground">{t('noPagesYet')}</p>
              )}
            </div>
          </section>
        </nav>
      </ScrollArea>

      {/* Cestino */}
      <Separator className="shrink-0" />
      <div className="shrink-0 px-3 py-1.5">
        <button
          type="button"
          onClick={onOpenTrash}
          className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <Trash2 className="size-4 shrink-0" aria-hidden />
          <span className="flex-1 text-left">{t('trashSection')}</span>
          {trashedCount > 0 ? (
            <span className="rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {trashedCount}
            </span>
          ) : null}
        </button>
      </div>

      {/* Azioni fondo barra */}
      <div className="flex h-11 shrink-0 items-center gap-0.5 border-t border-sidebar-border px-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={iconButtonClass}
              onClick={onOpenImport}
              aria-label={t('importAction')}
            >
              <Upload className="size-4" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{t('importAction')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={iconButtonClass}
              onClick={onExportZip}
              aria-label={t('exportAllAction')}
            >
              <Download className="size-4" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{t('exportAllAction')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={iconButtonClass}
              onClick={onOpenGraph}
              aria-label={t('graphTitle')}
            >
              <Waypoints className="size-4" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{t('graphTitle')}</TooltipContent>
        </Tooltip>
        <span className="flex-1" />
        <ActivityPopover>
          <button type="button" className={iconButtonClass} aria-label={t('activityTitle')}>
            <Flame className="size-4" aria-hidden />
          </button>
        </ActivityPopover>
        <AccentPicker>
          <button type="button" className={iconButtonClass} aria-label={t('accentTitle')}>
            <Palette className="size-4" aria-hidden />
          </button>
        </AccentPicker>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={iconButtonClass}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={t('themeToggle')}
            >
              {theme === 'dark' ? (
                <Sun className="size-4" aria-hidden />
              ) : (
                <Moon className="size-4" aria-hidden />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {t('themeToggle')} — {theme === 'dark' ? t('themeLight') : t('themeDark')}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={iconButtonClass}
              onClick={() => setLang(lang === 'it' ? 'en' : 'it')}
              aria-label={t('langToggle')}
            >
              <Languages className="size-4" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{t('langToggle')}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
