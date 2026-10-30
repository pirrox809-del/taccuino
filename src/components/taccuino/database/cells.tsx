'use client'

/**
 * Taccuino — celle editabili della vista tabella, una per tipo di proprietà.
 * Gli input testuali usano bozza locale + commit debounced 500 ms (e flush su
 * blur/Enter): le modifiche arrivano al padre che le applica in ottimistico.
 */
import * as React from 'react'
import { Check, ExternalLink, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { useI18n } from '@/lib/i18n'
import { PROPERTY_BADGE_CLASS, PROPERTY_DOT_CLASS } from '@/lib/property-colors'
import type {
  DatabaseProperty,
  PropertyValue,
  SelectColor,
  SelectOption,
} from '@/lib/types'
import { SELECT_COLORS } from '@/lib/types'
import { cn } from '@/lib/utils'

const CELL_INPUT_CLASS =
  'h-9 w-full min-w-0 rounded-none border-0 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground/50 focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring'

/** Badge colorato di un'opzione di selezione. */
export function SelectBadge({ option }: { option: SelectOption }) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-xs font-medium',
        PROPERTY_BADGE_CLASS[option.color]
      )}
    >
      {option.label}
    </span>
  )
}

interface TextLikeCellProps {
  value: PropertyValue
  onChange: (value: PropertyValue) => void
  inputType?: 'text' | 'number' | 'date'
  ariaLabel: string
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

/** Input con bozza locale e commit debounced; sincronizza la prop solo a fuoco perso. */
export function TextLikeCell({
  value,
  onChange,
  inputType = 'text',
  ariaLabel,
  placeholder,
  className,
  autoFocus,
}: TextLikeCellProps) {
  const { t } = useI18n()
  const [draft, setDraft] = React.useState<string>(() => (value == null ? '' : String(value)))
  const focusedRef = React.useRef(false)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  React.useEffect(() => clearTimer, [clearTimer])

  React.useEffect(() => {
    if (!focusedRef.current) {
      const next = value == null ? '' : String(value)
      setDraft((d) => (d === next ? d : next))
    }
  }, [value])

  const emit = React.useCallback(
    (raw: string) => {
      let next: PropertyValue
      if (raw === '') next = null
      else if (inputType === 'number') next = Number.isNaN(Number(raw)) ? null : Number(raw)
      else next = raw
      onChange(next)
    },
    [inputType, onChange]
  )

  return (
    <input
      type={inputType}
      value={draft}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      placeholder={placeholder ?? t('dbEmptyCell')}
      className={cn(CELL_INPUT_CLASS, className)}
      onFocus={() => {
        focusedRef.current = true
      }}
      onChange={(e) => {
        setDraft(e.target.value)
        clearTimer()
        const raw = e.target.value
        timerRef.current = setTimeout(() => emit(raw), 500)
      }}
      onBlur={() => {
        focusedRef.current = false
        clearTimer()
        emit(draft)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          clearTimer()
          emit(draft)
          e.currentTarget.blur()
        }
      }}
    />
  )
}

interface SelectCellProps {
  property: DatabaseProperty
  value: PropertyValue
  onChange: (value: PropertyValue) => void
  onAddOption: (label: string, color: SelectColor) => SelectOption | null
}

/** Cella select: dropdown con badge, creazione opzione inline con colore. */
export function SelectCell({ property, value, onChange, onAddOption }: SelectCellProps) {
  const { t } = useI18n()
  const [open, setOpen] = React.useState(false)
  const [creating, setCreating] = React.useState(false)
  const [label, setLabel] = React.useState('')
  const [color, setColor] = React.useState<SelectColor>('gray')
  const options = property.options ?? []
  const selected = typeof value === 'string' ? options.find((o) => o.id === value) : undefined

  const createOption = () => {
    const trimmed = label.trim()
    if (!trimmed) return
    const opt = onAddOption(trimmed, color)
    if (opt) {
      onChange(opt.id)
      setCreating(false)
      setLabel('')
      setColor('gray')
      setOpen(false)
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) {
          setCreating(false)
          setLabel('')
          setColor('gray')
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${property.name}: ${selected ? selected.label : t('dbEmptyCell')}`}
          className="flex h-9 w-full cursor-pointer items-center px-3 text-left text-sm transition-colors hover:bg-accent/40 focus-visible:bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {selected ? (
            <SelectBadge option={selected} />
          ) : (
            <span className="text-xs text-muted-foreground">{t('dbEmptyCell')}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        <div className="max-h-48 overflow-y-auto">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onClick={() => {
                onChange(o.id)
                setOpen(false)
              }}
            >
              <span className="flex min-w-0 flex-1">
                <SelectBadge option={o} />
              </span>
              {value === o.id ? <Check className="size-3.5 shrink-0" aria-hidden /> : null}
            </button>
          ))}
          {options.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">{t('dbEmptyCell')}</p>
          ) : null}
        </div>
        <Separator className="my-1" />
        {creating ? (
          <div className="flex flex-col gap-2 p-1">
            <Input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('dbNewOption')}
              aria-label={t('dbNewOption')}
              className="h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  createOption()
                }
              }}
            />
            <div role="radiogroup" aria-label={t('dbOptionColor')} className="flex items-center gap-1">
              {SELECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  aria-label={c}
                  className={cn(
                    'size-4 cursor-pointer rounded-full ring-offset-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                    PROPERTY_DOT_CLASS[c],
                    color === c && 'ring-2 ring-ring ring-offset-background'
                  )}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
            <Button type="button" size="sm" className="cursor-pointer" onClick={createOption}>
              {t('dbAddOption')}
            </Button>
          </div>
        ) : (
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            onClick={() => setCreating(true)}
          >
            <Plus className="size-3.5" aria-hidden />
            {t('dbAddOption')}
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}

/** Cella checkbox centrata. */
export function CheckboxCell({
  value,
  onChange,
  ariaLabel,
}: {
  value: PropertyValue
  onChange: (value: PropertyValue) => void
  ariaLabel: string
}) {
  return (
    <div className="flex h-9 items-center justify-center px-3">
      <Checkbox
        checked={value === true}
        onCheckedChange={(c) => onChange(c === true)}
        aria-label={ariaLabel}
      />
    </div>
  )
}

/** Cella URL: input + pulsante apri link. */
export function UrlCell({
  value,
  onChange,
  ariaLabel,
}: {
  value: PropertyValue
  onChange: (value: PropertyValue) => void
  ariaLabel: string
}) {
  const { t } = useI18n()
  const url = typeof value === 'string' && /^https?:\/\//i.test(value) ? value : null
  return (
    <div className="flex items-center">
      <TextLikeCell value={value} onChange={onChange} ariaLabel={ariaLabel} />
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title={t('dbOpenUrl')}
          aria-label={`${t('dbOpenUrl')}: ${url}`}
          className="mr-2 flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      ) : null}
    </div>
  )
}

/** Dispatch della cella in base al tipo di proprietà. */
export function PropertyCell({
  property,
  value,
  rowTitle,
  onChange,
  onAddOption,
  autoFocus,
}: {
  property: DatabaseProperty
  value: PropertyValue
  rowTitle: string
  onChange: (value: PropertyValue) => void
  onAddOption: (label: string, color: SelectColor) => SelectOption | null
  autoFocus?: boolean
}) {
  const { t } = useI18n()
  const cellAria = `${property.name} — ${rowTitle || t('untitled')}`
  switch (property.type) {
    case 'text':
      return <TextLikeCell value={value} onChange={onChange} ariaLabel={cellAria} autoFocus={autoFocus} />
    case 'number':
      return (
        <TextLikeCell value={value} onChange={onChange} inputType="number" ariaLabel={cellAria} />
      )
    case 'date':
      return (
        <TextLikeCell
          value={value}
          onChange={onChange}
          inputType="date"
          ariaLabel={cellAria}
          placeholder=""
        />
      )
    case 'checkbox':
      return <CheckboxCell value={value} onChange={onChange} ariaLabel={cellAria} />
    case 'url':
      return <UrlCell value={value} onChange={onChange} ariaLabel={cellAria} />
    case 'select':
    default:
      return (
        <SelectCell property={property} value={value} onChange={onChange} onAddOption={onAddOption} />
      )
  }
}
