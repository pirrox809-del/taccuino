'use client'

/**
 * Taccuino — validazione e upload dei file immagine verso /api/attachments.
 * Contratto backend: POST FormData con campo `file` → risposta JSON { url }.
 */
import type { TranslationKey } from '@/lib/i18n'

const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
const MAX_IMAGE_BYTES = 4 * 1024 * 1024

/** Ritorna la chiave i18n dell'errore, oppure null se il file è valido. */
export function validateImageFile(file: File): TranslationKey | null {
  if (!IMAGE_MIME_TYPES.has(file.type)) return 'imageInvalidType'
  if (file.size > MAX_IMAGE_BYTES) return 'imageUploadTooBig'
  return null
}

/** Carica l'immagine e restituisce l'URL pubblico; lancia in caso di errore. */
export async function uploadImageFile(file: File): Promise<string> {
  const body = new FormData()
  body.append('file', file)
  const res = await fetch('/api/attachments', { method: 'POST', body })
  if (!res.ok) throw new Error(`upload failed with status ${res.status}`)
  const data = (await res.json()) as { url?: unknown }
  if (typeof data.url !== 'string' || data.url.length === 0) {
    throw new Error('upload response missing url')
  }
  return data.url
}
