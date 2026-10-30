'use client'

/**
 * Taccuino — vista Kanban: colonne = opzioni di una proprietà select
 * (+ colonna "Senza valore"), card = righe con anteprima di max 2 altre
 * proprietà. Drag & drop HTML5 fra colonne con PATCH ottimistico della riga.
 */
import * as React from 'react'
import { Plus, SquareKanban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import type { DatabaseProperty, DatabaseRow, PropertyValue, SelectOption } from '@/lib/types'
import { cn } from '@/lib/utils'
import { uid } from '../editor/dom'
import { SelectBadge } from './cells'
import { PROPERTY_TYPE_META, valueToPreviewText, type DatabaseOps } from './ops'

const ROW_MIME = 'application/x-taccuino-row'
const NONE_KEY = '__none__'

export interface KanbanViewProps {
  properties: DatabaseProperty[]
  rows: DatabaseRow[]
  ops: DatabaseOps
  /** Proprietà select su cui raggruppare (null se il database non ne ha). */
  groupProp: DatabaseProperty | null
  /** Crea una proprietà select con opzioni di partenza (stato vuoto kanban). */
  onCreateSelect: () => void
}

function CardValue({ prop, value }: { prop: DatabaseProperty; value: PropertyValue }) {
  if (prop.type === 'select' && typeof value === 'string') {
    const opt = (prop.options ?? []).find((o) => o.id === value)
    if (opt) return <SelectBadge option={opt} />
  }
  if (prop.type === 'checkbox') {
    return <span className="font-medium">{value === true ? '✓' : '—'}</span>
  }
  return <span className="truncate text-foreground/80">{valueToPreviewText(value)}</span>
}

function KanbanCard({
  row,
  properties,
  groupPropId,
}: {
  row: DatabaseRow
  properties: DatabaseProperty[]
  groupPropId: string
}) {
  const { t } = useI18n()
  const previews = properties
    .filter((p) => p.id !== groupPropId)
    .map((p) => ({ prop: p, value: row.properties[p.id] ?? null }))
    .filter(({ value }) => value !== null && value !== '' && value !== false)
    .slice(0, 2)

  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(ROW_MIME, row.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      className="cursor-grab rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:cursor-grabbing"
    >
      <div className="flex items-start gap-1.5">
        {row.icon ? (
          <span aria-hidden className="shrink-0 text-sm leading-5">
            {row.icon}
          </span>
        ) : null}
        <p className="min-w-0 flex-1 break-words text-sm font-medium leading-5">
          {row.title.trim() || t('untitled')}
        </p>
      </div>
      {previews.length > 0 ? (
        <dl className="mt-2 flex flex-col gap-1 text-xs">
          {previews.map(({ prop, value }) => (
            <div key={prop.id} className="flex items-center gap-2">
              <dt className="shrink-0 text-muted-foreground">{prop.name}</dt>
              <dd className="flex min-w-0 flex-1">
                <CardValue prop={prop} value={value} />
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </article>
  )
}

export function KanbanView({ properties, rows, ops, groupProp, onCreateSelect }: KanbanViewProps) {
  const { t } = useI18n()
  const [dragOverKey, setDragOverKey] = React.useState<string | null>(null)

  const columns: Array<{ key: string; value: string | null; option: SelectOption | null }> =
    React.useMemo(() => {
      const cols: Array<{ key: string; value: string | null; option: SelectOption | null }> = (
        groupProp?.options ?? []
      ).map((o) => ({ key: o.id, value: o.id, option: o }))
      cols.push({ key: NONE_KEY, value: null, option: null })
      return cols
    }, [groupProp])

  const rowsByCol = React.useMemo(() => {
    const map = new Map<string, DatabaseRow[]>()
    for (const c of columns) map.set(c.key, [])
    for (const r of rows) {
      const v = groupProp ? r.properties[groupProp.id] : null
      const key = typeof v === 'string' && map.has(v) ? v : NONE_KEY
      map.get(key)!.push(r)
    }
    return map
  }, [columns, rows, groupProp])

  if (!groupProp) {
    const meta = PROPERTY_TYPE_META.select
    const Icon = meta.icon
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
        <SquareKanban className="size-8 text-muted-foreground" aria-hidden />
        <p className="max-w-sm text-sm text-muted-foreground">{t('dbKanbanNoSelect')}</p>
        <Button size="sm" className="cursor-pointer gap-1.5" onClick={onCreateSelect}>
          <Icon className="size-4" aria-hidden />
          {t('dbKanbanCreateSelect')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((col) => {
        const colRows = rowsByCol.get(col.key) ?? []
        return (
          <section
            key={col.key}
            aria-label={col.option ? col.option.label : t('dbNoValue')}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes(ROW_MIME)) return
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              setDragOverKey(col.key)
            }}
            onDragLeave={(e) => {
              const related = e.relatedTarget as Node | null
              if (related && e.currentTarget.contains(related)) return
              setDragOverKey(null)
            }}
            onDrop={(e) => {
              e.preventDefault()
              setDragOverKey(null)
              const rowId = e.dataTransfer.getData(ROW_MIME)
              if (!rowId) return
              ops.updateRowProperty(rowId, groupProp.id, col.value)
            }}
            className={cn(
              'flex w-64 shrink-0 flex-col rounded-xl border bg-muted/40 transition-colors',
              dragOverKey === col.key && 'border-primary bg-accent/40 ring-1 ring-primary'
            )}
          >
            <header className="flex items-center gap-2 px-3 py-2">
              {col.option ? (
                <SelectBadge option={col.option} />
              ) : (
                <span className="text-xs font-medium text-muted-foreground">{t('dbNoValue')}</span>
              )}
              <span className="ml-auto text-xs text-muted-foreground">{colRows.length}</span>
            </header>
            <div className="flex max-h-[50vh] min-h-8 flex-col gap-2 overflow-y-auto px-2">
              {colRows.map((row) => (
                <KanbanCard key={row.id} row={row} properties={properties} groupPropId={groupProp.id} />
              ))}
            </div>
            <div className="p-2 pt-1">
              <button
                type="button"
                onClick={() =>
                  void ops.createRow(
                    col.value ? { properties: { [groupProp.id]: col.value } } : undefined
                  )
                }
                className="flex h-8 w-full cursor-pointer items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <Plus className="size-3.5" aria-hidden />
                {t('dbAddRow')}
              </button>
            </div>
          </section>
        )
      })}
    </div>
  )
}
