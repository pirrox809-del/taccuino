'use client'

/**
 * Taccuino — vista database: toolbar (switcher Tabella | Kanban ricordato in
 * localStorage, aggiungi proprietà, nuova riga), schema salvato con PUT
 * debounced 500 ms e righe aggiornate in ottimistico (PATCH dirette, rollback
 * + toast su errore). Comunica al guscio il numero di righe per le statistiche.
 */
import * as React from 'react'
import { Plus, SquareKanban, Table2 } from 'lucide-react'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useI18n } from '@/lib/i18n'
import type {
  DatabaseProperty,
  DatabaseRow,
  DatabaseViewKind,
  PropertyType,
  SelectColor,
  SelectOption,
} from '@/lib/types'
import { uid } from '../editor/dom'
import { AddPropertyPopover } from './add-property'
import { KanbanView } from './kanban-view'
import type { DatabaseOps } from './ops'
import { TableView } from './table-view'

export interface DatabaseViewProps {
  pageId: string
  initialProperties: DatabaseProperty[]
  initialRows: DatabaseRow[]
  /** Comunica al guscio il numero di righe (per le statistiche). */
  onRowsCount: (n: number) => void
}

const VIEW_STORAGE_PREFIX = 'taccuino-db-view:'

interface ConfirmState {
  kind: 'type' | 'delete-prop'
  prop: DatabaseProperty
  nextType?: PropertyType
}

export function DatabaseView({ pageId, initialProperties, initialRows, onRowsCount }: DatabaseViewProps) {
  const { t } = useI18n()

  const [properties, setProperties] = React.useState<DatabaseProperty[]>(initialProperties)
  const [rows, setRows] = React.useState<DatabaseRow[]>(initialRows)
  const [view, setView] = React.useState<DatabaseViewKind>(() => {
    if (typeof window === 'undefined') return 'table'
    try {
      return window.localStorage.getItem(VIEW_STORAGE_PREFIX + pageId) === 'kanban'
        ? 'kanban'
        : 'table'
    } catch {
      return 'table'
    }
  })
  const [groupPropId, setGroupPropId] = React.useState<string | null>(null)
  const [focusRowId, setFocusRowId] = React.useState<string | null>(null)
  const [confirm, setConfirm] = React.useState<ConfirmState | null>(null)

  const propertiesRef = React.useRef(properties)
  propertiesRef.current = properties
  const rowsRef = React.useRef(rows)
  rowsRef.current = rows
  const schemaSavedRef = React.useRef<DatabaseProperty[]>(initialProperties)
  const schemaLatestRef = React.useRef<DatabaseProperty[]>(initialProperties)
  const schemaTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Statistiche: numero righe per la barra del guscio.
  React.useEffect(() => {
    onRowsCount(rows.length)
  }, [rows.length, onRowsCount])

  // ---------------------------------------------------------------------------
  // Schema: PUT /api/pages/[id]/database (array completo, debounce 500 ms)
  // ---------------------------------------------------------------------------
  const putSchema = React.useCallback(
    async (props: DatabaseProperty[]) => {
      try {
        const res = await fetch(`/api/pages/${pageId}/database`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ properties: props }),
        })
        if (!res.ok) throw new Error(String(res.status))
        schemaSavedRef.current = props
      } catch {
        // rollback allo schema salvato l'ultima volta con successo
        setProperties(schemaSavedRef.current)
        schemaLatestRef.current = schemaSavedRef.current
        toast.error(t('errorGeneric'))
      }
    },
    [pageId, t]
  )

  const commitSchema = React.useCallback(
    (next: DatabaseProperty[]) => {
      setProperties(next)
      schemaLatestRef.current = next
      if (schemaTimerRef.current) clearTimeout(schemaTimerRef.current)
      schemaTimerRef.current = setTimeout(() => {
        schemaTimerRef.current = null
        void putSchema(next)
      }, 500)
    },
    [putSchema]
  )

  // Flush dello schema pendente allo smontaggio (cambio pagina / chiusura).
  React.useEffect(() => {
    return () => {
      if (schemaTimerRef.current) {
        clearTimeout(schemaTimerRef.current)
        schemaTimerRef.current = null
        const props = schemaLatestRef.current
        void fetch(`/api/pages/${pageId}/database`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ properties: props }),
          keepalive: true,
        }).catch(() => undefined)
      }
    }
  }, [pageId])

  // ---------------------------------------------------------------------------
  // Righe: PATCH /api/rows/[id] dirette con rollback ottimistico
  // ---------------------------------------------------------------------------
  const patchRow = React.useCallback(
    async (rowId: string, patch: Record<string, unknown>, rollback: DatabaseRow) => {
      try {
        const res = await fetch(`/api/rows/${rowId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        if (!res.ok) throw new Error(String(res.status))
      } catch {
        setRows((prev) => prev.map((r) => (r.id === rowId ? rollback : r)))
        toast.error(t('errorGeneric'))
      }
    },
    [t]
  )

  const ops: DatabaseOps = React.useMemo(() => {
    const applyRowUpdate = (rowId: string, patch: Record<string, unknown>) => {
      const cur = rowsRef.current.find((r) => r.id === rowId)
      if (!cur) return
      const nextRow: DatabaseRow = { ...cur, ...(patch as Partial<DatabaseRow>) }
      setRows((prev) => prev.map((r) => (r.id === rowId ? nextRow : r)))
      void patchRow(rowId, patch, cur)
    }

    return {
      createRow: async (init) => {
        try {
          const res = await fetch(`/api/pages/${pageId}/rows`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: init?.title ?? '',
              properties: init?.properties ?? {},
            }),
          })
          if (!res.ok) throw new Error(String(res.status))
          const data = (await res.json()) as { row: DatabaseRow }
          setRows((prev) => [...prev, data.row])
          return data.row
        } catch {
          toast.error(t('errorGeneric'))
          return null
        }
      },

      updateRowTitle: (rowId, title) => {
        const cur = rowsRef.current.find((r) => r.id === rowId)
        if (!cur || cur.title === title) return
        applyRowUpdate(rowId, { title })
      },

      updateRowIcon: (rowId, icon) => {
        applyRowUpdate(rowId, { icon })
      },

      updateRowProperty: (rowId, propId, value) => {
        const cur = rowsRef.current.find((r) => r.id === rowId)
        if (!cur || cur.properties[propId] === value) return
        const nextProperties = { ...cur.properties, [propId]: value }
        applyRowUpdate(rowId, { properties: nextProperties })
      },

      deleteRow: (rowId) => {
        const snapshot = rowsRef.current
        setRows(snapshot.filter((r) => r.id !== rowId))
        void (async () => {
          try {
            const res = await fetch(`/api/rows/${rowId}`, { method: 'DELETE' })
            if (!res.ok) throw new Error(String(res.status))
            toast.success(t('dbRowDeleted'))
          } catch {
            setRows(snapshot)
            toast.error(t('errorGeneric'))
          }
        })()
      },

      addProperty: (name, type, options) => {
        const prop: DatabaseProperty = {
          id: uid(),
          name,
          type,
          ...(type === 'select' ? { options: options ?? [] } : {}),
        }
        commitSchema([...propertiesRef.current, prop])
        return prop
      },

      renameProperty: (propId, name) => {
        commitSchema(propertiesRef.current.map((p) => (p.id === propId ? { ...p, name } : p)))
      },

      changePropertyType: (propId, type) => {
        commitSchema(
          propertiesRef.current.map((p) =>
            p.id === propId
              ? { ...p, type, options: type === 'select' ? (p.options ?? []) : undefined }
              : p
          )
        )
      },

      deleteProperty: (propId) => {
        commitSchema(propertiesRef.current.filter((p) => p.id !== propId))
        // pulizia locale dei valori orfani nelle righe
        setRows((prev) =>
          prev.map((r) => {
            if (r.properties[propId] === undefined) return r
            const nextProperties = { ...r.properties }
            delete nextProperties[propId]
            return { ...r, properties: nextProperties }
          })
        )
      },

      addSelectOption: (propId, label, color: SelectColor) => {
        const prop = propertiesRef.current.find((p) => p.id === propId)
        if (!prop) return null
        const opt: SelectOption = { id: uid(), label, color }
        commitSchema(
          propertiesRef.current.map((p) =>
            p.id === propId ? { ...p, options: [...(p.options ?? []), opt] } : p
          )
        )
        return opt
      },
    }
  }, [commitSchema, pageId, patchRow, t])

  // ---------------------------------------------------------------------------
  // Handler toolbar
  // ---------------------------------------------------------------------------
  const changeView = (value: string) => {
    const v = value === 'kanban' ? 'kanban' : 'table'
    setView(v)
    try {
      window.localStorage.setItem(VIEW_STORAGE_PREFIX + pageId, v)
    } catch {
      /* localStorage non disponibile: lo stato resta in memoria */
    }
  }

  const handleNewRow = async () => {
    const row = await ops.createRow()
    if (row) setFocusRowId(row.id)
  }

  const selectProps = properties.filter((p) => p.type === 'select')
  const groupProp =
    selectProps.find((p) => p.id === groupPropId) ?? (selectProps.length > 0 ? selectProps[0] : null)

  const createSelectForKanban = () => {
    ops.addProperty(t('dbTypeSelect'), 'select', [
      { id: uid(), label: t('dbKanbanOptTodo'), color: 'gray' },
      { id: uid(), label: t('dbKanbanOptDoing'), color: 'orange' },
      { id: uid(), label: t('dbKanbanOptDone'), color: 'green' },
    ])
  }

  const applyConfirm = () => {
    if (!confirm) return
    if (confirm.kind === 'type' && confirm.nextType) {
      ops.changePropertyType(confirm.prop.id, confirm.nextType)
    }
    if (confirm.kind === 'delete-prop') {
      ops.deleteProperty(confirm.prop.id)
    }
    setConfirm(null)
  }

  return (
    <div className="flex min-w-0 flex-col">
      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Tabs value={view} onValueChange={changeView}>
          <TabsList className="h-8">
            <TabsTrigger value="table" className="cursor-pointer gap-1.5 px-3 text-xs">
              <Table2 className="size-3.5" aria-hidden />
              {t('dbViewTable')}
            </TabsTrigger>
            <TabsTrigger value="kanban" className="cursor-pointer gap-1.5 px-3 text-xs">
              <SquareKanban className="size-3.5" aria-hidden />
              {t('dbViewKanban')}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {view === 'kanban' && selectProps.length > 0 ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{t('dbKanbanGroupBy')}</span>
            <Select
              value={groupProp?.id ?? ''}
              onValueChange={(v) => setGroupPropId(v)}
            >
              <SelectTrigger
                size="sm"
                aria-label={t('dbKanbanGroupBy')}
                className="h-8 w-40 cursor-pointer text-xs"
              >
                <SelectValue placeholder={t('dbKanbanGroupBy')} />
              </SelectTrigger>
              <SelectContent>
                {selectProps.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <span className="flex-1" />

        <AddPropertyPopover
          onAdd={(name, type) => {
            ops.addProperty(name, type)
          }}
        >
          <Button variant="outline" size="sm" className="cursor-pointer gap-1.5">
            <Plus className="size-4" aria-hidden />
            {t('dbAddProperty')}
          </Button>
        </AddPropertyPopover>
        <Button size="sm" className="cursor-pointer gap-1.5" onClick={() => void handleNewRow()}>
          <Plus className="size-4" aria-hidden />
          {t('dbNewRow')}
        </Button>
      </div>

      {/* Viste */}
      {view === 'table' ? (
        <TableView
          properties={properties}
          rows={rows}
          ops={ops}
          focusRowId={focusRowId}
          onRequestConfirm={setConfirm}
        />
      ) : (
        <KanbanView
          properties={properties}
          rows={rows}
          ops={ops}
          groupProp={groupProp}
          onCreateSelect={createSelectForKanban}
        />
      )}

      {/* Conferma cambio tipo / eliminazione proprietà */}
      <AlertDialog
        open={confirm !== null}
        onOpenChange={(o) => {
          if (!o) setConfirm(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === 'type'
                ? t('dbChangeTypeConfirmTitle')
                : t('dbDeletePropertyConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === 'type'
                ? t('dbChangeTypeConfirmBody')
                : t('dbDeletePropertyConfirmBody')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className={
                confirm?.kind === 'delete-prop'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : ''
              }
              onClick={applyConfirm}
            >
              {t('confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
