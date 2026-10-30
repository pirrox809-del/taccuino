/**
 * Taccuino — /api/export
 * GET : ZIP dell'intero workspace (solo pagine fuori dal cestino).
 *      Ogni pagina diventa una cartella <slug>/ con dentro <slug>.md;
 *      le figlie diventano sottocartelle; collisioni di slug → suffisso -2, -3…
 */
import { NextResponse } from 'next/server'
import JSZip from 'jszip'
import { db } from '@/lib/db'
import {
  errorResponse,
  blockRowToDto,
  rowRecordToDto,
  BlockRow,
  PageRow,
  RowRecord,
} from '@/lib/blocks-db'
import { blocksToMarkdown, slugifyTitle } from '@/lib/markdown'
import { databaseToCsv } from '@/lib/csv'
import { DatabaseInfo } from '@/lib/types'

export const dynamic = 'force-dynamic'

type ExportablePage = PageRow & {
  blocks: BlockRow[]
  database: { id: string; pageId: string; properties: string; rows: RowRecord[] } | null
}

function uniqueSlug(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base)
    return base
  }
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`
    if (!used.has(candidate)) {
      used.add(candidate)
      return candidate
    }
  }
}

export async function GET() {
  try {
    const pages = await db.page.findMany({
      where: { deletedAt: null },
      include: {
        blocks: { orderBy: { position: 'asc' } },
        database: { include: { rows: { orderBy: { position: 'asc' } } } },
      },
    })

    const byId = new Map(pages.map((p) => [p.id, p as ExportablePage]))
    const childrenByParent = new Map<string, ExportablePage[]>()
    for (const page of pages) {
      const key = page.parentId ?? '__root__'
      const list = childrenByParent.get(key) ?? []
      list.push(page as ExportablePage)
      childrenByParent.set(key, list)
    }

    const zip = new JSZip()
    const usedByParent = new Map<string, Set<string>>()
    const visited = new Set<string>()

    const walk = (page: ExportablePage, parentPath: string | null) => {
      if (visited.has(page.id)) return
      visited.add(page.id)

      const used = usedByParent.get(page.parentId ?? '__root__') ?? new Set<string>()
      usedByParent.set(page.parentId ?? '__root__', used)
      const slug = uniqueSlug(slugifyTitle(page.title), used)
      const path = parentPath ? `${parentPath}/${slug}` : slug

      if (page.kind === 'database' && page.database) {
        // i database si esportano in CSV (compatibile con l'export Notion)
        const info: DatabaseInfo = {
          properties: JSON.parse(page.database.properties) as DatabaseInfo['properties'],
        }
        const csv = databaseToCsv(info.properties, page.database.rows.map(rowRecordToDto))
        zip.file(`${path}/${slug}.csv`, csv)
      } else {
        const title = page.title.replace(/[\r\n]+/g, ' ')
        const md = (title ? `# ${title}\n\n` : '') + blocksToMarkdown(page.blocks.map(blockRowToDto))
        zip.file(`${path}/${slug}.md`, md)
      }

      for (const child of childrenByParent.get(page.id) ?? []) {
        walk(child, path)
      }
    }

    for (const page of pages) {
      // radici: senza genitore, oppure con genitore assente/trashato (difensivo)
      if (page.parentId == null || !byId.has(page.parentId)) {
        walk(page as ExportablePage, null)
      }
    }

    const bytes = await zip.generateAsync({ type: 'arraybuffer' })
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="taccuino-workspace.zip"',
      },
    })
  } catch (e) {
    return errorResponse(e)
  }
}
