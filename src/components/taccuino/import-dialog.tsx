'use client'

/**
 * Taccuino — importazione: file .md o ZIP di pagine Markdown
 * (compatibile con gli export di Notion) via POST /api/import.
 */
import * as React from 'react'
import { FileUp, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useI18n } from '@/lib/i18n'

export interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: (created: number) => void
}

const ACCEPTED = '.md,.markdown,.zip'
const MAX_BYTES = 20 * 1024 * 1024

export function ImportDialog({ open, onOpenChange, onImported }: ImportDialogProps) {
  const { t } = useI18n()
  const [file, setFile] = React.useState<File | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [dragOver, setDragOver] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  React.useEffect(() => {
    if (open) {
      setFile(null)
      setBusy(false)
      setDragOver(false)
    }
  }, [open])

  const pickFile = (f: File | undefined | null) => {
    if (!f) return
    const name = f.name.toLowerCase()
    if (!name.endsWith('.md') && !name.endsWith('.markdown') && !name.endsWith('.zip')) {
      toast.error(t('importError', { msg: f.name }))
      return
    }
    if (f.size > MAX_BYTES) {
      toast.error(t('importError', { msg: `${Math.round(f.size / 1024 / 1024)} MB > 20 MB` }))
      return
    }
    setFile(f)
  }

  const doImport = async () => {
    if (!file) return
    setBusy(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/import', { method: 'POST', body })
      const data = (await res.json()) as { created?: number; skipped?: number; error?: string }
      if (!res.ok) throw new Error(data.error ?? String(res.status))
      toast.success(t('importDone', { n: data.created ?? 0 }))
      onImported(data.created ?? 0)
      onOpenChange(false)
    } catch (err) {
      toast.error(t('importError', { msg: err instanceof Error ? err.message : 'error' }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="size-4" aria-hidden />
            {t('importTitle')}
          </DialogTitle>
          <DialogDescription>{t('importDescription')}</DialogDescription>
        </DialogHeader>

        <div
          role="button"
          tabIndex={0}
          aria-label={t('importChoose')}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              inputRef.current?.click()
            }
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            pickFile(e.dataTransfer.files?.[0])
          }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            dragOver ? 'border-primary bg-accent' : 'border-border hover:bg-accent/50'
          }`}
        >
          <FileUp className="size-8 text-muted-foreground" aria-hidden />
          {file ? (
            <p className="max-w-full truncate text-sm font-medium">{file.name}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{t('importChoose')}</p>
          )}
          <p className="text-xs text-muted-foreground">.md · .markdown · .zip — max 20 MB</p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => {
              pickFile(e.currentTarget.files?.[0])
              e.currentTarget.value = ''
            }}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="cursor-pointer"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {t('cancel')}
          </Button>
          <Button className="cursor-pointer gap-1.5" disabled={!file || busy} onClick={() => void doImport()}>
            <Upload className="size-4" aria-hidden />
            {busy ? t('importStarted') : t('importTitle')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
