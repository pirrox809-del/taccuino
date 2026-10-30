/**
 * Taccuino — /api/pages/[id]
 * GET    : pagina + blocchi (ordinati per position).
 * PATCH  : due modalità esclusive: metadati OPPURE contenuto (blocks).
 * DELETE : soft delete (pagina + discendenti) oppure hard delete con ?hard=1|true.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import {
  HttpError,
  errorResponse,
  notFound,
  blockRowToDto,
  blocksSignature,
  collectDescendantLevels,
  countWordsInBlocks,
  maybeSnapshotVersion,
  nextSiblingPosition,
  pageRowToMeta,
  recordWritingDay,
  rowRecordToDto,
  sanitizeBlocks,
  sanitizeCover,
  writePageBlocks,
} from '@/lib/blocks-db'
import { DatabaseInfo } from '@/lib/types'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

const metaSchema = z.object({
  title: z.string().max(500).optional(),
  icon: z.string().max(16).nullable().optional(),
  parentId: z.string().min(1).nullable().optional(),
  position: z.number().int().optional(),
  isFavorite: z.boolean().optional(),
  cover: z.unknown().optional(),
})

/** true se impostare newParentId come genitore di pageId creerebbe un ciclo. */
async function wouldCreateLoop(pageId: string, newParentId: string): Promise<boolean> {
  let cursor: string | null = newParentId
  const seen = new Set<string>([newParentId])
  while (cursor != null) {
    if (cursor === pageId) return true
    const row = await db.page.findUnique({ where: { id: cursor }, select: { parentId: true } })
    if (!row) return false
    cursor = row.parentId
    if (cursor != null) {
      if (seen.has(cursor)) return false
      seen.add(cursor)
    }
  }
  return false
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const page = await db.page.findUnique({
      where: { id },
      include: {
        blocks: { orderBy: { position: 'asc' } },
        database: { include: { rows: { orderBy: { position: 'asc' } } } },
      },
    })
    if (!page) throw notFound()

    if (page.kind === 'database' && page.database) {
      const info: DatabaseInfo = {
        properties: JSON.parse(page.database.properties) as DatabaseInfo['properties'],
      }
      return NextResponse.json({
        page: pageRowToMeta(page),
        database: info,
        rows: page.database.rows.map(rowRecordToDto),
      })
    }
    return NextResponse.json({ page: pageRowToMeta(page), blocks: page.blocks.map(blockRowToDto) })
  } catch (e) {
    return errorResponse(e)
  }
}

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
    const raw = body as Record<string, unknown>
    const has = (key: string) => Object.prototype.hasOwnProperty.call(raw, key)
    const hasBlocks = has('blocks')
    const hasMeta = ['title', 'icon', 'parentId', 'position', 'isFavorite', 'cover'].some(has)
    if (hasBlocks && hasMeta) {
      throw new HttpError(400, 'Non mescolare metadati e blocchi nella stessa richiesta')
    }

    const page = await db.page.findUnique({
      where: { id },
      include: { blocks: { orderBy: { position: 'asc' } } },
    })
    if (!page) throw notFound()

    // --- modalità contenuto ---
    if (hasBlocks) {
      const newBlocks = sanitizeBlocks(raw.blocks)
      // id duplicati nello stesso payload → rigenerati per non violare la primary key
      const seenIds = new Set<string>()
      for (const block of newBlocks) {
        if (seenIds.has(block.id)) block.id = crypto.randomUUID()
        else seenIds.add(block.id)
      }
      const changed = blocksSignature(newBlocks) !== blocksSignature(page.blocks.map(blockRowToDto))
      await writePageBlocks(id, newBlocks)
      if (changed) {
        await maybeSnapshotVersion(id, page.title, newBlocks)
        // statistiche di scrittura: snapshot parole di questa pagina per oggi
        try {
          await recordWritingDay(id, countWordsInBlocks(newBlocks))
        } catch {
          /* le statistiche non devono mai far fallire il salvataggio */
        }
      }
      const fresh = await db.page.findUnique({ where: { id } })
      if (!fresh) throw notFound()
      return NextResponse.json({ page: pageRowToMeta(fresh) })
    }

    // --- modalità metadati ---
    const input = metaSchema.parse(body)
    const data: {
      title?: string
      icon?: string | null
      parentId?: string | null
      position?: number
      isFavorite?: boolean
      cover?: string | null
    } = {}

    // copertina: sanificazione dedicata (gradient:... oppure URL)
    if (input.cover !== undefined) {
      data.cover = sanitizeCover(input.cover)
    }

    let parentChanged = false
    if (input.parentId !== undefined) {
      const newParent = input.parentId ?? null
      if (newParent !== page.parentId) {
        parentChanged = true
        if (newParent !== null) {
          if (newParent === id) {
            throw new HttpError(400, 'parentId non valido: una pagina non può essere figlia di se stessa')
          }
          const parentRow = await db.page.findUnique({ where: { id: newParent } })
          if (!parentRow || parentRow.deletedAt != null) {
            throw new HttpError(400, 'parentId non valido: la pagina genitore non esiste o è nel cestino')
          }
          if (await wouldCreateLoop(id, newParent)) {
            throw new HttpError(400, 'parentId non valido: creerebbe un ciclo nell\u2019albero delle pagine')
          }
        }
        data.parentId = newParent
      }
    }
    if (input.title !== undefined) data.title = input.title
    if (input.icon !== undefined) data.icon = input.icon ?? null
    if (input.position !== undefined) {
      data.position = input.position
    } else if (parentChanged) {
      data.position = await nextSiblingPosition(data.parentId ?? null)
    }
    if (input.isFavorite !== undefined) data.isFavorite = input.isFavorite

    const updated =
      Object.keys(data).length > 0 ? await db.page.update({ where: { id }, data }) : page
    return NextResponse.json({ page: pageRowToMeta(updated) })
  } catch (e) {
    return errorResponse(e)
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const page = await db.page.findUnique({ where: { id } })
    if (!page) throw notFound()

    const hardParam = req.nextUrl.searchParams.get('hard')
    const hard = hardParam === '1' || hardParam === 'true'

    const levels = await collectDescendantLevels(id)
    const deletedCount = levels.reduce((sum, level) => sum + level.length, 0) + 1

    if (hard) {
      // cancellazione definitiva: prima i discendenti più profondi, infine la pagina
      await db.$transaction(async (tx) => {
        for (let i = levels.length - 1; i >= 0; i--) {
          await tx.page.deleteMany({ where: { id: { in: levels[i] } } })
        }
        await tx.page.delete({ where: { id } })
      })
    } else {
      // soft delete su pagina e tutti i discendenti
      await db.page.updateMany({
        where: { id: { in: [id, ...levels.flat()] } },
        data: { deletedAt: new Date() },
      })
    }

    return NextResponse.json({ ok: true, deletedCount })
  } catch (e) {
    return errorResponse(e)
  }
}
