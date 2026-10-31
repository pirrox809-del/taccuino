/**
 * Taccuino — /api/quick-capture
 * POST { text } : salva il pensiero come uno o più blocchi di testo nella
 * pagina "Inbox", creandola al volo se manca. Pensato per la cattura rapida
 * senza lasciare la pagina corrente. Tutto resta nel database locale.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import {
  HttpError,
  blockRowToDto,
  errorResponse,
  nextSiblingPosition,
  writePageBlocks,
} from '@/lib/blocks-db'
import type { Block } from '@/lib/types'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  text: z.string().min(1).max(4_000),
})

const MAX_LINES = 50

/** Il contenuto dei blocchi è HTML: le righe di testo puro vanno "escaped". */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function POST(req: NextRequest) {
  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      throw new HttpError(400, 'Body JSON non valido')
    }
    const { text } = bodySchema.parse(body)

    // trova (o crea) la pagina Inbox: una sola per workspace
    let inbox = await db.page.findFirst({
      where: { title: 'Inbox', deletedAt: null, kind: 'doc' },
      orderBy: { createdAt: 'asc' },
    })
    if (!inbox) {
      const position = await nextSiblingPosition(null)
      inbox = await db.page.create({
        data: { title: 'Inbox', icon: '📥', kind: 'doc', position },
      })
    }

    const existing = await db.block.findMany({
      where: { pageId: inbox.id },
      orderBy: { position: 'asc' },
    })
    const blocks: Block[] = existing.map(blockRowToDto)

    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .slice(0, MAX_LINES)

    for (const line of lines) {
      blocks.push({
        id: crypto.randomUUID(),
        type: 'paragraph',
        content: escapeHtml(line),
      })
    }

    await writePageBlocks(inbox.id, blocks)

    return NextResponse.json({ page: { id: inbox.id } })
  } catch (e) {
    return errorResponse(e)
  }
}
