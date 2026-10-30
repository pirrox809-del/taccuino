'use client'

/**
 * Taccuino — selettore copertina: griglia 4×2 di gradienti + URL immagine.
 * Il popover è ancorato a un elemento zero-size passato come `children`
 * (ref affidabile, indipendente dai trigger dei menu) e viene aperto dalla
 * voce "Cambia copertina" del menu "Altre azioni": onFocusOutside viene
 * annullato per sopravvivere al focus che il menu restituisce al trigger.
 */
import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { useI18n } from '@/lib/i18n'
import { GRADIENT_COVER_VALUES, GRADIENT_PREFIX, coverToStyle } from '@/lib/covers'
import { cn } from '@/lib/utils'

export interface CoverPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  current: string | null
  onApply: (cover: string | null) => void
  /** Elemento ancora del popover (span zero-size accanto ai bottoni pagina). */
  children: React.ReactNode
}

const COVER_URL_RE = /^(https?:\/\/|\/api\/attachments\/)/i

export function CoverPicker({ open, onOpenChange, current, onApply, children }: CoverPickerProps) {
  const { t } = useI18n()
  const [url, setUrl] = React.useState('')
  const [invalid, setInvalid] = React.useState(false)

  const applyUrl = () => {
    const trimmed = url.trim()
    if (!COVER_URL_RE.test(trimmed)) {
      setInvalid(true)
      return
    }
    onApply(trimmed)
    setUrl('')
    setInvalid(false)
    onOpenChange(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) setInvalid(false)
      }}
    >
      <PopoverAnchor asChild>{children}</PopoverAnchor>
      <PopoverContent
        align="end"
        className="w-72 p-3"
        onFocusOutside={(event) => event.preventDefault()}
      >
        <p className="mb-2 text-xs font-semibold text-muted-foreground">{t('coverPick')}</p>
        <div className="grid grid-cols-4 gap-2">
          {GRADIENT_COVER_VALUES.map((cover) => {
            const style = coverToStyle(cover)
            return (
              <button
                key={cover}
                type="button"
                aria-label={`${t('coverPick')}: ${cover.slice(GRADIENT_PREFIX.length)}`}
                aria-pressed={current === cover}
                onClick={() => {
                  onApply(cover)
                  onOpenChange(false)
                }}
                style={style ?? undefined}
                className={cn(
                  'h-12 cursor-pointer rounded-lg border border-border/60 transition-transform hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  current === cover && 'ring-2 ring-primary ring-offset-1 ring-offset-background'
                )}
              />
            )
          })}
        </div>
        <div className="mt-3">
          <p className="mb-1.5 text-xs text-muted-foreground">{t('coverUrlLabel')}</p>
          <div className="flex gap-1.5">
            <Input
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setInvalid(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  applyUrl()
                }
              }}
              placeholder={t('coverUrlPlaceholder')}
              aria-label={t('coverUrlLabel')}
              aria-invalid={invalid}
              className="h-8 text-sm"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 cursor-pointer"
              onClick={applyUrl}
            >
              {t('coverUrlApply')}
            </Button>
          </div>
          {invalid ? <p className="mt-1.5 text-xs text-destructive">{t('coverUrlInvalid')}</p> : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}
