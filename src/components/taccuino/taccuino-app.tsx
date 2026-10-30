'use client'

/**
 * Taccuino — guscio dell'applicazione: sidebar + vista pagina + palette di
 * ricerca + cestino + cronologia + importazione, con salvataggio automatico
 * (debounce 700 ms, flush prima di cambiare pagina e prima di chiudere).
 */
import * as React from 'react'
import {
  Github,
  Heart,
  Keyboard,
  Link2,
  ListTree,
  Maximize2,
  Menu,
  PanelLeftOpen,
  Search,
  Sparkles,
  Waypoints,
  Zap,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useI18n } from '@/lib/i18n'
import { usePrefsStore } from '@/lib/prefs-store'
import type { Block, DatabaseProperty, DatabaseRow, PageMeta, PageWithBlocks } from '@/lib/types'
import { cn } from '@/lib/utils'
import { DatabaseView } from './database/database-view'
import { GraphView } from './graph-view'
import { Logo } from './logo'
import { OutlinePanel } from './outline-panel'
import { PageView, type PageStats, type SaveStatus } from './page-view'
import { SearchPalette } from './search-palette'
import { ShortcutsDialog } from './shortcuts-dialog'
import { Sidebar, type DropZone } from './sidebar'
import { TemplateDialog } from './template-dialog'
import { TrashDialog } from './trash-dialog'
import { VersionHistory } from './version-history'
import { ImportDialog } from './import-dialog'

const AUTOSAVE_DELAY = 700
const TITLE_DELAY = 600

interface PendingSave {
  pageId: string
  blocks: Block[]
  timer: ReturnType<typeof setTimeout>
}

function plainTextOfBlocks(blocks: Block[]): { words: number; chars: number } {
  let words = 0
  let chars = 0
  for (const b of blocks) {
    const text = b.content
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
    chars += text.replace(/\s/g, '').length
    for (const w of text.split(/\s+/)) {
      if (w.length > 0) words += 1
    }
  }
  return { words, chars }
}

interface PageDataResponse {
  page: PageMeta
  blocks?: Block[]
  database?: { properties: DatabaseProperty[] }
  rows?: DatabaseRow[]
}

export function TaccuinoApp() {
  const { t } = useI18n()
  const accent = usePrefsStore((s) => s.accent)

  // ---- stato ----
  const [pages, setPages] = React.useState<PageMeta[]>([])
  const [pagesLoaded, setPagesLoaded] = React.useState(false)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [currentPage, setCurrentPage] = React.useState<PageWithBlocks | null>(null)
  const [databaseData, setDatabaseData] = React.useState<{
    properties: DatabaseProperty[]
    rows: DatabaseRow[]
  } | null>(null)
  const [rowsCount, setRowsCount] = React.useState(0)
  const [backlinksCount, setBacklinksCount] = React.useState(0)
  const [resetSignal, setResetSignal] = React.useState(0)
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>('saved')
  const [stats, setStats] = React.useState<PageStats>({ words: 0, blocks: 0, chars: 0 })
  const [expandedIds, setExpandedIds] = React.useState<ReadonlySet<string>>(new Set())

  const [searchOpen, setSearchOpen] = React.useState(false)
  const [trashOpen, setTrashOpen] = React.useState(false)
  const [importOpen, setImportOpen] = React.useState(false)
  const [historyOpen, setHistoryOpen] = React.useState(false)
  const [templateOpen, setTemplateOpen] = React.useState(false)
  const [templateParentId, setTemplateParentId] = React.useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = React.useState(true)
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false)

  // ---- funzioni uniche ----
  const [focusMode, setFocusMode] = React.useState(false)
  const [graphOpen, setGraphOpen] = React.useState(false)
  const [outlineOpen, setOutlineOpen] = React.useState(false)
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false)
  /** Blocchi live della pagina corrente (per struttura e diff versione). */
  const [liveBlocks, setLiveBlocks] = React.useState<Block[]>([])

  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const pendingSaveRef = React.useRef<PendingSave | null>(null)
  const titleTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const pagesRef = React.useRef<PageMeta[]>([])
  pagesRef.current = pages

  // ---- accento cromatico: applicato alle variabili CSS ----
  React.useEffect(() => {
    document.documentElement.dataset.accent = accent
  }, [accent])

  // ---- refresh pagine ----
  const refreshPages = React.useCallback(async (): Promise<PageMeta[]> => {
    const res = await fetch('/api/pages')
    if (!res.ok) throw new Error(String(res.status))
    const data = (await res.json()) as { pages: PageMeta[] }
    setPages(data.pages)
    return data.pages
  }, [])

  // ---- selezione pagina (con flush del salvataggio pendente) ----
  const flushSave = React.useCallback(() => {
    const pending = pendingSaveRef.current
    if (pending) {
      clearTimeout(pending.timer)
      pendingSaveRef.current = null
      void fetch(`/api/pages/${pending.pageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks: pending.blocks }),
        keepalive: true,
      }).catch(() => undefined)
    }
    if (titleTimerRef.current) {
      clearTimeout(titleTimerRef.current)
      titleTimerRef.current = null
    }
  }, [])

  React.useEffect(() => {
    const onBeforeUnload = () => flushSave()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      flushSave()
    }
  }, [flushSave])

  const selectPage = React.useCallback(
    async (id: string) => {
      flushSave()
      setSaveStatus('saved')
      setSelectedId(id)
      setCurrentPage(null)
      setMobileNavOpen(false)
      try {
        const res = await fetch(`/api/pages/${id}`)
        if (!res.ok) throw new Error(String(res.status))
        const data = (await res.json()) as PageDataResponse
        setCurrentPage({ ...data.page, blocks: data.blocks ?? [] })
        setDatabaseData(
          data.database
            ? { properties: data.database.properties ?? [], rows: data.rows ?? [] }
            : null
        )
        setRowsCount(data.rows?.length ?? 0)
        setBacklinksCount(0)
        if (data.blocks) {
          setStats({
            words: plainTextOfBlocks(data.blocks).words,
            blocks: data.blocks.length,
            chars: plainTextOfBlocks(data.blocks).chars,
          })
          setLiveBlocks(data.blocks)
        } else {
          setStats({ words: 0, blocks: 0, chars: 0 })
          setLiveBlocks([])
        }
        setResetSignal((s) => s + 1)
        // espandi gli antenati così la pagina è visibile nell'albero
        setExpandedIds((prev) => {
          const next = new Set(prev)
          let cur = pagesRef.current.find((p) => p.id === id)
          const guard = new Set<string>()
          while (cur && cur.parentId && !guard.has(cur.id)) {
            guard.add(cur.id)
            next.add(cur.parentId)
            const parent: PageMeta | undefined = pagesRef.current.find(
              (p) => p.id === cur!.parentId
            )
            if (!parent) break
            cur = parent
          }
          return next
        })
      } catch {
        toast.error(t('errorGeneric'))
        setSelectedId(null)
      }
    },
    [flushSave, t]
  )

  React.useEffect(() => {
    if (selectedId && pagesLoaded) {
      const stillThere = pages.some((p) => p.id === selectedId && p.deletedAt === null)
      if (!stillThere) {
        flushSave()
        setSelectedId(null)
        setCurrentPage(null)
      }
    }
  }, [pages, pagesLoaded, selectedId, flushSave])

  // ---- caricamento iniziale (dopo selectPage, che ne dipende a livello di definizione) ----
  const didInitRef = React.useRef(false)
  React.useEffect(() => {
    if (didInitRef.current) return
    didInitRef.current = true
    let cancelled = false
    refreshPages()
      .then(async (list) => {
        if (cancelled) return
        setPagesLoaded(true)
        const first = list
          .filter((p) => p.deletedAt === null && p.parentId === null)
          .sort((a, b) => a.position - b.position)[0]
        if (first) await selectPage(first.id)
      })
      .catch(() => {
        if (!cancelled) {
          setPagesLoaded(true)
          toast.error(t('errorGeneric'))
        }
      })
    return () => {
      cancelled = true
    }
    // con guardia didInitRef: seleziona la prima pagina e ne carica il contenuto.
  }, [refreshPages, selectPage, t])

  // ---- mutazioni ----
  /** Apre il dialog dei modelli: la creazione vera avviene in TemplateDialog. */
  const openTemplateDialog = React.useCallback((parentId: string | null) => {
    setTemplateParentId(parentId)
    setTemplateOpen(true)
  }, [])

  /** Dopo la creazione da modello: refresh albero, espansione, selezione. */
  const handleTemplateCreated = React.useCallback(
    async (pageId: string) => {
      try {
        await refreshPages()
        if (templateParentId) {
          setExpandedIds((prev) => new Set(prev).add(templateParentId))
        }
        toast.success(t('pageCreated'))
        await selectPage(pageId)
      } catch {
        toast.error(t('errorGeneric'))
      }
    },
    [refreshPages, selectPage, t, templateParentId]
  )

  const duplicatePage = React.useCallback(
    async (id: string) => {
      try {
        const srcRes = await fetch(`/api/pages/${id}`)
        if (!srcRes.ok) throw new Error(String(srcRes.status))
        const src = (await srcRes.json()) as { page: PageMeta; blocks: Block[] }
        const createRes = await fetch('/api/pages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parentId: src.page.parentId,
            title: src.page.title,
            icon: src.page.icon,
          }),
        })
        if (!createRes.ok) throw new Error(String(createRes.status))
        const created = (await createRes.json()) as { page: PageMeta }
        await fetch(`/api/pages/${created.page.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blocks: src.blocks }),
        })
        await refreshPages()
        toast.success(t('pageDuplicated'))
      } catch {
        toast.error(t('errorGeneric'))
      }
    },
    [refreshPages, t]
  )

  const patchPage = React.useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      try {
        const res = await fetch(`/api/pages/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        if (!res.ok) throw new Error(String(res.status))
        await refreshPages()
        return true
      } catch {
        toast.error(t('errorGeneric'))
        return false
      }
    },
    [refreshPages, t]
  )

  const trashPage = React.useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/pages/${id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error(String(res.status))
        toast.success(t('trashedPage'))
        const list = await refreshPages()
        if (selectedId === id) {
          const next = list
            .filter((p) => p.deletedAt === null && p.parentId === null)
            .sort((a, b) => a.position - b.position)[0]
          if (next) await selectPage(next.id)
          else {
            setSelectedId(null)
            setCurrentPage(null)
          }
        }
      } catch {
        toast.error(t('errorGeneric'))
      }
    },
    [refreshPages, selectPage, selectedId, t]
  )

  /** Sposta una pagina: ricalcola l'ordine dei fratelli e applica le PATCH. */
  const movePage = React.useCallback(
    async (draggedId: string, targetId: string, zone: DropZone) => {
      const all = pagesRef.current
      const dragged = all.find((p) => p.id === draggedId)
      const target = all.find((p) => p.id === targetId)
      if (!dragged || !target) return

      const live = (parentId: string | null) =>
        all
          .filter((p) => p.parentId === parentId && p.deletedAt === null)
          .sort((a, b) => a.position - b.position)

      let newParentId: string | null
      let order: string[]
      if (zone === 'inside') {
        newParentId = targetId
        order = live(targetId)
          .filter((p) => p.id !== draggedId)
          .map((p) => p.id)
        order.push(draggedId)
        setExpandedIds((prev) => new Set(prev).add(targetId))
      } else {
        newParentId = target.parentId
        order = live(newParentId)
          .filter((p) => p.id !== draggedId)
          .map((p) => p.id)
        const idx = order.indexOf(targetId)
        order.splice(idx + (zone === 'after' ? 1 : 0), 0, draggedId)
      }

      try {
        // prima la pagina trascinata (parentId + posizione), poi i fratelli spostati
        await patchPage(draggedId, { parentId: newParentId, position: order.indexOf(draggedId) })
        await Promise.all(
          order
            .map((id, index) => ({ id, index }))
            .filter(({ id, index }) => id !== draggedId && live(newParentId).find((p) => p.id === id)?.position !== index)
            .map(({ id, index }) =>
              fetch(`/api/pages/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ position: index }),
              })
            )
        )
        await refreshPages()
      } catch {
        toast.error(t('errorGeneric'))
      }
    },
    [patchPage, refreshPages, t]
  )

  // ---- salvataggio automatico ----
  const onBlocksChange = React.useCallback(
    (blocks: Block[]) => {
      const pageId = currentPage?.id
      if (!pageId) return
      setSaveStatus('saving')
      setLiveBlocks(blocks)
      const pending = pendingSaveRef.current
      if (pending) clearTimeout(pending.timer)
      const timer = setTimeout(async () => {
        pendingSaveRef.current = null
        try {
          const res = await fetch(`/api/pages/${pageId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ blocks }),
          })
          if (!res.ok) throw new Error(String(res.status))
          setSaveStatus('saved')
          const counted = plainTextOfBlocks(blocks)
          setStats({ words: counted.words, blocks: blocks.length, chars: counted.chars })
        } catch {
          setSaveStatus('error')
        }
      }, AUTOSAVE_DELAY)
      pendingSaveRef.current = { pageId, blocks, timer }
      setStats((s) => ({ ...s, blocks: blocks.length, chars: plainTextOfBlocks(blocks).chars }))
    },
    [currentPage]
  )

  const onTitleChange = React.useCallback(
    (title: string) => {
      const pageId = currentPage?.id
      if (!pageId) return
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current)
      titleTimerRef.current = setTimeout(async () => {
        titleTimerRef.current = null
        try {
          const res = await fetch(`/api/pages/${pageId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title }),
          })
          if (res.ok) await refreshPages()
        } catch {
          /* il titolo si risincronizza al prossimo cambio */
        }
      }, TITLE_DELAY)
    },
    [currentPage, refreshPages]
  )

  const onIconChange = React.useCallback(
    (icon: string | null) => {
      if (!currentPage) return
      setCurrentPage((p) => (p ? { ...p, icon } : p))
      void patchPage(currentPage.id, { icon })
    },
    [currentPage, patchPage]
  )

  const onToggleFavorite = React.useCallback(
    (favorite: boolean) => {
      if (!currentPage) return
      setCurrentPage((p) => (p ? { ...p, isFavorite: favorite } : p))
      void patchPage(currentPage.id, { isFavorite: favorite })
    },
    [currentPage, patchPage]
  )

  const onCoverChange = React.useCallback(
    (cover: string | null) => {
      if (!currentPage) return
      setCurrentPage((p) => (p ? { ...p, cover } : p))
      void patchPage(currentPage.id, { cover })
    },
    [currentPage, patchPage]
  )

  const onExportPage = React.useCallback((id: string) => {
    window.location.assign(`/api/pages/${id}/export`)
  }, [])

  const onExportZip = React.useCallback(() => {
    toast.info(t('exportStarted'))
    window.location.assign('/api/export')
  }, [t])

  const onRestored = React.useCallback((page: PageMeta, blocks: Block[]) => {
    setCurrentPage((prev) => (prev && prev.id === page.id ? { ...page, blocks } : prev))
    const counted = plainTextOfBlocks(blocks)
    setStats({ words: counted.words, blocks: blocks.length, chars: counted.chars })
    setLiveBlocks(blocks)
    setResetSignal((s) => s + 1)
  }, [])

  // ---- scorciatoie globali ----
  const anyOverlayOpen = React.useCallback(
    () =>
      searchOpen ||
      trashOpen ||
      importOpen ||
      historyOpen ||
      templateOpen ||
      graphOpen ||
      shortcutsOpen ||
      mobileNavOpen,
    [
      searchOpen,
      trashOpen,
      importOpen,
      historyOpen,
      templateOpen,
      graphOpen,
      shortcutsOpen,
      mobileNavOpen,
    ]
  )

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
      if (mod && !e.shiftKey && key === 'k') {
        e.preventDefault()
        setSearchOpen((o) => !o)
        return
      }
      if (mod && e.shiftKey && key === 'f') {
        e.preventDefault()
        setFocusMode((f) => !f)
        return
      }
      if (mod && e.shiftKey && key === 'g') {
        e.preventDefault()
        setGraphOpen(true)
        return
      }
      if (mod && e.shiftKey && key === 'o') {
        e.preventDefault()
        setOutlineOpen((o) => !o)
        return
      }
      if (e.key === 'Escape' && !anyOverlayOpen()) {
        // esce dalla modalità focus solo se nessuna finestra è aperta e nessun
        // menu Radix ha già consumato l'evento
        if (document.querySelector('[data-radix-popper-content-wrapper]')) return
        setFocusMode(false)
        return
      }
      if (e.key === '?') {
        const target = e.target as HTMLElement | null
        const typing =
          target?.tagName === 'INPUT' ||
          target?.tagName === 'TEXTAREA' ||
          target?.isContentEditable === true
        if (!typing && !mod && !e.altKey) {
          e.preventDefault()
          setShortcutsOpen(true)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [anyOverlayOpen])

  // ---- service worker (PWA installabile) ----
  React.useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined)
    }
  }, [])

  const trashedPages = React.useMemo(
    () =>
      pages
        .filter((p) => p.deletedAt !== null)
        .sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? '')),
    [pages]
  )

  const sidebarNode = (
    <Sidebar
      pages={pages}
      selectedId={selectedId}
      expandedIds={expandedIds}
      onToggleExpand={(id) =>
        setExpandedIds((prev) => {
          const next = new Set(prev)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          return next
        })
      }
      onSelect={(id) => void selectPage(id)}
      onCreatePage={(parentId) => openTemplateDialog(parentId ?? null)}
      onMovePage={(draggedId, targetId, zone) => void movePage(draggedId, targetId, zone)}
      onToggleFavorite={(id, favorite) => void patchPage(id, { isFavorite: favorite })}
      onDuplicatePage={(id) => void duplicatePage(id)}
      onExportPage={onExportPage}
      onTrashPage={(id) => void trashPage(id)}
      onOpenSearch={() => setSearchOpen(true)}
      onOpenImport={() => setImportOpen(true)}
      onOpenTrash={() => setTrashOpen(true)}
      onOpenGraph={() => setGraphOpen(true)}
      onExportZip={onExportZip}
      onCollapse={() => setSidebarOpen(false)}
    />
  )

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-dvh flex-col overflow-hidden">
        <a
          href="#main-content"
          className="sr-only z-50 focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded-md focus:bg-primary focus:px-3 focus:py-1.5 focus:text-sm focus:text-primary-foreground"
        >
          {t('skipToContent')}
        </a>

        <div className="flex min-h-0 flex-1">
          {/* Sidebar desktop (nascosta in modalità focus) */}
          {!focusMode ? (
            <aside
              className={cn(
                'hidden w-72 shrink-0 border-r border-sidebar-border transition-[width] lg:block',
                !sidebarOpen && 'w-0 overflow-hidden border-r-0'
              )}
              aria-label={t('appName')}
            >
              {sidebarNode}
            </aside>
          ) : null}

          {/* Sidebar mobile (nascosta in modalità focus) */}
          {!focusMode ? (
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetContent side="left" className="w-72 gap-0 p-0" aria-describedby={undefined}>
                <SheetHeader className="sr-only">
                  <SheetTitle>{t('appName')}</SheetTitle>
                </SheetHeader>
                {sidebarNode}
              </SheetContent>
            </Sheet>
          ) : null}

          {/* Area principale */}
          <main
            id="main-content"
            aria-label={t('mainContentLabel')}
            className="relative flex min-w-0 flex-1 flex-col"
          >
            {/* Barra superiore (nascosta in modalità focus) */}
            {!focusMode ? (
              <header className="flex h-12 shrink-0 items-center gap-1 border-b px-2 sm:px-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 cursor-pointer text-muted-foreground lg:hidden"
                  onClick={() => setMobileNavOpen(true)}
                  aria-label={t('toggleSidebar')}
                >
                  <Menu className="size-4" aria-hidden />
                </Button>
                {!sidebarOpen ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hidden size-8 cursor-pointer text-muted-foreground lg:flex"
                    onClick={() => setSidebarOpen(true)}
                    aria-label={t('toggleSidebar')}
                  >
                    <PanelLeftOpen className="size-4" aria-hidden />
                  </Button>
                ) : null}
                <div className="flex min-w-0 flex-1 items-center gap-2 lg:hidden">
                  <Logo className="size-5 shrink-0" />
                  <span className="truncate text-sm font-semibold">{t('appName')}</span>
                </div>
                <div className="hidden min-w-0 flex-1 items-center gap-2 lg:flex">
                  <span className="truncate text-xs text-muted-foreground">
                    {currentPage
                      ? currentPage.kind === 'database'
                        ? `${rowsCount} ${t('dbRowsCount')}`
                        : `${stats.words} ${t('statusWords')} · ${stats.blocks} ${t('statusBlocks')}`
                      : t('appTagline')}
                  </span>
                </div>
                {currentPage && currentPage.kind === 'doc' ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'hidden size-8 cursor-pointer text-muted-foreground hover:text-foreground sm:flex',
                      outlineOpen && 'bg-accent text-accent-foreground'
                    )}
                    onClick={() => setOutlineOpen((o) => !o)}
                    aria-label={t('outlineTitle')}
                    aria-pressed={outlineOpen}
                    title={`${t('outlineTitle')} (Ctrl+Shift+O)`}
                  >
                    <ListTree className="size-4" aria-hidden />
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 cursor-pointer text-muted-foreground hover:text-foreground"
                  onClick={() => setGraphOpen(true)}
                  aria-label={t('graphTitle')}
                  title={`${t('graphTitle')} (Ctrl+Shift+G)`}
                >
                  <Waypoints className="size-4" aria-hidden />
                </Button>
                {currentPage && currentPage.kind === 'doc' ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 cursor-pointer text-muted-foreground hover:text-foreground"
                    onClick={() => setFocusMode(true)}
                    aria-label={t('focusMode')}
                    title={`${t('focusMode')} (Ctrl+Shift+F)`}
                  >
                    <Maximize2 className="size-4" aria-hidden />
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden size-8 cursor-pointer text-muted-foreground hover:text-foreground sm:flex"
                  onClick={() => setShortcutsOpen(true)}
                  aria-label={t('shortcutsTitle')}
                  title={t('shortcutsTitle')}
                >
                  <Keyboard className="size-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 cursor-pointer text-muted-foreground"
                  onClick={() => setSearchOpen(true)}
                  aria-label={t('search')}
                  title={`${t('search')} (Ctrl K)`}
                >
                  <Search className="size-4" aria-hidden />
                </Button>
              </header>
            ) : null}

            {/* Contenuto */}
            <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto">
              {outlineOpen && currentPage && currentPage.kind === 'doc' ? (
                <OutlinePanel blocks={liveBlocks} scrollContainerRef={scrollRef} />
              ) : null}
              {currentPage ? (
                <PageView
                  page={currentPage}
                  pages={pages}
                  saveStatus={saveStatus}
                  stats={stats}
                  resetSignal={resetSignal}
                  focus={focusMode}
                  database={
                    currentPage.kind === 'database' ? (
                      databaseData ? (
                        <DatabaseView
                          key={currentPage.id}
                          pageId={currentPage.id}
                          initialProperties={databaseData.properties}
                          initialRows={databaseData.rows}
                          onRowsCount={setRowsCount}
                        />
                      ) : (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                          {t('loading')}
                        </p>
                      )
                    ) : undefined
                  }
                  onBlocksChange={onBlocksChange}
                  onTitleChange={onTitleChange}
                  onIconChange={onIconChange}
                  onToggleFavorite={onToggleFavorite}
                  onCoverChange={onCoverChange}
                  onOpenPage={(id) => void selectPage(id)}
                  onBacklinksCount={setBacklinksCount}
                  onDuplicate={() => void duplicatePage(currentPage.id)}
                  onExport={() => onExportPage(currentPage.id)}
                  onOpenHistory={() => setHistoryOpen(true)}
                  onTrash={() => void trashPage(currentPage.id)}
                  onExitFocus={() => setFocusMode(false)}
                />
              ) : (
                <WelcomeScreen
                  pagesLoaded={pagesLoaded}
                  onCreatePage={() => openTemplateDialog(null)}
                  onOpenSearch={() => setSearchOpen(true)}
                />
              )}
            </div>

            {/* Footer sticky (nascosto in modalità focus) */}
            {!focusMode ? (
              <footer className="mt-auto flex h-9 shrink-0 items-center gap-3 border-t px-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Heart className="size-3" aria-hidden />
                  {t('appName')} — {t('appTagline')}
                </span>
                <span className="ml-auto flex items-center gap-3">
                  {backlinksCount > 0 ? (
                    <span className="flex items-center gap-1">
                      <Link2 className="size-3" aria-hidden />
                      {backlinksCount === 1
                        ? t('backlinksCountOne')
                        : t('backlinksCountMany', { n: backlinksCount })}
                    </span>
                  ) : null}
                  <span>{t('footerVersion')}</span>
                  <span>{t('footerLicense')}</span>
                </span>
              </footer>
            ) : null}
          </main>
        </div>
      </div>

      {/* Overlay e dialoghi */}
      <SearchPalette
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSelectPage={(id) => void selectPage(id)}
        onCreatePage={() => openTemplateDialog(null)}
        onOpenTrash={() => setTrashOpen(true)}
        onOpenImport={() => setImportOpen(true)}
        onExportZip={onExportZip}
      />
      <TemplateDialog
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        parentId={templateParentId}
        onCreated={handleTemplateCreated}
      />
      <TrashDialog
        open={trashOpen}
        onOpenChange={setTrashOpen}
        trashedPages={trashedPages}
        onRefresh={() => void refreshPages()}
        onRestored={(page) => {
          if (!selectedId) void selectPage(page.id)
        }}
      />
      <VersionHistory
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        pageId={currentPage?.id ?? null}
        currentBlocks={liveBlocks}
        onRestored={onRestored}
      />
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => void refreshPages()}
      />
      <GraphView
        open={graphOpen}
        onOpenChange={setGraphOpen}
        currentPageId={selectedId}
        onSelectPage={(id) => void selectPage(id)}
      />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </TooltipProvider>
  )
}

function WelcomeScreen({
  pagesLoaded,
  onCreatePage,
  onOpenSearch,
}: {
  pagesLoaded: boolean
  onCreatePage: () => void
  onOpenSearch: () => void
}) {
  const { t } = useI18n()
  const features = [
    { icon: ShieldCheck, title: t('welcomeFeature1Title'), body: t('welcomeFeature1Body') },
    { icon: Zap, title: t('welcomeFeature2Title'), body: t('welcomeFeature2Body') },
    { icon: Sparkles, title: t('welcomeFeature3Title'), body: t('welcomeFeature3Body') },
  ]

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-16 text-center">
      <Logo className="size-16" />
      <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">{t('welcomeTitle')}</h1>
      <p className="mt-3 max-w-md text-balance text-muted-foreground">{t('welcomeSubtitle')}</p>

      <div className="mt-8 flex flex-col items-center gap-2">
        <Button size="lg" className="cursor-pointer gap-2" onClick={onCreatePage}>
          {t('welcomeCta')}
        </Button>
        <p className="text-xs text-muted-foreground">
          {t('welcomeOr')}{' '}
          <button
            type="button"
            onClick={onOpenSearch}
            className="cursor-pointer underline underline-offset-2 hover:text-foreground"
          >
            {t('welcomeHint')}
          </button>
        </p>
      </div>

      <div className="mt-12 grid w-full max-w-2xl gap-4 sm:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="rounded-xl border bg-card p-4 text-left">
            <f.icon className="size-5 text-primary" aria-hidden />
            <h2 className="mt-2 text-sm font-semibold">{f.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </div>

      <p className="mt-10 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Github className="size-3.5" aria-hidden />
        {t('footerLicense')} · {t('footerVersion')}
      </p>
    </div>
  )
}
