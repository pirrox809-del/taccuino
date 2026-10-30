/**
 * Taccuino — mappa dei colori delle opzioni di selezione.
 * Classi Tailwind per badge con toni caldi e leggibili (light + dark).
 */
import type { SelectColor } from './types'

export const PROPERTY_BADGE_CLASS: Record<SelectColor, string> = {
  gray: 'bg-stone-100 text-stone-700 dark:bg-stone-800/60 dark:text-stone-300',
  brown: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
  yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200',
  green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  teal: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200',
  violet: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
  pink: 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-200',
}

/** Clonna del puntino colorato (picker colore opzioni). */
export const PROPERTY_DOT_CLASS: Record<SelectColor, string> = {
  gray: 'bg-stone-400 dark:bg-stone-500',
  brown: 'bg-amber-700 dark:bg-amber-600',
  orange: 'bg-orange-500 dark:bg-orange-500',
  yellow: 'bg-yellow-500 dark:bg-yellow-500',
  green: 'bg-emerald-600 dark:bg-emerald-500',
  teal: 'bg-teal-600 dark:bg-teal-500',
  violet: 'bg-violet-500 dark:bg-violet-500',
  pink: 'bg-pink-500 dark:bg-pink-500',
}
