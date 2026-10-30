'use client'

/**
 * Taccuino — vista tabella del database: griglia con thead/tbody reali,
 * celle editabili inline, header con menu proprietà (rinomina inline, cambio
 * tipo con conferma, eliminazione con conferma), menu riga con eliminazione
 * con conferma e riga finale "+ Nuova".
 */
import * as React from 'react'
import { ChevronDown, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useI18n } from '@/lib/i18n'
import type { DatabaseProperty, DatabaseRow, PropertyType } from '@/lib/types'
import { PROPERTY_TYPES } from '@/lib/types'
import { EmojiPicker } from '../editor/emoji-picker'
import { TextLikeCell } from './cells'
import { AddPropertyPopover } from './add-property'
import { PropertyCell } from './cells'
import { PROPERTY_TYPE_META, type DatabaseOps } from './ops'

export interface TableViewProps {
  properties: DatabaseProperty[]
  rows: DatabaseRow[]
  ops: DatabaseOps
  /** Riga da mettere in modifica (titolo focalizzato) dopo la creazione. */
  focusRowId: string | null
  /** Richiesta conferma per cambio tipo / eliminazione proprietà (gestita dal padre). */
  onRequestConfirm: (confirm: {
    kind: 'type' | 'delete-prop'
    prop: DatabaseProperty
    nextType?: PropertyType
  }) => void
}

function PropertyHeader({
  property,
  onRename,
  onRequestConfirm,
}: {
  property: DatabaseProperty
  onRename: (propId: string, name: string) => void
  onRequestConfirm: TableViewProps['onRequestConfirm']
}) {
  const { t } = useI18n()
  const [renaming, setRenaming] = React.useState(false)
  const [draft, setDraft] = React.useState(property.name)
  const meta = PROPERTY_TYPE_META[property.type]
  const Icon = meta.icon

  const commitRename = () => {
    const name = draft.trim()
    if (name && name !== property.name) onRename(property.id, name)
    else setDraft(property.name)
    setRenaming(false)
  }

  if (renaming) {
    return (
      <input
        autoFocus
        value={draft}
        aria-label={t('dbRename')}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitRename}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commitRename()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            setDraft(property.name)
            setRenaming(false)
          }
        }}
        className="h-8 w-full bg-transparent px-2 text-sm font-medium outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
      />
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${property.name} — ${t('dbPropertyType')}: ${t(meta.labelKey)}`}
          className="flex h-8 w-full cursor-pointer items-center gap-1.5 px-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <Icon className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{property.name}</span>
          <ChevronDown className="ml-auto size-3.5 shrink-0 opacity-50" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem
          onSelect={() => {
            setDraft(property.name)
            setRenaming(true)
          }}
        >
          <Pencil className="size-4" aria-hidden />
          {t('dbRename')}
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Icon className="size-4" aria-hidden />
            {t('dbChangeType')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-44">
            {PROPERTY_TYPES.map((pt) => {
              const m = PROPERTY_TYPE_META[pt]
              const MIcon = m.icon
              return (
                <DropdownMenuItem
                  key={pt}
                  disabled={pt === property.type}
                  onSelect={() => {
                    if (pt !== property.type) {
                      onRequestConfirm({ kind: 'type', prop: property, nextType: pt })
                    }
                  }}
                >
                  <MIcon className="size-4" aria-hidden />
                  {t(m.labelKey)}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => onRequestConfirm({ kind: 'delete-prop', prop: property })}
        >
          <Trash2 className="size-4" aria-hidden />
          {t('dbDeleteProperty')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function TableRow({
  row,
  properties,
  ops,
  focus,
  onDelete,
}: {
  row: DatabaseRow
  properties: DatabaseProperty[]
  ops: DatabaseOps
  focus: boolean
  onDelete: () => void
}) {
  const { t } = useI18n()
  return (
    <tr className="group/row border-b border-border transition-colors last:border-b-0 hover:bg-accent/20">
      <td className="border-r border-border p-0">
        <div className="flex items-center gap-0.5 pl-1">
          <EmojiPicker value={row.icon} onPick={(icon) => ops.updateRowIcon(row.id, icon)} align="start">
            <button
              type="button"
              aria-label={row.icon ? t('changeIcon') : t('addIcon')}
              className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded text-base leading-none hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {row.icon ?? <span className="text-sm text-muted-foreground/60">⊕</span>}
            </button>
          </EmojiPicker>
          <TextLikeCell
            value={row.title}
            onChange={(v) => ops.updateRowTitle(row.id, typeof v === 'string' ? v : '')}
            ariaLabel={t('dbRowTitleAria')}
            placeholder={t('untitled')}
            className="font-medium"
            autoFocus={focus}
          />
          <div className="shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`${t('dbRowMenu')} — ${row.title || t('untitled')}`}
                  className="flex size-6 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <MoreHorizontal className="size-3.5" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                  <Trash2 className="size-4" aria-hidden />
                  {t('delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </td>
      {properties.map((p) => (
        <td key={p.id} className="border-r border-border p-0 align-middle">
          <PropertyCell
            property={p}
            value={row.properties[p.id] ?? null}
            rowTitle={row.title}
            onChange={(v) => ops.updateRowProperty(row.id, p.id, v)}
            onAddOption={(label, color) => ops.addSelectOption(p.id, label, color)}
          />
        </td>
      ))}
      <td className="p-0" aria-hidden />
    </tr>
  )
}

export function TableView({ properties, rows, ops, focusRowId, onRequestConfirm }: TableViewProps) {
  const { t } = useI18n()
  const [rowToDelete, setRowToDelete] = React.useState<DatabaseRow | null>(null)
  const colCount = properties.length + 2

  return (
    <>
      <div className="max-h-[60vh] overflow-auto rounded-xl border bg-card">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_var(--border)]">
            <tr>
              <th scope="col" className="min-w-[200px] border-r border-border px-0 py-0 text-left">
                <span className="flex h-8 items-center px-2 text-sm font-medium text-muted-foreground">
                  {t('dbColumnName')}
                </span>
              </th>
              {properties.map((p) => (
                <th key={p.id} scope="col" className="min-w-[150px] border-r border-border px-0 py-0 text-left">
                  <PropertyHeader property={p} onRename={ops.renameProperty} onRequestConfirm={onRequestConfirm} />
                </th>
              ))}
              <th scope="col" className="w-11 px-1 py-1">
                <AddPropertyPopover
                  onAdd={(name, type) => {
                    ops.addProperty(name, type)
                  }}
                >
                  <button
                    type="button"
                    aria-label={t('dbAddProperty')}
                    className="flex size-7 w-full cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <Plus className="size-4" aria-hidden />
                  </button>
                </AddPropertyPopover>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                row={row}
                properties={properties}
                ops={ops}
                focus={row.id === focusRowId}
                onDelete={() => setRowToDelete(row)}
              />
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  {t('dbEmpty')}
                </td>
              </tr>
            ) : null}
            <tr className="border-t border-border">
              <td colSpan={colCount} className="p-0">
                <button
                  type="button"
                  onClick={() => void ops.createRow()}
                  className="flex h-9 w-full cursor-pointer items-center gap-2 px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <Plus className="size-4" aria-hidden />
                  {t('dbAddRow')}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <AlertDialog
        open={rowToDelete !== null}
        onOpenChange={(o) => {
          if (!o) setRowToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dbDeleteRowConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('dbDeleteRowConfirmBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (rowToDelete) ops.deleteRow(rowToDelete.id)
                setRowToDelete(null)
              }}
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
