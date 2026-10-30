'use client'

/**
 * Taccuino — cronologia versioni: elenco istantanee con ripristino
 * (con conferma) e CONFRONTO delle differenze con il contenuto attuale
 * (funzione che Notion non ha: lì vedi solo snapshot mute).
 */
import * as React from 'react'
import { format } from 'date-fns'
import { enUS as enLocale, it as itLocale } from 'date-fns/locale'
import { ArrowLeft, Clock, FileDiff, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { diffBlocks, type DiffRow } from '@/lib/diff'
import { useI18n } from '@/lib/i18n'
import type { Block, PageMeta, VersionMeta } from '@/lib/types'

export interface VersionHistoryProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pageId: string | null
  /** Blocchi attualmente a schermo, per il confronto. */
  currentBlocks: Block[]
  onRestored: (page: PageMeta, blocks: Block[]) => void
}

interface DiffState {
  version: VersionMeta
  result: ReturnType<typeof diffBlocks>
}

export function VersionHistory({
  open,
  onOpenChange,
  pageId,
  currentBlocks,
  onRestored,
}: VersionHistoryProps) {
  const { t, lang } = useI18n()
  const [versions, setVersions] = React.useState<VersionMeta[]>([])
  const [loading, setLoading] = React.useState(false)
  const [confirmId, setConfirmId] = React.useState<string | null>(null)
  const [restoring, setRestoring] = React.useState(false)
  const [diff, setDiff] = React.useState<DiffState | null>(null)
  const [diffLoading, setDiffLoading] = React.useState(false)

  React.useEffect(() => {
    if (!open || !pageId) return
    let cancelled = false
    setLoading(true)
    setVersions([])
    setDiff(null)
    fetch(`/api/pages/${pageId}/versions`)
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status))
        const data = (await res.json()) as { versions: VersionMeta[] }
        if (!cancelled) setVersions(data.versions)
      })
      .catch(() => {
        if (!cancelled) setVersions([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, pageId])

  const restore = async (versionId: string) => {
    if (!pageId) return
    setRestoring(true)
    try {
      const res = await fetch(`/api/pages/${pageId}/versions/${versionId}/restore`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as { page: PageMeta; blocks: Block[] }
      onRestored(data.page, data.blocks)
      toast.success(t('historyRestored'))
      onOpenChange(false)
    } catch {
      toast.error(t('errorGeneric'))
    } finally {
      setRestoring(false)
      setConfirmId(null)
    }
  }

  const compare = async (version: VersionMeta) => {
    if (!pageId) return
    setDiffLoading(true)
    try {
      const res = await fetch(`/api/pages/${pageId}/versions/${version.id}`)
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as { version: { blocks: Block[] } }
      setDiff({ version, result: diffBlocks(data.version.blocks, currentBlocks) })
    } catch {
      toast.error(t('errorGeneric'))
    } finally {
      setDiffLoading(false)
    }
  }

  const locale = lang === 'it' ? itLocale : enLocale
  const confirmVersion = versions.find((v) => v.id === confirmId)

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => { if (!o) setDiff(null); onOpenChange(o) }}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
          <SheetHeader className="border-b px-4">
            <SheetTitle className="flex items-center gap-2">
              {diff ? (
                <>
                  <FileDiff className="size-4" aria-hidden />
                  {t('diffHeading')}
                </>
              ) : (
                <>
                  <Clock className="size-4" aria-hidden />
                  {t('historyTitle')}
                </>
              )}
            </SheetTitle>
            <SheetDescription>
              {diff
                ? `${t('diffSnapshot')}: ${format(new Date(diff.version.createdAt), 'PPp', { locale })}`
                : t('historyDescription')}
            </SheetDescription>
          </SheetHeader>

          {diff ? (
            <>
              {/* Riepilogo differenze */}
              <div className="flex items-center gap-2 border-b px-4 py-2 text-xs">
                <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 font-medium text-emerald-700 dark:text-emerald-400">
                  {t('diffWordsAdded', { n: diff.result.wordsAdded })}
                </span>
                <span className="rounded-md bg-red-500/15 px-1.5 py-0.5 font-medium text-red-700 dark:text-red-400">
                  {t('diffWordsRemoved', { n: diff.result.wordsRemoved })}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto h-7 cursor-pointer gap-1 text-xs"
                  onClick={() => setDiff(null)}
                >
                  <ArrowLeft className="size-3.5" aria-hidden />
                  {t('diffBack')}
                </Button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {diff.result.identical ? (
                  <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                    {t('diffIdentical')}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-0.5 font-mono text-xs">
                    {diff.result.rows.map((row, i) => (
                      <DiffRowView key={i} row={row} />
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {loading || diffLoading ? (
                <p className="text-sm text-muted-foreground">{t('loading')}</p>
              ) : versions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('historyEmpty')}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {versions.map((version) => (
                    <li
                      key={version.id}
                      className="flex items-center gap-3 rounded-lg border bg-card p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {version.title.trim() || t('untitled')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(version.createdAt), 'PPp', { locale })} ·{' '}
                          {version.blockCount} {t('historyBlocks')}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 shrink-0 cursor-pointer gap-1 text-xs"
                        onClick={() => void compare(version)}
                        disabled={diffLoading}
                      >
                        <FileDiff className="size-3.5" aria-hidden />
                        {t('diffCompare')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 shrink-0 cursor-pointer gap-1 text-xs"
                        onClick={() => setConfirmId(version.id)}
                        disabled={restoring}
                      >
                        <RotateCcw className="size-3.5" aria-hidden />
                        {t('historyRestore')}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmId !== null} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('historyRestoreConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmVersion
                ? `${t('historyRestoreConfirmBody')} (${format(new Date(confirmVersion.createdAt), 'PPp', { locale })})`
                : t('historyRestoreConfirmBody')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer"
              disabled={restoring}
              onClick={(e) => {
                e.preventDefault()
                if (confirmId) void restore(confirmId)
              }}
            >
              {t('historyRestore')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function DiffRowView({ row }: { row: DiffRow }) {
  const { t } = useI18n()

  if (row.kind === 'gap') {
    return (
      <li className="select-none py-1 text-center text-[10px] tracking-widest text-muted-foreground/60">
        ·····
      </li>
    )
  }

  if (row.kind === 'same') {
    return (
      <li className="truncate rounded px-2 py-0.5 text-muted-foreground/80" title={row.line.text}>
        <span className="mr-1.5 select-none text-muted-foreground/50" aria-hidden>·</span>
        {row.line.text || ' '}
      </li>
    )
  }

  if (row.kind === 'del') {
    return (
      <li className="rounded bg-red-500/10 px-2 py-0.5 text-red-700 dark:text-red-400">
        <span className="mr-1 select-none font-bold" aria-hidden>−</span>
        <s className="decoration-red-400/60">{row.line.text || ' '}</s>
      </li>
    )
  }

  if (row.kind === 'add') {
    return (
      <li className="rounded bg-emerald-500/15 px-2 py-0.5 text-emerald-800 dark:text-emerald-300">
        <span className="mr-1 select-none font-bold" aria-hidden>+</span>
        {row.line.text || ' '}
      </li>
    )
  }

  // riga modificata: parti inline rimosse (barrate) e aggiunte (verdi)
  return (
    <li className="rounded bg-amber-500/10 px-2 py-0.5">
      <span className="mr-1 select-none font-bold text-muted-foreground" aria-hidden>±</span>
      {row.parts.map((part, i) => {
        if (part.changed === 'none') {
          return (
            <span key={i} className="text-foreground/90">
              {part.text}
            </span>
          )
        }
        if (part.changed === 'del') {
          return (
            <s key={i} className="text-red-600 decoration-red-400/70 dark:text-red-400">
              {part.text}
            </s>
          )
        }
        return (
          <mark key={i} className="rounded-sm bg-emerald-500/20 px-0.5 text-emerald-800 dark:text-emerald-300">
            {part.text}
          </mark>
        )
      })}
    </li>
  )
}
