/**
 * Taccuino — /api/pages/[id]/versions/[versionId]
 * GET : snapshot completa di una versione (titolo + blocchi) per il confronto
 * delle differenze con il contenuto attuale (funzione che Notion non ha).
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, notFound } from '@/lib/blocks-db'
import type { Block } from '@/lib/types'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string; versionId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id, versionId } = await params
    const page = await db.page.findUnique({ where: { id }, select: { id: true } })
    if (!page) throw notFound()

    const version = await db.version.findUnique({ where: { id: versionId } })
    if (!version || version.pageId !== id) throw notFound()

    let blocks: Block[] = []
    try {
      const parsed: unknown = JSON.parse(version.blocks)
      if (Array.isArray(parsed)) blocks = parsed as Block[]
    } catch {
      blocks = []
    }

    return NextResponse.json({
      version: {
        id: version.id,
        title: version.title,
        createdAt: version.createdAt.toISOString(),
        blocks,
      },
    })
  } catch (e) {
    return errorResponse(e)
  }
}
