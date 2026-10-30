/**
 * Taccuino — /api/stats
 * GET : statistiche di scrittura per streak e obiettivo giornaliero.
 *
 * - today  : parole totali "in pagina" scritte oggi (somma degli snapshot
 *            per pagina, vedi recordWritingDay)
 * - streak : giorni consecutivi con parole > 0, contando oggi oppure ieri
 *            (la streak non si "rompe" finché non salti due giorni)
 * - days   : ultimi 14 giorni [{ date, words }] per il mini-grafico
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, localDateString } from '@/lib/blocks-db'

export const dynamic = 'force-dynamic'

/** Chiave "YYYY-MM-DD" di `offsetDays` giorni fa (0 = oggi), data locale. */
function dateKey(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() - offsetDays)
  return localDateString(d)
}

export async function GET() {
  try {
    // totali per giorno: groupBy su date, somma words
    const grouped = await db.writingDay.groupBy({
      by: ['date'],
      _sum: { words: true },
    })
    const totals = new Map(grouped.map((g) => [g.date, g._sum.words ?? 0]))

    const today = totals.get(dateKey(0)) ?? 0

    // streak: conta a ritroso partendo da oggi; se oggi è a 0 parte da ieri
    let cursor = today > 0 ? 0 : 1
    let streak = 0
    while ((totals.get(dateKey(cursor)) ?? 0) > 0) {
      streak += 1
      cursor += 1
      if (cursor > 3650) break // guardia su dati corrotti
    }

    const days = Array.from({ length: 14 }, (_, i) => {
      const key = dateKey(13 - i)
      return { date: key, words: totals.get(key) ?? 0 }
    })

    return NextResponse.json({ today, streak, days })
  } catch (e) {
    return errorResponse(e)
  }
}
