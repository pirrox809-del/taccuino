'use client'

/**
 * Taccuino — dialog "Nuova pagina da modello": griglia di card template con
 * anteprima, nome della pagina modificabile, creazione via POST /api/pages
 * (kind doc/database) + PATCH blocchi / PUT proprietà database.
 */
import * as React from 'react'
import { Loader2 } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useI18n, type TranslationKey } from '@/lib/i18n'
import { PAGE_TEMPLATES, type PageTemplate } from '@/lib/templates'
import type { Block } from '@/lib/types'
import { cn } from '@/lib/utils'

export interface TemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pagina genitore per la creazione (null = radice). */
  parentId: string | null
  onCreated: (pageId: string) => void | Promise<void>
}

/** Etichette i18n dei tipi di blocco usati nei modelli (per l'anteprima). */
const BLOCK_PREVIEW_KEY: Partial<Record<Block['type'], TranslationKey>> = {
  paragraph: 'slashBlockText',
  heading2: 'slashBlockH2',
  heading3: 'slashBlockH3',
  bullet: 'slashBlockBullet',
  checklist: 'slashBlockChecklist',
  callout: 'slashBlockCallout',
  quote: 'slashBlockQuote',
}

export function TemplateDialog({ open, onOpenChange, parentId, onCreated }: TemplateDialogProps) {
  const { t } = useI18n()
  const [selectedId, setSelectedId] = React.useState<string>('blank')
  const [title, setTitle] = React.useState('')
  const [creating, setCreating] = React.useState(false)

  const template = PAGE_TEMPLATES.find((tp) => tp.id === selectedId) ?? PAGE_TEMPLATES[0]

  React.useEffect(() => {
    if (open) {
      setSelectedId('blank')
      setTitle('')
      setCreating(false)
    }
  }, [open])

  // Se il titolo corrente è il nome di un modello (non personalizzato), lo sostituisce.
  const isTemplateDefaultTitle = (value: string): boolean =>
    PAGE_TEMPLATES.some((tp) => t(tp.titleKey) === value)

  const selectTemplate = (tp: PageTemplate) => {
    setSelectedId(tp.id)
    setTitle((cur) => (cur.trim() === '' || isTemplateDefaultTitle(cur) ? t(tp.titleKey) : cur))
  }

  const create = async () => {
    if (creating) return
    setCreating(true)
    try {
      const res = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || t(template.titleKey),
          icon: template.icon,
          parentId,
          kind: template.kind ?? 'doc',
        }),
      })
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as { page: { id: string } }
      const pageId = data.page.id

      if (template.kind !== 'database' && template.blocks && template.blocks.length > 0) {
        const patchRes = await fetch(`/api/pages/${pageId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blocks: template.blocks }),
        })
        if (!patchRes.ok) throw new Error(String(patchRes.status))
      }
      if (template.kind === 'database' && template.databaseProperties) {
        const putRes = await fetch(`/api/pages/${pageId}/database`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ properties: template.databaseProperties }),
        })
        if (!putRes.ok) throw new Error(String(putRes.status))
      }

      onOpenChange(false)
      await onCreated(pageId)
    } catch {
      toast.error(t('errorGeneric'))
    } finally {
      setCreating(false)
    }
  }

  const previewItems = (tp: PageTemplate): string[] => {
    if (tp.kind === 'database') {
      return (tp.databaseProperties ?? []).map((p) => p.name)
    }
    const counts = new Map<Block['type'], number>()
    for (const b of tp.blocks ?? []) {
      counts.set(b.type, (counts.get(b.type) ?? 0) + 1)
    }
    return [...counts.entries()]
      .slice(0, 3)
      .map(
        ([type, n]) =>
          `${n} × ${t(BLOCK_PREVIEW_KEY[type] ?? 'slashBlockText')}`
      )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!creating) onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('templateDialogTitle')}</DialogTitle>
          <DialogDescription>{t('templateDialogDescription')}</DialogDescription>
        </DialogHeader>

        <div
          role="radiogroup"
          aria-label={t('templateDialogTitle')}
          className="grid max-h-[44vh] gap-3 overflow-y-auto p-1 sm:grid-cols-2 lg:grid-cols-3"
        >
          {PAGE_TEMPLATES.map((tp) => (
            <button
              key={tp.id}
              type="button"
              role="radio"
              aria-checked={selectedId === tp.id}
              onClick={() => selectTemplate(tp)}
              className={cn(
                'flex cursor-pointer flex-col items-start gap-1 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                selectedId === tp.id && 'border-primary ring-1 ring-primary'
              )}
            >
              <span aria-hidden className="text-2xl leading-none">
                {tp.icon}
              </span>
              <span className="text-sm font-semibold">{t(tp.titleKey)}</span>
              <span className="text-xs leading-relaxed text-muted-foreground">{t(tp.descKey)}</span>
              <span className="mt-1.5 flex flex-wrap gap-1">
                {previewItems(tp).map((label) => (
                  <span
                    key={label}
                    className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {label}
                  </span>
                ))}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="template-title">{t('templateNameLabel')}</Label>
          <Input
            id="template-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t(template.titleKey)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void create()
              }
            }}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            className="cursor-pointer"
            disabled={creating}
            onClick={() => onOpenChange(false)}
          >
            {t('cancel')}
          </Button>
          <Button type="button" className="cursor-pointer gap-1.5" disabled={creating} onClick={() => void create()}>
            {creating ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {creating ? t('templateCreating') : t('templateCreate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
