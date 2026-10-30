'use client'

/**
 * Taccuino — tipi e metadati condivisi delle viste database.
 */
import {
  Calendar,
  ChevronDown,
  Hash,
  Link2,
  SquareCheckBig,
  Type,
  type LucideIcon,
} from 'lucide-react'
import type { TranslationKey } from '@/lib/i18n'
import type {
  DatabaseProperty,
  DatabaseRow,
  PropertyType,
  RowProperties,
  SelectColor,
  SelectOption,
  PropertyValue,
} from '@/lib/types'

/** Icona + chiave i18n per ogni tipo di proprietà. */
export const PROPERTY_TYPE_META: Record<PropertyType, { icon: LucideIcon; labelKey: TranslationKey }> = {
  text: { icon: Type, labelKey: 'dbTypeText' },
  number: { icon: Hash, labelKey: 'dbTypeNumber' },
  select: { icon: ChevronDown, labelKey: 'dbTypeSelect' },
  date: { icon: Calendar, labelKey: 'dbTypeDate' },
  checkbox: { icon: SquareCheckBig, labelKey: 'dbTypeCheckbox' },
  url: { icon: Link2, labelKey: 'dbTypeUrl' },
}

/** Operazioni di mutazione offerte da DatabaseView alle viste (tabella/kanban). */
export interface DatabaseOps {
  /** Crea una riga (POST) e restituisce la riga creata, null in caso d'errore. */
  createRow(init?: { title?: string; properties?: RowProperties }): Promise<DatabaseRow | null>
  updateRowTitle(rowId: string, title: string): void
  updateRowIcon(rowId: string, icon: string | null): void
  updateRowProperty(rowId: string, propId: string, value: PropertyValue): void
  deleteRow(rowId: string): void
  /** Aggiunge una proprietà allo schema (con opzioni iniziali opzionali per select). */
  addProperty(name: string, type: PropertyType, options?: SelectOption[]): DatabaseProperty | null
  renameProperty(propId: string, name: string): void
  changePropertyType(propId: string, type: PropertyType): void
  deleteProperty(propId: string): void
  /** Aggiunge un'opzione a una proprietà select e la restituisce. */
  addSelectOption(propId: string, label: string, color: SelectColor): SelectOption | null
}

/** Valore "visualizzabile" di una cella (per le anteprime kanban). */
export function valueToPreviewText(value: PropertyValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? '✓' : ''
  return String(value)
}
