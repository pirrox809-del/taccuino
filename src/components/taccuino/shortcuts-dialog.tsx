'use client'

/**
 * Taccuino — foglio delle scorciatoie (tasto "?" o pulsante nella barra).
 * Tutti i comandi dell'app in un posto: l'utente non deve cercarli in rete.
 */
import * as React from 'react'
import { Keyboard } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useI18n } from '@/lib/i18n'

export interface ShortcutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ShortcutRow {
  keys: string[]
  labelKey: Parameters<ReturnType<typeof useI18n>['t']>[0]
}

const NAVIGATION: ShortcutRow[] = [
  { keys: ['Ctrl', 'K'], labelKey: 'shortcutsSearch' },
  { keys: ['Ctrl', 'Shift', 'F'], labelKey: 'shortcutsFocus' },
  { keys: ['Ctrl', 'Shift', 'G'], labelKey: 'shortcutsGraph' },
  { keys: ['Ctrl', 'Shift', 'A'], labelKey: 'shortcutsAi' },
  { keys: ['Ctrl', 'Shift', 'O'], labelKey: 'shortcutsOutline' },
  { keys: ['?'], labelKey: 'shortcutsSheet' },
  { keys: ['Esc'], labelKey: 'shortcutsEscape' },
]

const EDITING: ShortcutRow[] = [
  { keys: ['/'], labelKey: 'shortcutsSlash' },
  { keys: ['#', '-', '[]', '>', '```', '---'], labelKey: 'shortcutsMarkdown' },
  { keys: ['Enter'], labelKey: 'shortcutsNewBlock' },
  { keys: ['Ctrl', 'B'], labelKey: 'shortcutsBold' },
  { keys: ['Ctrl', 'I'], labelKey: 'shortcutsItalic' },
]

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
      {children}
    </kbd>
  )
}

export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  const { t } = useI18n()

  const section = (title: string, rows: ShortcutRow[]) => (
    <section className="flex flex-col gap-1">
      <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <ul className="flex flex-col gap-1">
        {rows.map((row) => (
          <li key={row.labelKey} className="flex items-center justify-between gap-4 rounded-md px-1 py-0.5">
            <span className="min-w-0 text-sm text-foreground">{t(row.labelKey)}</span>
            <span className="flex shrink-0 items-center gap-1">
              {row.keys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="size-4" aria-hidden />
            {t('shortcutsTitle')}
          </DialogTitle>
          <DialogDescription>{t('shortcutsDescription')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 sm:grid-cols-1">
          {section(t('appName'), NAVIGATION)}
          {section(t('slashMenuTitle'), EDITING)}
        </div>
      </DialogContent>
    </Dialog>
  )
}
