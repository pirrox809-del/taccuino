/**
 * Taccuino — /api/search?q=...
 * GET : ricerca per titolo o contenuto dei blocchi, con snippet contestuale.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { stripInlineHtml } from '@/lib/markdown'
import { SearchHit } from '@/lib/types'
import { errorResponse } from '@/lib/blocks-db'

export const dynamic = 'force-dynamic'

const SNIPPET_LENGTH = 150
const HALF_WINDOW = 75

function buildSnippet(blocks: Array<{ content: string }>, q: string): string {
  const stripped = blocks.map((b) => stripInlineHtml(b.content))
  const lowerQ = q.toLowerCase()

  let text = ''
  let at = -1
  for (const candidate of stripped) {
    const index = candidate.toLowerCase().indexOf(lowerQ)
    if (index !== -1) {
      text = candidate
      at = index
      break
    }
  }

  if (at === -1) {
    // match solo nel titolo: primi caratteri del primo blocco non vuoto
    const first = stripped.find((s) => s.length > 0)
    return first ? first.slice(0, SNIPPET_LENGTH) : ''
  }

  const start = Math.max(0, at - HALF_WINDOW)
  const end = Math.min(text.length, at + q.length + HALF_WINDOW)
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
}

export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
    if (!q) {
      return NextResponse.json({ results: [], query: '' })
    }

    const pages = await db.page.findMany({
      where: {
        deletedAt: null,
        OR: [{ title: { contains: q } }, { blocks: { some: { content: { contains: q } } } }],
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      include: { blocks: { orderBy: { position: 'asc' } } },
    })

    const results: SearchHit[] = pages.map((p) => ({
      pageId: p.id,
      title: p.title,
      icon: p.icon,
      snippet: buildSnippet(p.blocks, q),
      updatedAt: p.updatedAt.toISOString(),
    }))

    // righe dei database: titolo, icona e valori delle celle cercati come testo
    const rows = await db.row.findMany({
      where: {
        database: { page: { deletedAt: null } },
        OR: [{ title: { contains: q } }, { properties: { contains: q } }],
      },
      orderBy: { position: 'asc' },
      take: 10,
      include: {
        database: { select: { pageId: true, page: { select: { title: true, updatedAt: true } } } },
      },
    })

    for (const row of rows) {
      if (results.length >= 25) break
      if (row.title.toLowerCase().includes(q.toLowerCase()) || row.properties.includes(q)) {
        results.push({
          pageId: row.database.pageId,
          title: row.title,
          icon: row.icon,
          snippet: row.database.page.title,
          updatedAt: row.database.page.updatedAt.toISOString(),
          isRow: true,
          rowId: row.id,
        })
      }
    }

    return NextResponse.json({ results: results.slice(0, 25), query: q })
  } catch (e) {
    return errorResponse(e)
  }
}
