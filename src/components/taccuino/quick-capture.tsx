'use client'

/**
 * Taccuino — Acquisizione rapida (Inbox).
 * Un pensiero, un task, un'idea: viene salvato come blocco nella pagina
 * "Inbox" (creata al volo lato server se manca) senza lasciare la pagina
 * corrente. Scorciatoia: Ctrl/Cmd+Shift+U.
 */
import * as React from 'react'
import { Inbox, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useI18n } from '@/lib/i18n'

export interface QuickCaptureProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenPage: (pageId: string) => void
  onSaved: () => void
}

export function QuickCapture({ open, onOpenChange, onOpenPage, onSaved }: QuickCaptureProps) {
  const { t } = useI18n()
  const [text, setText] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const inputRef = React.useRef<HTMLTextAreaElement | null>(null)

  // focus automatico all'apertura
  React.useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => inputRef.current?.focus(), 80)
    return () => clearTimeout(timer)
  }, [open])

  const save = React.useCallback(async () => {
    const value = text.trim()
    if (!value || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/quick-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: value }),
      })
      const data: { page?: { id: string } } = await res.json().catch(() => ({}))
      if (!res.ok || !data.page?.id) {
        toast.error(t('quickCaptureError'))
        return
      }
      setText('')
      const pageId = data.page.id
      onSaved()
      onOpenChange(false)
      toast(t('quickCaptureSaved'), {
        action: { label: t('quickCaptureOpen'), onClick: () => onOpenPage(pageId) },
      })
    } catch {
      toast.error(t('quickCaptureError'))
    } finally {
      setSaving(false)
    }
  }, [text, saving, t, onOpenPage, onOpenChange, onSaved])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Inbox className="size-4 text-primary" aria-hidden />
            {t('quickCaptureTitle')}
          </DialogTitle>
          <DialogDescription>{t('quickCaptureDesc')}</DialogDescription>
        </DialogHeader>
        <Textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void save()
            }
          }}
          rows={3}
          placeholder={t('quickCapturePlaceholder')}
          aria-label={t('quickCaptureTitle')}
          className="resize-none bg-muted/50 text-sm"
          disabled={saving}
        />
        <div className="flex justify-end">
          <Button size="sm" className="cursor-pointer gap-2" onClick={() => void save()} disabled={saving || text.trim() === ''}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Send className="size-4" aria-hidden />
            )}
            {t('quickCaptureSend')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
