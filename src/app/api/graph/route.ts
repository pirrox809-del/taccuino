/**
 * Taccuino — /api/graph
 * GET : grafo della conoscenza: nodi = pagine vive, archi = relazioni
 * genitore→figlia ("child") e link [[…]] tra pagine ("ref").
 *
 * Notion non offre nulla di simile: qui l'intero workspace diventa una mappa
 * navigabile. I link vengono estratti dai blocchi (data-page-id) e vengono
 * tenuti solo quelli che puntano a pagine esistenti e non cestinate.
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, extractPageLinks } from '@/lib/blocks-db'

export const dynamic = 'force-dynamic'

export interface GraphNode {
  id: string
  title: string
  icon: string | null
  kind: 'doc' | 'database'
  isFavorite: boolean
}

export interface GraphEdge {
  source: string
  target: string
  kind: 'child' | 'ref'
}

export async function GET() {
  try {
    const pages = await db.page.findMany({
      where: { deletedAt: null },
      select: { id: true, title: true, icon: true, kind: true, isFavorite: true, parentId: true },
      orderBy: { position: 'asc' },
    })

    const liveIds = new Set(pages.map((p) => p.id))
    const nodes: GraphNode[] = pages.map((p) => ({
      id: p.id,
      title: p.title,
      icon: p.icon,
      kind: p.kind === 'database' ? 'database' : 'doc',
      isFavorite: p.isFavorite,
    }))

    const edgeSet = new Set<string>()
    const edges: GraphEdge[] = []

    const addEdge = (source: string, target: string, kind: 'child' | 'ref') => {
      if (!liveIds.has(source) || !liveIds.has(target) || source === target) return
      const key = `${kind}:${source}->${target}`
      if (edgeSet.has(key)) return
      edgeSet.add(key)
      edges.push({ source, target, kind })
    }

    // archi genitore → figlia
    for (const p of pages) {
      if (p.parentId) addEdge(p.parentId, p.id, 'child')
    }

    // archi link [[…]]: si mappano dal blocco che contiene il link (pagina
    // sorgente) alla pagina collegata (destinazione)
    const blocks = await db.block.findMany({
      where: { content: { contains: 'data-page-id' } },
      select: { pageId: true, content: true },
    })
    for (const b of blocks) {
      for (const target of extractPageLinks(b.content)) {
        addEdge(b.pageId, target, 'ref')
      }
    }

    return NextResponse.json({ nodes, edges })
  } catch (e) {
    return errorResponse(e)
  }
}
