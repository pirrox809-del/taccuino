'use client'

/**
 * Taccuino — vista grafo della conoscenza (funzione che Notion non ha).
 *
 * Mappa interattiva dell'intero workspace su canvas: i nodi sono le pagine
 * (dimensione ∝ numero di collegamenti), gli archi chiari sono i legami
 * gerarchici genitore→figlia, gli archi colorati sono i link [[…]].
 *
 * Interazioni: trascina i nodi, trascina lo sfondo per spostarti, rotella o
 * pizzico per lo zoom, clic su un nodo per aprire la pagina. La simulazione
 * a forze (repulsione + molle + gravità al centro) è scritta a mano: zero
 * dipendenze, resta fluida anche su grafi grandi.
 */
import * as React from 'react'
import { Maximize, Minus, Plus, Waypoints, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

interface GraphNodeDto {
  id: string
  title: string
  icon: string | null
  kind: 'doc' | 'database'
  isFavorite: boolean
}

interface GraphEdgeDto {
  source: string
  target: string
  kind: 'child' | 'ref'
}

interface SimNode extends GraphNodeDto {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  degree: number
}

export interface GraphViewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentPageId: string | null
  onSelectPage: (id: string) => void
}

/** Colori del tema letti dalle variabili CSS (invalidate a cambio tema/accento). */
function readThemeColors() {
  const style = getComputedStyle(document.documentElement)
  const get = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  return {
    primary: get('--primary', '#b3593a'),
    foreground: get('--foreground', '#241a12'),
    muted: get('--muted-foreground', '#8a7a6a'),
    border: get('--border', '#e5ddd2'),
    database: get('--chart-3', '#d9a437'),
  }
}

const MAX_LABEL = 24

function truncate(text: string): string {
  return text.length > MAX_LABEL ? `${text.slice(0, MAX_LABEL - 1)}…` : text
}

export function GraphView({ open, onOpenChange, currentPageId, onSelectPage }: GraphViewProps) {
  const { t } = useI18n()
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const wrapRef = React.useRef<HTMLDivElement | null>(null)

  // ---- dati e simulazione (fuori da React: mutati direttamente) ----
  const simRef = React.useRef<{
    nodes: SimNode[]
    edges: GraphEdgeDto[]
    neighbors: Map<string, Set<string>>
    scale: number
    tx: number
    ty: number
    alpha: number
    hovered: string | null
    draggingId: string | null
    dragOffset: { dx: number; dy: number }
    panning: boolean
    lastPointer: { x: number; y: number } | null
    moved: boolean
    width: number
    height: number
    pointers: Map<number, { x: number; y: number }>
    pinchDist: number | null
  }>({
    nodes: [],
    edges: [],
    neighbors: new Map(),
    scale: 1,
    tx: 0,
    ty: 0,
    alpha: 1,
    hovered: null,
    draggingId: null,
    dragOffset: { dx: 0, dy: 0 },
    panning: false,
    lastPointer: null,
    moved: false,
    width: 0,
    height: 0,
    pointers: new Map(),
    pinchDist: null,
  })

  const [loading, setLoading] = React.useState(false)
  const [empty, setEmpty] = React.useState(false)
  const [counts, setCounts] = React.useState({ pages: 0, links: 0, refLinks: 0 })
  /** Copia React dei nodi per l'elenco accessibile e i conteggi. */
  const [a11yNodes, setA11yNodes] = React.useState<GraphNodeDto[]>([])
  /** true quando il canvas è montato nel DOM (Radix monta il portale in ritardo). */
  const [canvasMounted, setCanvasMounted] = React.useState(false)

  const colorsRef = React.useRef({
    primary: '#b3593a',
    foreground: '#241a12',
    muted: '#8a7a6a',
    border: '#e5ddd2',
    database: '#d9a437',
  })
  React.useEffect(() => {
    if (!open) return
    const update = () => {
      colorsRef.current = readThemeColors()
    }
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-accent'] })
    return () => observer.disconnect()
  }, [open])

  // ---- caricamento dati ----
  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setEmpty(false)
    fetch('/api/graph')
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status))
        return (await res.json()) as { nodes: GraphNodeDto[]; edges: GraphEdgeDto[] }
      })
      .then((data) => {
        if (cancelled) return
        const sim = simRef.current
        const ids = new Set(data.nodes.map((n) => n.id))
        const edges = data.edges.filter((e) => ids.has(e.source) && ids.has(e.target))
        const degree = new Map<string, number>()
        const neighbors = new Map<string, Set<string>>()
        for (const e of edges) {
          degree.set(e.source, (degree.get(e.source) ?? 0) + 1)
          degree.set(e.target, (degree.get(e.target) ?? 0) + 1)
          if (!neighbors.has(e.source)) neighbors.set(e.source, new Set())
          if (!neighbors.has(e.target)) neighbors.set(e.target, new Set())
          neighbors.get(e.source)?.add(e.target)
          neighbors.get(e.target)?.add(e.source)
        }
        // disposizione iniziale a spirale (deterministica-ish, per un layout stabile)
        const n = data.nodes.length
        sim.nodes = data.nodes.map((node, i) => {
          const angle = i * 2.399963 // sezione aurea
          const dist = 40 + 16 * Math.sqrt(i + 1)
          return {
            ...node,
            x: Math.cos(angle) * dist,
            y: Math.sin(angle) * dist,
            vx: 0,
            vy: 0,
            radius: 4 + Math.sqrt(degree.get(node.id) ?? 0) * 2.1,
            degree: degree.get(node.id) ?? 0,
          }
        })
        sim.edges = edges
        sim.neighbors = neighbors
        sim.scale = 1
        sim.tx = sim.width / 2
        sim.ty = sim.height / 2
        sim.alpha = 1
        setCounts({
          pages: n,
          links: edges.length,
          refLinks: edges.filter((e) => e.kind === 'ref').length,
        })
        setA11yNodes(data.nodes)
        setEmpty(n === 0)
      })
      .catch(() => {
        if (!cancelled) setEmpty(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  // ---- loop di rendering + simulazione ----
  React.useEffect(() => {
    if (!open) return
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const sim = simRef.current
    let raf = 0
    let running = true

    const resize = () => {
      const rect = wrap.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (sim.width === 0 && sim.height === 0) {
        sim.tx = rect.width / 2
        sim.ty = rect.height / 2
      }
      sim.width = rect.width
      sim.height = rect.height
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(wrap)

    const step = () => {
      if (!running) return

      // --- fisica ---
      const nodes = sim.nodes
      const n = nodes.length
      if (n > 0 && sim.alpha > 0.01) {
        const REP = 2600
        // repulsione (campionata su grafi molto grandi per restare fluidi)
        const sample = n > 260 ? 40 : n
        for (let i = 0; i < n; i++) {
          const a = nodes[i]
          for (let j = 0; j < sample; j++) {
            const b = nodes[(j + i + 1) % n]
            if (a === b) continue
            let dx = a.x - b.x
            let dy = a.y - b.y
            let d2 = dx * dx + dy * dy
            if (d2 < 0.01) {
              dx = Math.random() - 0.5
              dy = Math.random() - 0.5
              d2 = 0.01
            }
            const d = Math.sqrt(d2)
            const force = Math.min((REP * sim.alpha) / d2, 4)
            const fx = (dx / d) * force
            const fy = (dy / d) * force
            a.vx += fx
            a.vy += fy
            if (sample === n) {
              b.vx -= fx
              b.vy -= fy
            }
          }
        }
        // molle sugli archi
        for (const e of sim.edges) {
          const a = nodes.find((nn) => nn.id === e.source)
          const b = nodes.find((nn) => nn.id === e.target)
          if (!a || !b) continue
          const dx = b.x - a.x
          const dy = b.y - a.y
          const d = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01)
          const target = e.kind === 'ref' ? 95 : 165
          const k = e.kind === 'ref' ? 0.024 : 0.012
          const force = k * sim.alpha * (d - target)
          const fx = (dx / d) * force
          const fy = (dy / d) * force
          a.vx += fx
          a.vy += fy
          b.vx -= fx
          b.vy -= fy
        }
        // gravità verso il centro + integrazione
        for (const node of nodes) {
          node.vx += -node.x * 0.0022 * sim.alpha
          node.vy += -node.y * 0.0022 * sim.alpha
          if (sim.draggingId === node.id) continue
          node.vx *= 0.82
          node.vy *= 0.82
          const speed = Math.hypot(node.vx, node.vy)
          if (speed > 6) {
            node.vx = (node.vx / speed) * 6
            node.vy = (node.vy / speed) * 6
          }
          node.x += node.vx
          node.y += node.vy
        }
        sim.alpha *= 0.988
      }

      // --- rendering ---
      const colors = colorsRef.current
      const { width, height, scale, tx, ty } = sim
      ctx.clearRect(0, 0, width, height)

      const toScreen = (x: number, y: number): [number, number] => [x * scale + tx, y * scale + ty]
      const hoveredSet = sim.hovered ? sim.neighbors.get(sim.hovered) : undefined
      const highlight = sim.hovered != null

      // archi
      for (const e of sim.edges) {
        const a = sim.nodes.find((nn) => nn.id === e.source)
        const b = sim.nodes.find((nn) => nn.id === e.target)
        if (!a || !b) continue
        const [ax, ay] = toScreen(a.x, a.y)
        const [bx, by] = toScreen(b.x, b.y)
        const isRef = e.kind === 'ref'
        const touchesHover =
          highlight && sim.hovered != null && (e.source === sim.hovered || e.target === sim.hovered)
        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(bx, by)
        if (isRef) {
          ctx.strokeStyle = colors.primary
          ctx.globalAlpha = highlight ? (touchesHover ? 0.9 : 0.08) : 0.5
          ctx.lineWidth = Math.max(1.1, 1.6 * Math.min(scale, 1.4))
        } else {
          ctx.strokeStyle = colors.border
          ctx.globalAlpha = highlight ? (touchesHover ? 0.9 : 0.07) : 0.75
          ctx.lineWidth = 1
        }
        ctx.stroke()
        ctx.globalAlpha = 1
      }

      // nodi + etichette
      ctx.textAlign = 'center'
      ctx.font = '11px var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif'
      for (const node of sim.nodes) {
        const [sx, sy] = toScreen(node.x, node.y)
        if (sx < -60 || sy < -60 || sx > width + 60 || sy > height + 60) continue
        const isHover = sim.hovered === node.id
        const isNeighbor = hoveredSet?.has(node.id) ?? false
        const isCurrent = node.id === currentPageId
        const dim = highlight && !isHover && !isNeighbor

        ctx.globalAlpha = dim ? 0.25 : 1

        // alone per la pagina corrente / hover
        if (isCurrent || isHover) {
          ctx.beginPath()
          ctx.arc(sx, sy, node.radius * scale + 5, 0, Math.PI * 2)
          ctx.strokeStyle = colors.primary
          ctx.globalAlpha = 0.55
          ctx.lineWidth = 1.5
          ctx.stroke()
          ctx.globalAlpha = dim ? 0.25 : 1
        }

        ctx.beginPath()
        ctx.arc(sx, sy, Math.max(2.5, node.radius * scale), 0, Math.PI * 2)
        ctx.fillStyle = node.kind === 'database' ? colors.database : colors.primary
        ctx.fill()
        if (node.isFavorite) {
          // stellina per i preferiti: piccolo anorno attorno
          ctx.beginPath()
          ctx.arc(sx, sy, Math.max(4.5, node.radius * scale + 2.5), 0, Math.PI * 2)
          ctx.strokeStyle = '#f2b544'
          ctx.lineWidth = 1.2
          ctx.stroke()
        }

        const showLabel = scale >= 0.55 || isHover || isCurrent || (isNeighbor && scale >= 0.35)
        if (showLabel) {
          const label = `${node.icon ? `${node.icon} ` : ''}${truncate(node.title.trim() || t('untitled'))}`
          ctx.fillStyle = isHover || isCurrent ? colors.foreground : colors.muted
          ctx.fillText(label, sx, sy + Math.max(9, node.radius * scale + 12))
        }
        ctx.globalAlpha = 1
      }

      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [open, canvasMounted, currentPageId, t])

  // ---- conversione coordinate ----
  const toWorld = React.useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    const sim = simRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const sx = clientX - rect.left
    const sy = clientY - rect.top
    return { x: (sx - sim.tx) / sim.scale, y: (sy - sim.ty) / sim.scale }
  }, [])

  const hitTest = React.useCallback(
    (clientX: number, clientY: number): SimNode | null => {
      const sim = simRef.current
      const p = toWorld(clientX, clientY)
      let best: SimNode | null = null
      let bestDist = Infinity
      for (const node of sim.nodes) {
        const d = Math.hypot(node.x - p.x, node.y - p.y)
        const threshold = node.radius + 6 / sim.scale
        if (d < threshold && d < bestDist) {
          best = node
          bestDist = d
        }
      }
      return best
    },
    [toWorld]
  )

  // ---- interazioni puntatore ----
  React.useEffect(() => {
    if (!open) return
    const canvas = canvasRef.current
    if (!canvas) return
    const sim = simRef.current

    const onPointerDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId)
      sim.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (sim.pointers.size === 2) {
        // inizio pizzico
        const [a, b] = [...sim.pointers.values()]
        sim.pinchDist = Math.hypot(a.x - b.x, a.y - b.y)
        sim.draggingId = null
        sim.panning = false
        return
      }
      sim.moved = false
      const node = hitTest(e.clientX, e.clientY)
      if (node) {
        sim.draggingId = node.id
        const p = toWorld(e.clientX, e.clientY)
        node.vx = 0
        node.vy = 0
        sim.dragOffset = { dx: node.x - p.x, dy: node.y - p.y }
      } else {
        sim.panning = true
      }
      sim.lastPointer = { x: e.clientX, y: e.clientY }
    }

    const onPointerMove = (e: PointerEvent) => {
      if (sim.pointers.has(e.pointerId)) {
        sim.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      }
      // pizzico a due dita
      if (sim.pointers.size === 2 && sim.pinchDist != null) {
        const [a, b] = [...sim.pointers.values()]
        const dist = Math.hypot(a.x - b.x, a.y - b.y)
        if (dist > 0 && sim.pinchDist > 0) {
          const factor = dist / sim.pinchDist
          const canvas = canvasRef.current
          if (canvas) {
            const rect = canvas.getBoundingClientRect()
            zoomAt((a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top, factor)
          }
          sim.pinchDist = dist
        }
        sim.moved = true
        return
      }

      if (sim.draggingId || sim.panning) {
        if (sim.lastPointer) {
          const dx = e.clientX - sim.lastPointer.x
          const dy = e.clientY - sim.lastPointer.y
          if (Math.abs(dx) + Math.abs(dy) > 2) sim.moved = true
          if (sim.draggingId) {
            const node = sim.nodes.find((nn) => nn.id === sim.draggingId)
            if (node) {
              const p = toWorld(e.clientX, e.clientY)
              node.x = p.x + sim.dragOffset.dx
              node.y = p.y + sim.dragOffset.dy
              node.vx = 0
              node.vy = 0
              sim.alpha = Math.max(sim.alpha, 0.3)
            }
          } else if (sim.panning) {
            sim.tx += dx
            sim.ty += dy
          }
        }
        sim.lastPointer = { x: e.clientX, y: e.clientY }
      } else {
        const node = hitTest(e.clientX, e.clientY)
        sim.hovered = node?.id ?? null
        canvas.style.cursor = node ? 'pointer' : 'grab'
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      sim.pointers.delete(e.pointerId)
      if (sim.pointers.size < 2) sim.pinchDist = null
      const wasDragging = sim.draggingId != null
      const clicked = !sim.moved
      const node = wasDragging ? sim.nodes.find((nn) => nn.id === sim.draggingId) : hitTest(e.clientX, e.clientY)
      sim.draggingId = null
      sim.panning = false
      sim.lastPointer = null
      if (clicked && node) {
        onOpenChange(false)
        onSelectPage(node.id)
      }
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const factor = Math.exp(-e.deltaY * 0.0012)
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, factor)
    }

    const zoomAt = (sx: number, sy: number, factor: number) => {
      const sim = simRef.current
      const next = Math.min(3, Math.max(0.2, sim.scale * factor))
      const applied = next / sim.scale
      sim.tx = sx - (sx - sim.tx) * applied
      sim.ty = sy - (sy - sim.ty) * applied
      sim.scale = next
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [open, canvasMounted, hitTest, toWorld, onOpenChange, onSelectPage])

  const zoomBy = (factor: number) => {
    const sim = simRef.current
    sim.scale = Math.min(3, Math.max(0.2, sim.scale * factor))
  }

  const resetView = () => {
    const sim = simRef.current
    sim.scale = 1
    sim.tx = sim.width / 2
    sim.ty = sim.height / 2
    sim.alpha = 1
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="h-[100dvh] w-screen max-w-none gap-0 overflow-hidden rounded-none border-0 bg-background p-0 sm:max-w-none"
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t('graphTitle')}</DialogTitle>
          <DialogDescription>{t('graphDescription')}</DialogDescription>
        </DialogHeader>

        <div ref={wrapRef} className="relative h-full w-full">
          <canvas
            ref={(el) => {
              canvasRef.current = el
              setCanvasMounted(el !== null)
            }}
            role="application"
            aria-label={`${t('graphTitle')} — ${t('graphDescription')}`}
            className="absolute inset-0 h-full w-full touch-none select-none"
            style={{ cursor: 'grab' }}
          />

          {/* Barra superiore */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-3 sm:p-4">
            <div className="pointer-events-auto flex max-w-xs flex-col gap-1.5 rounded-xl border bg-background/85 px-3 py-2 shadow-sm backdrop-blur">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <Waypoints className="size-4 text-primary" aria-hidden />
                {t('graphTitle')}
              </p>
              {loading ? (
                <p className="text-xs text-muted-foreground">{t('loading')}</p>
              ) : empty ? (
                <p className="text-xs text-muted-foreground">{t('graphEmpty')}</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    {t('graphCounts', { pages: counts.pages, links: counts.links })}
                  </p>
                  <div className="mt-0.5 flex flex-col gap-1 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden className="h-0.5 w-4 rounded-full bg-border" />
                      {t('graphLegendTree')}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden className="h-0.5 w-4 rounded-full bg-primary" />
                      {t('graphLegendLink')}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="pointer-events-auto flex items-center gap-1 rounded-xl border bg-background/85 p-1 shadow-sm backdrop-blur">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 cursor-pointer"
                onClick={() => zoomBy(1.25)}
                aria-label={t('graphZoomIn')}
                title={t('graphZoomIn')}
              >
                <Plus className="size-4" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 cursor-pointer"
                onClick={() => zoomBy(0.8)}
                aria-label={t('graphZoomOut')}
                title={t('graphZoomOut')}
              >
                <Minus className="size-4" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 cursor-pointer"
                onClick={resetView}
                aria-label={t('graphZoomReset')}
                title={t('graphZoomReset')}
              >
                <Maximize className="size-4" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 cursor-pointer"
                onClick={() => onOpenChange(false)}
                aria-label={t('close')}
                title={t('close')}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </div>
          </div>

          {/* Suggerimento in basso */}
          {!empty && !loading ? (
            <p
              className={cn(
                'pointer-events-none absolute inset-x-0 bottom-3 text-center text-[11px] text-muted-foreground/80',
                'px-4'
              )}
            >
              {t('graphHint')} · {t('graphLegendLink')}: {counts.refLinks}
            </p>
          ) : null}

          {/* Accessibilità: navigazione alternativa via elenco */}
          <ul className="sr-only" aria-label={t('graphTitle')}>
            {a11yNodes.map((node) => (
              <li key={node.id}>
                <button type="button" onClick={() => onSelectPage(node.id)}>
                  {node.icon ? `${node.icon} ` : ''}
                  {node.title.trim() || t('untitled')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  )
}
