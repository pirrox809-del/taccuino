/**
 * Taccuino — /api/pages/[id]/versions/[versionId]/restore
 * POST : sostituisce i blocchi della pagina con quelli della snapshot.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  HttpError,
  errorResponse,
  notFound,
  blockRowToDto,
  pageRowToMeta,
  sanitizeBlocks,
  writePageBlocks,
} from '@/lib/blocks-db'
import { Block } from '@/lib/types'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string; versionId: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id, versionId } = await params
    const page = await db.page.findUnique({ where: { id }, select: { id: true } })
    if (!page) throw notFound()

    const version = await db.version.findFirst({ where: { id: versionId, pageId: id } })
    if (!version) throw notFound()

    let blocks: Block[] = []
    try {
      blocks = sanitizeBlocks(JSON.parse(version.blocks))
    } catch {
      blocks = []
    }

    await writePageBlocks(id, blocks)

    const fresh = await db.page.findUnique({ where: { id } })
    if (!fresh) throw new HttpError(500, 'Internal error')
    const rows = await db.block.findMany({ where: { pageId: id }, orderBy: { position: 'asc' } })
    return NextResponse.json({ page: pageRowToMeta(fresh), blocks: rows.map(blockRowToDto) })
  } catch (e) {
    return errorResponse(e)
  }
}
