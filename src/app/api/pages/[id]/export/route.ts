/**
 * Taccuino — /api/pages/[id]/export
 * GET : scarica la pagina come file Markdown (documento) o CSV (database).
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, notFound, blockRowToDto, rowRecordToDto } from '@/lib/blocks-db'
import { blocksToMarkdown, slugifyTitle } from '@/lib/markdown'
import { databaseToCsv } from '@/lib/csv'
import { DatabaseInfo } from '@/lib/types'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const page = await db.page.findUnique({
      where: { id },
      include: {
        blocks: { orderBy: { position: 'asc' } },
        database: { include: { rows: { orderBy: { position: 'asc' } } } },
      },
    })
    if (!page) throw notFound()

    const slug = slugifyTitle(page.title)
    const asciiFallback = slug.replace(/[^a-zA-Z0-9-]/g, '') || 'pagina'

    if (page.kind === 'database' && page.database) {
      const info: DatabaseInfo = {
        properties: JSON.parse(page.database.properties) as DatabaseInfo['properties'],
      }
      const csv = databaseToCsv(info.properties, page.database.rows.map(rowRecordToDto))
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${asciiFallback}.csv"; filename*=UTF-8''${encodeURIComponent(slug)}.csv`,
        },
      })
    }

    const title = page.title.replace(/[\r\n]+/g, ' ')
    const body = (title ? `# ${title}\n\n` : '') + blocksToMarkdown(page.blocks.map(blockRowToDto))
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${asciiFallback}.md"; filename*=UTF-8''${encodeURIComponent(slug)}.md`,
      },
    })
  } catch (e) {
    return errorResponse(e)
  }
}
