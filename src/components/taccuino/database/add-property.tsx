'use client'

/**
 * Taccuino — popover "Aggiungi proprietà": nome + griglia dei tipi.
 * Usato dalla toolbar e dalla colonna "+" della tabella.
 */
import * as React from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useI18n } from '@/lib/i18n'
import type { PropertyType } from '@/lib/types'
import { PROPERTY_TYPES } from '@/lib/types'
import { cn } from '@/lib/utils'
import { PROPERTY_TYPE_META } from './ops'

export interface AddPropertyPopoverProps {
  onAdd: (name: string, type: PropertyType) => void
  children: React.ReactNode
}

export function AddPropertyPopover({ onAdd, children }: AddPropertyPopoverProps) {
  const { t } = useI18n()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [type, setType] = React.useState<PropertyType>('text')

  const submit = () => {
    const finalName = name.trim() || t(PROPERTY_TYPE_META[type].labelKey)
    onAdd(finalName, type)
    setName('')
    setType('text')
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) {
          setName('')
          setType('text')
        }
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-2">
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('dbPropertyName')}
          aria-label={t('dbPropertyName')}
          className="h-8 text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
        />
        <p className="mb-1 mt-2 px-1 text-xs font-medium text-muted-foreground">
          {t('dbPropertyType')}
        </p>
        <div className="grid grid-cols-2 gap-0.5">
          {PROPERTY_TYPES.map((pt) => {
            const meta = PROPERTY_TYPE_META[pt]
            const Icon = meta.icon
            return (
              <button
                key={pt}
                type="button"
                aria-pressed={type === pt}
                className={cn(
                  'flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  type === pt && 'bg-accent font-medium'
                )}
                onClick={() => setType(pt)}
              >
                <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                {t(meta.labelKey)}
              </button>
            )
          })}
        </div>
        <Button type="button" size="sm" className="mt-2 w-full cursor-pointer" onClick={submit}>
          <Plus className="size-4" aria-hidden />
          {t('dbAddPropertyCreate')}
        </Button>
      </PopoverContent>
    </Popover>
  )
}
