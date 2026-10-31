'use client'

/**
 * Taccuino — Timer di concentrazione (stile pomodoro).
 * Il countdown sopravvive ai ricaricamenti (localStorage), al termine suona
 * un bip generato via WebAudio (nessun file audio) e mostra una notifica.
 * Nessuna telemetria, nessuna dipendenza: tutto nel browser.
 */
import * as React from 'react'
import { Pause, Play, RotateCcw, Timer } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'taccuino-focus-timer-v1'
const PRESETS = [15, 25, 45, 60] as const

interface TimerSnapshot {
  /** Minuti del timer impostato. */
  duration: number
  /** Timestamp di fine se in esecuzione, altrimenti null. */
  endsAt: number | null
  /** Secondi rimasti quando in pausa o fermo. */
  remaining: number
}

function loadSnapshot(): TimerSnapshot {
  if (typeof window === 'undefined') return { duration: 25, endsAt: null, remaining: 25 * 60 }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { duration: 25, endsAt: null, remaining: 25 * 60 }
    const parsed = JSON.parse(raw) as Partial<TimerSnapshot>
    if (
      typeof parsed.duration !== 'number' ||
      typeof parsed.remaining !== 'number' ||
      typeof parsed.endsAt !== 'number' && parsed.endsAt !== null
    ) {
      return { duration: 25, endsAt: null, remaining: 25 * 60 }
    }
    const snapshot: TimerSnapshot = {
      duration: parsed.duration,
      endsAt: parsed.endsAt ?? null,
      remaining: parsed.remaining,
    }
    // se il timer era in esecuzione e il tempo è già scaduto mentre l'app era chiusa
    if (snapshot.endsAt !== null && snapshot.endsAt <= Date.now()) {
      return { duration: snapshot.duration, endsAt: null, remaining: 0 }
    }
    return snapshot
  } catch {
    return { duration: 25, endsAt: null, remaining: 25 * 60 }
  }
}

function saveSnapshot(snapshot: TimerSnapshot): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // storage non disponibile: il timer vive solo in memoria
  }
}

/** Bip di fine via WebAudio: nessun file, nessuna rete. */
function playChime(): void {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.18, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.4)
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 880
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 1.4)
    setTimeout(() => void ctx.close().catch(() => undefined), 1600)
  } catch {
    // l'audio non è disponibile: la notifica toast basta
  }
}

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function FocusTimer() {
  const { t } = useI18n()
  const [snapshot, setSnapshot] = React.useState<TimerSnapshot>(() => loadSnapshot())
  const [remaining, setRemaining] = React.useState(() =>
    snapshot?.endsAt != null ? Math.max(0, Math.round((snapshot.endsAt - Date.now()) / 1000)) : snapshot?.remaining ?? 0
  )
  const [open, setOpen] = React.useState(false)

  const running = snapshot.endsAt != null

  // tick: aggiorna il countdown e gestisce il termine
  React.useEffect(() => {
    if (snapshot.endsAt == null) return
    const tick = () => {
      const left = Math.max(0, Math.round((snapshot.endsAt as number - Date.now()) / 1000))
      setRemaining(left)
      if (left <= 0) {
        setSnapshot((current) => ({ duration: current.duration, endsAt: null, remaining: 0 }))
        playChime()
        toast(t('timerDone'), { icon: '⏱️' })
      }
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [snapshot.endsAt, t])

  // persistenza a ogni cambio di stato
  React.useEffect(() => {
    saveSnapshot(snapshot)
    if (snapshot.endsAt == null) setRemaining(snapshot.remaining)
  }, [snapshot])

  const start = React.useCallback(() => {
    setSnapshot((current) => {
      const seconds = current.remaining > 0 && current.endsAt == null && current.remaining < current.duration * 60
        ? current.remaining
        : current.duration * 60
      return { ...current, endsAt: Date.now() + seconds * 1000 }
    })
  }, [])

  const pause = React.useCallback(() => {
    setSnapshot((current) => {
      if (current.endsAt == null) return current
      const left = Math.max(0, Math.round((current.endsAt - Date.now()) / 1000))
      return { ...current, endsAt: null, remaining: left }
    })
  }, [])

  const reset = React.useCallback(() => {
    setSnapshot((current) => ({ duration: current.duration, endsAt: null, remaining: current.duration * 60 }))
  }, [])

  const setPreset = React.useCallback((minutes: number) => {
    setSnapshot({ duration: minutes, endsAt: null, remaining: minutes * 60 })
  }, [])

  const display = running ? remaining : snapshot.remaining
  const progress =
    snapshot.duration > 0
      ? Math.min(100, Math.max(0, 100 - (display / (snapshot.duration * 60)) * 100))
      : 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'size-8 cursor-pointer text-muted-foreground hover:text-foreground',
            running && 'text-primary hover:text-primary'
          )}
          aria-label={t('timerTitle')}
          title={running ? `${t('timerTitle')} · ${formatSeconds(remaining)}` : t('timerTitle')}
        >
          <Timer className="size-4" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold">{t('timerTitle')}</p>

          <div
            className="text-center font-mono text-3xl font-semibold tabular-nums"
            role="timer"
            aria-label={t('timerRemaining')}
            aria-live="off"
          >
            {formatSeconds(display)}
          </div>

          {/* barra di avanzamento */}
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex justify-center gap-1">
            {PRESETS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => setPreset(minutes)}
                className={cn(
                  'cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground',
                  snapshot.duration === minutes && 'border-primary/40 bg-primary/10 text-foreground'
                )}
              >
                {minutes}′
              </button>
            ))}
          </div>

          <div className="flex justify-center gap-2">
            {running ? (
              <Button size="sm" className="cursor-pointer gap-1.5" onClick={pause}>
                <Pause className="size-3.5" aria-hidden />
                {t('timerPause')}
              </Button>
            ) : (
              <Button size="sm" className="cursor-pointer gap-1.5" onClick={start} disabled={display <= 0 && snapshot.remaining <= 0}>
                <Play className="size-3.5" aria-hidden />
                {t('timerStart')}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="cursor-pointer gap-1.5 text-muted-foreground"
              onClick={reset}
            >
              <RotateCcw className="size-3.5" aria-hidden />
              {t('timerReset')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
