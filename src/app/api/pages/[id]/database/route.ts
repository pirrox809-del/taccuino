/**
 * Taccuino — /api/pages/[id]/database
 * PUT : sostituisce lo schema delle proprietà del database della pagina (array completo).
 *       I valori delle righe esistenti restano intatti: il frontend decide come
 *       mostrarli in base al nuovo schema.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  HttpError,
  errorResponse,
  notFound,
  sanitizeDatabaseProperties,
} from '@/lib/blocks-db'
import { DatabaseInfo } from '@/lib/types'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Params) {
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
    const raw = body as { properties?: unknown }
    if (!('properties' in raw) || !Array.isArray(raw.properties)) {
      throw new HttpError(400, 'Campo "properties" mancante o non array')
    }

    const page = await db.page.findUnique({ where: { id }, include: { database: true } })
    if (!page) throw notFound()
    if (page.kind !== 'database' || !page.database) {
      throw new HttpError(400, 'La pagina non è un database')
    }

    const properties = sanitizeDatabaseProperties(raw.properties)
    await db.database.update({
      where: { id: page.database.id },
      data: { properties: JSON.stringify(properties) },
    })
    await db.page.update({ where: { id }, data: { updatedAt: new Date() } })

    const info: DatabaseInfo = { properties }
    return NextResponse.json({ database: info })
  } catch (e) {
    return errorResponse(e)
  }
}
