/**
 * Taccuino — /api/rows/[id]
 * PATCH  : aggiornamento riga (title, icon, properties, position).
 * DELETE : eliminazione definitiva della riga.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import {
  HttpError,
  errorResponse,
  notFound,
  rowRecordToDto,
  sanitizeRowProperties,
} from '@/lib/blocks-db'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

const updateRowSchema = z.object({
  title: z.string().max(500).optional(),
  icon: z.string().max(16).nullable().optional(),
  properties: z.unknown().optional(),
  position: z.number().int().optional(),
})

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    let body: unknown
    try {
      body = await req.json()
    } catch {
      throw new HttpError(400, 'Body JSON non valido')
    }
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      throw new HttpError(400, 'Body non valido: atteso un oggetto JSON')
    }
    const input = updateRowSchema.parse(body)

    const row = await db.row.findUnique({ where: { id }, include: { database: { select: { pageId: true } } } })
    if (!row) throw notFound()

    const data: {
      title?: string
      icon?: string | null
      properties?: string
      position?: number
    } = {}
    if (input.title !== undefined) data.title = input.title
    if (input.icon !== undefined) data.icon = input.icon ?? null
    if (input.properties !== undefined) data.properties = JSON.stringify(sanitizeRowProperties(input.properties))
    if (input.position !== undefined) data.position = input.position

    const updated =
      Object.keys(data).length > 0 ? await db.row.update({ where: { id }, data }) : row
    await db.page.update({ where: { id: row.database.pageId }, data: { updatedAt: new Date() } })
    return NextResponse.json({ row: rowRecordToDto(updated) })
  } catch (e) {
    return errorResponse(e)
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const row = await db.row.findUnique({ where: { id }, include: { database: { select: { pageId: true } } } })
    if (!row) throw notFound()
    await db.row.delete({ where: { id } })
    await db.page.update({ where: { id: row.database.pageId }, data: { updatedAt: new Date() } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return errorResponse(e)
  }
}
