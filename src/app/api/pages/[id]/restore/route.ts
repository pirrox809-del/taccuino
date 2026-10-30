/**
 * Taccuino — /api/pages/[id]/restore
 * POST : riporta la pagina (e i discendenti) fuori dal cestino.
 *        Se un antenato è ancora nel cestino, la pagina viene portata alla root.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  HttpError,
  errorResponse,
  notFound,
  collectDescendantLevels,
  pageRowToMeta,
} from '@/lib/blocks-db'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const page = await db.page.findUnique({ where: { id } })
    if (!page) throw notFound()

    const levels = await collectDescendantLevels(id)
    await db.page.updateMany({
      where: { id: { in: [id, ...levels.flat()] } },
      data: { deletedAt: null },
    })

    // se un antenato è ancora nel cestino, la pagina diventerebbe invisibile: porta alla root
    let trashedAncestor = false
    let cursor = page.parentId
    const seen = new Set<string>()
    while (cursor != null && !seen.has(cursor)) {
      seen.add(cursor)
      const ancestor = await db.page.findUnique({
        where: { id: cursor },
        select: { parentId: true, deletedAt: true },
      })
      if (!ancestor) break
      if (ancestor.deletedAt != null) {
        trashedAncestor = true
        break
      }
      cursor = ancestor.parentId
    }
    if (trashedAncestor) {
      await db.page.update({ where: { id }, data: { parentId: null } })
    }

    const fresh = await db.page.findUnique({ where: { id } })
    if (!fresh) throw new HttpError(500, 'Internal error')
    return NextResponse.json({ page: pageRowToMeta(fresh) })
  } catch (e) {
    return errorResponse(e)
  }
}
