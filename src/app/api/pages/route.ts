/**
 * Taccuino — /api/pages
 * GET  : elenco di TUTTE le pagine (cestino incluso). Al primo avvio esegue il seed.
 * POST : creazione pagina.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import {
  DEFAULT_DATABASE_PROPERTIES,
  HttpError,
  errorResponse,
  nextSiblingPosition,
  pageRowToMeta,
} from '@/lib/blocks-db'
import { seedIfEmpty } from '@/lib/seed'

export const dynamic = 'force-dynamic'

const createPageSchema = z.object({
  title: z.string().max(500).default(''),
  parentId: z.string().min(1).nullable().optional(),
  icon: z.string().max(16).nullable().optional(),
  position: z.number().int().optional(),
  kind: z.enum(['doc', 'database']).default('doc'),
})

export async function GET() {
  try {
    await seedIfEmpty()
    const pages = await db.page.findMany({
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    })
    return NextResponse.json({ pages: pages.map(pageRowToMeta) })
  } catch (e) {
    return errorResponse(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      throw new HttpError(400, 'Body JSON non valido')
    }
    const input = createPageSchema.parse(body)

    if (input.parentId != null) {
      const parent = await db.page.findUnique({ where: { id: input.parentId } })
      if (!parent || parent.deletedAt != null) {
        throw new HttpError(400, 'parentId non valido: la pagina genitore non esiste o è nel cestino')
      }
    }

    const position = input.position ?? (await nextSiblingPosition(input.parentId ?? null))

    const page = await db.page.create({
      data: {
        title: input.title,
        parentId: input.parentId ?? null,
        icon: input.icon ?? null,
        position,
        kind: input.kind,
        // un database nasce con lo schema predefinito (Stato: Da fare / In corso / Fatto)
        database:
          input.kind === 'database'
            ? { create: { properties: JSON.stringify(DEFAULT_DATABASE_PROPERTIES) } }
            : undefined,
      },
    })
    return NextResponse.json({ page: pageRowToMeta(page) }, { status: 201 })
  } catch (e) {
    return errorResponse(e)
  }
}
