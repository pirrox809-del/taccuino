/**
 * Taccuino — /api/pages/[id]/backlinks
 * GET : pagine non eliminate che contengono un link a questa pagina
 *       (blocchi con <a data-page-id="...">). Restituisce id, titolo, icona
 *       e uno snippet HTML con <mark> attorno al contesto del link.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, extractPageLinks, notFound } from '@/lib/blocks-db'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

const SNIPPET_RADIUS = 80

/** Ritaglia un contesto testuale attorno alla prima occorrenza del link e lo marca. */
function buildSnippet(content: string): string {
  const m = /data-page-id="[^"]+"/.exec(content)
  if (!m) return content.slice(0, SNIPPET_RADIUS * 2).trim()
  const around = content.slice(Math.max(0, m.index - SNIPPET_RADIUS), m.index + m[0].length + SNIPPET_RADIUS)
  return around.replace(/(<\/?)mark(\s*>|>)/gi, '').replace(/(<a\s)/i, '<mark>$1')
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const target = await db.page.findUnique({ where: { id }, select: { id: true } })
    if (!target) throw notFound()

    // tutti i blocchi delle pagine vive (il volume tipico è gestibile: LIKE prefiltra)
    const blocks = await db.block.findMany({
      where: { content: { contains: `data-page-id="${id}"` }, page: { deletedAt: null } },
      include: { page: { select: { id: true, title: true, icon: true } } },
      orderBy: { position: 'asc' },
    })

    const seen = new Map<string, { pageId: string; title: string; icon: string | null; snippet: string }>()
    for (const block of blocks) {
      if (block.page.id === id) continue
      if (!extractPageLinks(block.content).includes(id)) continue
      const existing = seen.get(block.page.id)
      if (!existing) {
        seen.set(block.page.id, {
          pageId: block.page.id,
          title: block.page.title,
          icon: block.page.icon,
          snippet: buildSnippet(block.content),
        })
      }
    }

    return NextResponse.json({ backlinks: [...seen.values()] })
  } catch (e) {
    return errorResponse(e)
  }
}
