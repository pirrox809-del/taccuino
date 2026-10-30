/**
 * Taccuino — copertine di pagina in stile Notion.
 * Una copertina è o un gradiente nominato ("gradient:<nome>") oppure
 * l'URL di un'immagine (http/https o /api/attachments/...).
 */
import type { CSSProperties } from 'react'

/** Gradienti caldi/terrosi, coerenti con la palette (nessun indigo/blu acceso). */
export const GRADIENT_COVERS = {
  sunset: 'linear-gradient(135deg, #f7d9a8 0%, #eda06c 55%, #d97a52 100%)',
  meadow: 'linear-gradient(135deg, #dceab5 0%, #a4c46e 55%, #779a48 100%)',
  ocean: 'linear-gradient(135deg, #c2e2da 0%, #74b3a8 55%, #4a8a80 100%)',
  lilac: 'linear-gradient(135deg, #e8d9ee 0%, #b598d2 55%, #8a6cb0 100%)',
  peach: 'linear-gradient(135deg, #ffe4c4 0%, #f6b183 55%, #e88e5c 100%)',
  moss: 'linear-gradient(135deg, #e0e5cb 0%, #a8b07c 55%, #74804f 100%)',
  ember: 'linear-gradient(135deg, #f4c6a4 0%, #d98152 55%, #a55136 100%)',
  slate: 'linear-gradient(135deg, #e3ded4 0%, #a89f8e 55%, #736a5b 100%)',
} as const

export type CoverName = keyof typeof GRADIENT_COVERS

export const GRADIENT_PREFIX = 'gradient:'

/** Copertine come valori da salvare in PageMeta.cover. */
export const GRADIENT_COVER_VALUES: string[] = Object.keys(GRADIENT_COVERS).map(
  (name) => `${GRADIENT_PREFIX}${name}`
)

export function isGradientCover(cover: string): cover is `${typeof GRADIENT_PREFIX}${CoverName}` {
  if (!cover.startsWith(GRADIENT_PREFIX)) return false
  const name = cover.slice(GRADIENT_PREFIX.length)
  return Object.prototype.hasOwnProperty.call(GRADIENT_COVERS, name)
}

export function isCoverUrl(cover: string): boolean {
  return /^https?:\/\//i.test(cover) || cover.startsWith('/api/attachments/')
}

/**
 * Converte il valore di copertina in uno stile CSS applicabile a un div:
 * - null → null (nessuna copertina);
 * - "gradient:<nome>" → backgroundImage col gradiente;
 * - URL → backgroundImage con url(...) (usabile per anteprime; per la fascia
 *   a dimensione piena si preferisce un <img> con object-cover).
 */
export function coverToStyle(cover: string | null): CSSProperties | null {
  if (!cover) return null
  if (isGradientCover(cover)) {
    return { backgroundImage: GRADIENT_COVERS[cover.slice(GRADIENT_PREFIX.length)] }
  }
  if (isCoverUrl(cover)) {
    return { backgroundImage: `url("${cover.replace(/"/g, '%22')}")` }
  }
  return null
}
