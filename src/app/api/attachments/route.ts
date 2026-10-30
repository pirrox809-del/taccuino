/**
 * Taccuino — /api/attachments
 * POST : carica un'immagine (PNG/JPEG/GIF/WebP, max 4 MB) salvandola in base64.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { HttpError, errorResponse } from '@/lib/blocks-db'

export const dynamic = 'force-dynamic'

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
const MAX_SIZE = 4 * 1024 * 1024 // 4 MB

export async function POST(req: NextRequest) {
  try {
    let form: FormData
    try {
      form = await req.formData()
    } catch {
      throw new HttpError(400, 'Body multipart/form-data non valido')
    }

    const fileValue = form.get('file')
    if (!(fileValue instanceof File)) {
      throw new HttpError(400, 'Campo "file" mancante')
    }
    const file = fileValue

    if (!ALLOWED_MIME.has(file.type)) {
      throw new HttpError(400, 'Formato non supportato: sono ammesse immagini PNG, JPEG, GIF o WebP')
    }
    if (file.size > MAX_SIZE) {
      throw new HttpError(400, 'Immagine troppo grande: il limite è 4 MB')
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const attachment = await db.attachment.create({
      data: {
        mime: file.type,
        size: file.size,
        data: buffer.toString('base64'),
      },
    })

    return NextResponse.json({ url: `/api/attachments/${attachment.id}` }, { status: 201 })
  } catch (e) {
    return errorResponse(e)
  }
}
