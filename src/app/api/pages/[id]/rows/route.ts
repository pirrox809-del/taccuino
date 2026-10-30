/**
 * Taccuino — /api/pages/[id]/rows
 * GET  : elenco righe del database della pagina (ordinate per position).
 * POST : creazione riga (title, icon, properties, position opzionali).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import {
  HttpError,
  errorResponse,
  nextRowPosition,
  notFound,
  rowRecordToDto,
  sanitizeRowProperties,
} from '@/lib/blocks-db'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

const createRowSchema = z.object({
  title: z.string().max(500).default(''),
  icon: z.string().max(16).nullable().optional(),
  properties: z.unknown().optional(),
  position: z.number().int().optional(),
})

async function getDatabaseOrThrow(pageId: string) {
  const page = await db.page.findUnique({ where: { id: pageId }, include: { database: true } })
  if (!page) throw notFound()
  if (page.kind !== 'database' || !page.database) {
    throw new HttpError(400, 'La pagina non è un database')
  }
  return page.database
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const database = await getDatabaseOrThrow(id)
    const rows = await db.row.findMany({
      where: { databaseId: database.id },
      orderBy: { position: 'asc' },
    })
    return NextResponse.json({ rows: rows.map(rowRecordToDto) })
  } catch (e) {
    return errorResponse(e)
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    let body: unknown = {}
    try {
      body = await req.json()
    } catch {
      body = {}
    }
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      throw new HttpError(400, 'Body non valido: atteso un oggetto JSON')
    }
    const input = createRowSchema.parse(body)
    const database = await getDatabaseOrThrow(id)

    const position = input.position ?? (await nextRowPosition(database.id))
    const row = await db.row.create({
      data: {
        databaseId: database.id,
        title: input.title,
        icon: input.icon ?? null,
        properties: JSON.stringify(sanitizeRowProperties(input.properties)),
        position,
      },
    })
    await db.page.update({ where: { id }, data: { updatedAt: new Date() } })
    return NextResponse.json({ row: rowRecordToDto(row) }, { status: 201 })
  } catch (e) {
    return errorResponse(e)
  }
}
