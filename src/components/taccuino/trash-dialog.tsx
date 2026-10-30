'use client'

/**
 * Taccuino — cestino: elenco pagine eliminate con ripristino,
 * eliminazione definitiva e svuotamento totale (tutti con conferma).
 */
import * as React from 'react'
import { format } from 'date-fns'
import { enUS as enLocale, it as itLocale } from 'date-fns/locale'
import { RotateCcw, Trash2 } from 'lucide-react'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useI18n } from '@/lib/i18n'
import type { PageMeta } from '@/lib/types'

export interface TrashDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trashedPages: PageMeta[]
  onRefresh: () => void
  onRestored: (page: PageMeta) => void
}

export function TrashDialog({
  open,
  onOpenChange,
  trashedPages,
  onRefresh,
  onRestored,
}: TrashDialogProps) {
  const { t, lang } = useI18n()
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null)
  const [confirmEmpty, setConfirmEmpty] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const locale = lang === 'it' ? itLocale : enLocale

  const restore = async (id: string) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/pages/${id}/restore`, { method: 'POST' })
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as { page: PageMeta }
      toast.success(t('restoredPage'))
      onRestored(data.page)
      onRefresh()
    } catch {
      toast.error(t('errorGeneric'))
    } finally {
      setBusy(false)
    }
  }

  const deleteForever = async (id: string) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/pages/${id}?hard=1`, { method: 'DELETE' })
      if (!res.ok) throw new Error(String(res.status))
      toast.success(t('deletedForever'))
      onRefresh()
    } catch {
      toast.error(t('errorGeneric'))
    } finally {
      setBusy(false)
      setConfirmDeleteId(null)
    }
  }

  const emptyAll = async () => {
    setBusy(true)
    try {
      await Promise.all(
        trashedPages.map((p) => fetch(`/api/pages/${p.id}?hard=1`, { method: 'DELETE' }))
      )
      toast.success(t('trashEmptied'))
      onRefresh()
    } catch {
      toast.error(t('errorGeneric'))
    } finally {
      setBusy(false)
      setConfirmEmpty(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[80vh] flex-col gap-0 overflow-hidden sm:max-w-md">
          <DialogHeader className="border-b px-4 pb-3">
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="size-4" aria-hidden />
              {t('trashTitle')}
            </DialogTitle>
            <DialogDescription>{t('trashDescription')}</DialogDescription>
          </DialogHeader>

          {trashedPages.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">{t('trashEmpty')}</p>
          ) : (
            <>
              <ScrollArea className="min-h-0 flex-1">
                <ul className="flex flex-col gap-1 p-3">
                  {trashedPages.map((page) => (
                    <li
                      key={page.id}
                      className="flex items-center gap-2 rounded-lg border bg-card p-2.5"
                    >
                      <span aria-hidden className="shrink-0 text-base leading-none">
                        {page.icon ?? '📄'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {page.title.trim() || t('untitled')}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {format(new Date(page.deletedAt ?? page.updatedAt), 'PPp', { locale })}
                        </span>
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 shrink-0 cursor-pointer gap-1 text-xs"
                        disabled={busy}
                        onClick={() => void restore(page.id)}
                      >
                        <RotateCcw className="size-3.5" aria-hidden />
                        {t('trashRestore')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 shrink-0 cursor-pointer gap-1 text-xs text-destructive hover:text-destructive"
                        disabled={busy}
                        onClick={() => setConfirmDeleteId(page.id)}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                        {t('delete')}
                      </Button>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
              <Separator />
              <div className="flex justify-end p-3">
                <Button
                  size="sm"
                  variant="destructive"
                  className="cursor-pointer gap-1.5"
                  disabled={busy}
                  onClick={() => setConfirmEmpty(true)}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  {t('trashEmptyAll')}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeleteId !== null} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('trashEmptyConfirmBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer bg-destructive text-white hover:bg-destructive/90"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                if (confirmDeleteId) void deleteForever(confirmDeleteId)
              }}
            >
              {t('trashDeleteForever')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmEmpty} onOpenChange={setConfirmEmpty}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('trashEmptyConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('trashEmptyConfirmBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer bg-destructive text-white hover:bg-destructive/90"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                void emptyAll()
              }}
            >
              {t('trashEmptyAll')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
