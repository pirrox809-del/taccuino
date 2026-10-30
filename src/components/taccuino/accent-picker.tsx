'use client'

/**
 * Taccuino — selettore dell'accento cromatico (popover in sidebar).
 * Sei accenti caldi/fredi, nessun blu di default: l'identità visiva
 * dell'app la sceglie chi la usa.
 */
import * as React from 'react'
import { Check } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useI18n } from '@/lib/i18n'
import { ACCENTS, usePrefsStore, type Accent } from '@/lib/prefs-store'
import { cn } from '@/lib/utils'

/** Colore rappresentativo di ciascun accento per gli swatch (coerente col CSS). */
const SWATCH: Record<Accent, string> = {
  terracotta: 'oklch(0.62 0.12 42)',
  sage: 'oklch(0.6 0.08 150)',
  amber: 'oklch(0.68 0.12 70)',
  rose: 'oklch(0.66 0.14 15)',
  violet: 'oklch(0.6 0.13 300)',
  teal: 'oklch(0.6 0.075 190)',
}

const LABEL_KEY: Record<Accent, Parameters<ReturnType<typeof useI18n>['t']>[0]> = {
  terracotta: 'accentTerracotta',
  sage: 'accentSage',
  amber: 'accentAmber',
  rose: 'accentRose',
  violet: 'accentViolet',
  teal: 'accentTeal',
}

export function AccentPicker({ children }: { children: React.ReactNode }) {
  const { t } = useI18n()
  const accent = usePrefsStore((s) => s.accent)
  const setAccent = usePrefsStore((s) => s.setAccent)
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-56 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('accentTitle')}
        </p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('accentTitle')}>
          {ACCENTS.map((name) => {
            const selected = accent === name
            return (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={selected}
                title={t(LABEL_KEY[name])}
                onClick={() => setAccent(name)}
                className={cn(
                  'flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border p-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  selected && 'border-primary'
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'flex size-6 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-popover',
                    selected ? 'ring-primary' : 'ring-transparent'
                  )}
                  style={{ background: SWATCH[name] }}
                >
                  {selected ? <Check className="size-3.5 text-white" aria-hidden /> : null}
                </span>
                <span className="w-full truncate text-center text-[10px] leading-tight text-muted-foreground">
                  {t(LABEL_KEY[name])}
                </span>
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
