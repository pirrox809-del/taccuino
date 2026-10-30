/**
 * Taccuino — /api/pages/[id]/versions
 * GET : elenco delle snapshot di versione, dalla più recente.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, notFound, snapshotBlockCount } from '@/lib/blocks-db'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const page = await db.page.findUnique({ where: { id }, select: { id: true } })
    if (!page) throw notFound()

    const versions = await db.version.findMany({
      where: { pageId: id },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({
      versions: versions.map((v) => ({
        id: v.id,
        title: v.title,
        blockCount: snapshotBlockCount(v.blocks),
        createdAt: v.createdAt.toISOString(),
      })),
    })
  } catch (e) {
    return errorResponse(e)
  }
}
