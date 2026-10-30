/**
 * Taccuino — /api/import
 * POST : importa un file .md/.markdown (una pagina) oppure uno .zip (albero di pagine).
 *       Gli ZIP sono trattati come input ostile: guardie su dimensioni, numero file
 *       e percorsi; nessuna esecuzione di contenuti.
 */
import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { db } from '@/lib/db'
import {
  DEFAULT_DATABASE_PROPERTIES,
  blockToRowData,
  HttpError,
  errorResponse,
  nextSiblingPosition,
  sanitizeBlocks,
  sanitizeDatabaseProperties,
} from '@/lib/blocks-db'
import {
  analyzeZipEntryPath,
  cleanImportName,
  emptyParagraph,
  pageFromMarkdown,
  stripExtension,
} from '@/lib/markdown'
import { csvToDatabase } from '@/lib/csv'
import { Block } from '@/lib/types'

export const dynamic = 'force-dynamic'

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024 // 20 MB
const MAX_MD_FILES = 500
const MAX_TOTAL_DECOMPRESSED = 50 * 1024 * 1024 // 50 MB

async function createImportedPage(
  title: string,
  blocks: Block[],
  parentId: string | null,
  counters: Map<string, number> | null,
): Promise<string> {
  const key = parentId ?? '__root__'
  let position: number
  if (counters) {
    const next = counters.get(key)
    position = next === undefined ? await nextSiblingPosition(parentId) : next
    counters.set(key, position + 1)
  } else {
    position = await nextSiblingPosition(parentId)
  }
  const safeBlocks = sanitizeBlocks(blocks)
  const page = await db.page.create({
    data: {
      title,
      parentId,
      position,
      blocks: { create: safeBlocks.map((block, i) => blockToRowData(block, i)) },
    },
  })
  return page.id
}

/** Crea una pagina-database da un CSV (stile export Notion: 1ª colonna = titolo). */
async function createImportedDatabase(
  title: string,
  csvText: string,
  parentId: string | null,
  counters: Map<string, number> | null,
): Promise<string> {
  const key = parentId ?? '__root__'
  let position: number
  if (counters) {
    const next = counters.get(key)
    position = next === undefined ? await nextSiblingPosition(parentId) : next
    counters.set(key, position + 1)
  } else {
    position = await nextSiblingPosition(parentId)
  }

  const parsed = csvToDatabase(csvText)
  // se il CSV non ha colonne utili, lo schema resta quello predefinito
  const properties =
    parsed.properties.length > 0 ? sanitizeDatabaseProperties(parsed.properties) : DEFAULT_DATABASE_PROPERTIES

  const page = await db.page.create({
    data: {
      title,
      parentId,
      position,
      kind: 'database',
      database: {
        create: {
          properties: JSON.stringify(properties),
          rows: {
            create: parsed.rows.map((row, i) => ({
              title: row.title,
              properties: JSON.stringify(row.properties),
              position: i,
            })),
          },
        },
      },
    },
  })
  return page.id
}

export async function POST(req: NextRequest) {
  try {
    let form: FormData
    try {
      form = await req.formData()
    } catch {
      throw new HttpError(400, 'Body multipart/form-data non valido')
    }

    const fileValue = form.get('file')
    if (!(fileValue instanceof File)) {
      throw new HttpError(400, 'Campo "file" mancante')
    }
    const file = fileValue
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new HttpError(400, 'File troppo grande: il limite è 20 MB')
    }

    let parentId: string | null = null
    const parentIdRaw = form.get('parentId')
    if (typeof parentIdRaw === 'string' && parentIdRaw.length > 0) {
      const parent = await db.page.findUnique({ where: { id: parentIdRaw } })
      if (!parent || parent.deletedAt != null) {
        throw new HttpError(400, 'parentId non valido: la pagina genitore non esiste o è nel cestino')
      }
      parentId = parentIdRaw
    }

    const lowerName = file.name.toLowerCase()

    // --- singolo file Markdown ---
    if (lowerName.endsWith('.md') || lowerName.endsWith('.markdown')) {
      const text = await file.text()
      const fallbackTitle = cleanImportName(stripExtension(file.name))
      const { title, blocks } = pageFromMarkdown(text, fallbackTitle)
      await createImportedPage(title, blocks, parentId, null)
      return NextResponse.json({ created: 1, skipped: 0 })
    }

    // --- singolo file CSV → database ---
    if (lowerName.endsWith('.csv')) {
      const text = await file.text()
      const title = cleanImportName(stripExtension(file.name)) || 'Database'
      await createImportedDatabase(title, text, parentId, null)
      return NextResponse.json({ created: 1, skipped: 0 })
    }

    // --- archivio ZIP ---
    if (lowerName.endsWith('.zip')) {
      const buffer = await file.arrayBuffer()
      let zip: JSZip
      try {
        zip = await JSZip.loadAsync(buffer)
      } catch {
        throw new HttpError(400, 'File ZIP non valido o corrotto')
      }

      const entries = Object.values(zip.files).filter((entry) => !entry.dir)
      // i genitori esistono prima dei figli: ordina per profondità del percorso
      entries.sort((a, b) => {
        const depth = a.name.split('/').length - b.name.split('/').length
        return depth !== 0 ? depth : a.name.localeCompare(b.name)
      })

      const rootKey = parentId ?? '__root__'
      const folderPages = new Map<string, string>()
      const positionCounters = new Map<string, number>()
      let created = 0
      let skipped = 0
      let mdProcessed = 0
      let totalBytes = 0

      for (const entry of entries) {
        const analysis = analyzeZipEntryPath(entry.name)
        if (analysis === null) {
          skipped++
          continue
        }
        if (mdProcessed >= MAX_MD_FILES) {
          skipped++
          continue
        }
        let bytes: Uint8Array
        try {
          bytes = await entry.async('uint8array')
        } catch {
          skipped++
          continue
        }
        totalBytes += bytes.length
        if (totalBytes > MAX_TOTAL_DECOMPRESSED) {
          skipped++
          continue
        }
        mdProcessed++

        const segments = analysis.segments
        const dirs = segments.slice(0, -1)
        const fileName = segments[segments.length - 1]

        // crea (una sola volta per percorso) le pagine-cartella intermedie
        let currentParentId = parentId
        let currentKey = rootKey
        for (const dir of dirs) {
          currentKey = `${currentKey}/${dir}`
          let folderId = folderPages.get(currentKey)
          if (folderId === undefined) {
            const folderTitle = cleanImportName(dir) || 'Senza titolo'
            folderId = await createImportedPage(folderTitle, [emptyParagraph()], currentParentId, positionCounters)
            folderPages.set(currentKey, folderId)
            created++
          }
          currentParentId = folderId
        }

        const text = new TextDecoder().decode(bytes)
        const fallbackTitle = cleanImportName(stripExtension(fileName))
        if (/\.csv$/i.test(fileName)) {
          await createImportedDatabase(fallbackTitle || 'Database', text, currentParentId, positionCounters)
        } else {
          const { title, blocks } = pageFromMarkdown(text, fallbackTitle)
          await createImportedPage(title, blocks, currentParentId, positionCounters)
        }
        created++
      }

      return NextResponse.json({ created, skipped })
    }

    throw new HttpError(400, 'Formato non supportato: sono ammessi file .md, .markdown, .csv o .zip')
  } catch (e) {
    return errorResponse(e)
  }
}
