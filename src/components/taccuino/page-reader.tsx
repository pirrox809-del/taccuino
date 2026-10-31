'use client'

/**
 * Taccuino — Lettore vocale della pagina.
 * Legge i blocchi testuali ad alta voce con la sintesi vocale del browser
 * (Web Speech API: nessuna libreria, nulla lascia il dispositivo) ed
 * evidenzia il blocco in lettura mentre scorre la pagina.
 */
import * as React from 'react'
import { ChevronLeft, ChevronRight, Pause, Play, Square, Volume2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { Block, BlockType } from '@/lib/types'

/** Tipi di blocco che hanno senso leggere ad alta voce. */
const READABLE: ReadonlySet<BlockType> = new Set([
  'paragraph',
  'heading1',
  'heading2',
  'heading3',
  'bullet',
  'numbered',
  'checklist',
  'quote',
  'callout',
])

const RATES = [1, 1.2, 1.5, 0.8] as const

interface QueueItem {
  id: string
  text: string
}

/** Estrae il testo parlato da un blocco (l'HTML inline viene ridotto a testo). */
function blockToSpeech(block: Block): string {
  if (READABLE.has(block.type)) {
    return block.content
      .replace(/<[^>]*>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }
  if ((block.type === 'image' || block.type === 'bookmark') && block.caption) {
    return block.caption
  }
  return ''
}

function clearHighlight(): void {
  document.querySelectorAll('[data-reader-active="true"]').forEach((el) => {
    el.removeAttribute('data-reader-active')
    el.classList.remove('ring-2', 'ring-primary/60', 'rounded-md')
  })
}

export interface PageReaderProps {
  blocks: Block[]
  onClose: () => void
}

export function PageReader({ blocks, onClose }: PageReaderProps) {
  const { t, lang } = useI18n()
  const [supported] = React.useState(() => typeof window !== 'undefined' && 'speechSynthesis' in window)
  const [status, setStatus] = React.useState<'idle' | 'playing' | 'paused'>('idle')
  const [index, setIndex] = React.useState(0)
  const [rateIndex, setRateIndex] = React.useState(0)

  const blocksRef = React.useRef(blocks)
  React.useEffect(() => {
    blocksRef.current = blocks
  }, [blocks])
  const rate = RATES[rateIndex]

  // coda dei blocchi leggibili: ricalcolata solo quando serve davvero (non in
  // dipendenza dell'effetto di lettura, che resterebbe bloccato dal digiting)
  const readableCount = React.useMemo(
    () => blocks.filter((b) => blockToSpeech(b).length > 0).length,
    [blocks]
  )

  const stop = React.useCallback(() => {
    window.speechSynthesis?.cancel()
    clearHighlight()
    setStatus('idle')
    setIndex(0)
  }, [])

  // cambio pagina: chiude il lettore e pulisce tutto
  React.useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel()
      clearHighlight()
    }
  }, [])

  // motore di lettura: parla del blocco corrente quando lo stato lo richiede
  React.useEffect(() => {
    if (status !== 'playing' || !supported) return
    const queue = blocksRef.current
      .map((b) => ({ id: b.id, text: blockToSpeech(b) }))
      .filter((item) => item.text.length > 0)

    if (queue.length === 0 || index >= queue.length) {
      window.speechSynthesis.cancel()
      clearHighlight()
      setStatus('idle')
      setIndex(0)
      return
    }

    const item = queue[index]

    // evidenzia e centra il blocco in lettura
    clearHighlight()
    const el = document.querySelector(`[data-block-id="${CSS.escape(item.id)}"]`)
    if (el) {
      el.classList.add('ring-2', 'ring-primary/60', 'rounded-md')
      el.setAttribute('data-reader-active', 'true')
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }

    const utterance = new SpeechSynthesisUtterance(item.text)
    utterance.lang = lang === 'it' ? 'it-IT' : 'en-US'
    utterance.rate = rate
    utterance.onend = () => {
      // avanza solo se la lettura non è stata interrotta nel frattempo
      setIndex((current) => {
        if (current === index) return index + 1
        return current
      })
    }
    utterance.onerror = () => {
      setIndex((current) => (current === index ? index + 1 : current))
    }

    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }, [status, index, rate, lang, supported])

  const pause = React.useCallback(() => {
    window.speechSynthesis.cancel()
    setStatus('paused')
  }, [])

  const resume = React.useCallback(() => {
    setStatus('playing')
  }, [])

  const skip = React.useCallback((delta: number) => {
    setStatus((currentStatus) => {
      if (currentStatus === 'idle') return currentStatus
      setIndex((current) => Math.max(0, current + delta))
      return 'playing'
    })
  }, [])

  if (!supported) return null

  const empty = readableCount === 0
  const active = status !== 'idle'

  return (
    <div
      role="region"
      aria-label={t('readerTitle')}
      className="fixed bottom-14 left-1/2 z-40 -translate-x-1/2"
    >
      <div className="flex items-center gap-1 rounded-full border bg-card/95 py-1.5 pl-2 pr-1.5 shadow-lg backdrop-blur">
        <span className="mr-1 hidden items-center gap-1.5 text-xs font-medium text-muted-foreground sm:flex">
          <Volume2 className="size-3.5 text-primary" aria-hidden />
          {t('readerTitle')}
        </span>

        {empty ? (
          <span className="px-2 text-xs text-muted-foreground">{t('readerNoContent')}</span>
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 cursor-pointer text-muted-foreground hover:text-foreground"
              onClick={() => skip(-1)}
              disabled={!active}
              aria-label={t('readerPrev')}
              title={t('readerPrev')}
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Button>

            {status === 'playing' ? (
              <Button
                size="icon"
                className="size-8 cursor-pointer"
                onClick={pause}
                aria-label={t('readerPause')}
                title={t('readerPause')}
              >
                <Pause className="size-4" aria-hidden />
              </Button>
            ) : (
              <Button
                size="icon"
                className={cn('size-8 cursor-pointer', status === 'paused' && 'animate-pulse')}
                onClick={resume}
                aria-label={t('readerPlay')}
                title={t('readerPlay')}
              >
                <Play className="size-4" aria-hidden />
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="size-8 cursor-pointer text-muted-foreground hover:text-foreground"
              onClick={() => skip(1)}
              disabled={!active}
              aria-label={t('readerNext')}
              title={t('readerNext')}
            >
              <ChevronRight className="size-4" aria-hidden />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="size-8 cursor-pointer text-muted-foreground hover:text-foreground"
              onClick={stop}
              disabled={!active}
              aria-label={t('readerStop')}
              title={t('readerStop')}
            >
              <Square className="size-3.5" aria-hidden />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 cursor-pointer px-2 font-mono text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => setRateIndex((i) => (i + 1) % RATES.length)}
              aria-label={t('readerSpeed')}
              title={`${t('readerSpeed')}: ${rate}×`}
            >
              {rate}×
            </Button>
          </>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="size-8 cursor-pointer text-muted-foreground hover:text-foreground"
          onClick={() => {
            stop()
            onClose()
          }}
          aria-label={t('readerStop')}
          title={t('readerStop')}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  )
}
