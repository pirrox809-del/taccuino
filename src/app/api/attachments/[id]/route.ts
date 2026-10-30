/**
 * Taccuino — /api/attachments/[id]
 * GET : restituisce i byte dell'allegato con cache immutabile.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, notFound } from '@/lib/blocks-db'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const attachment = await db.attachment.findUnique({ where: { id } })
    if (!attachment) throw notFound()

    const bytes = new Uint8Array(Buffer.from(attachment.data, 'base64'))
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': attachment.mime,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (e) {
    return errorResponse(e)
  }
}
