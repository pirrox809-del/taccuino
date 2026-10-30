'use client'

/**
 * Taccuino — attività di scrittura: streak, obiettivo giornaliero e
 * mini-grafico degli ultimi 14 giorni (dati da /api/stats, tutto locale).
 * Notion non mostra allo scrittore né quante parole scrive né la sua
 * costanza: qui la costanza si vede, e si festeggia.
 */
import * as React from 'react'
import { Check, Flame, PencilLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Progress } from '@/components/ui/progress'
import { useI18n } from '@/lib/i18n'
import { usePrefsStore } from '@/lib/prefs-store'
import { cn } from '@/lib/utils'

interface StatsResponse {
  today: number
  streak: number
  days: { date: string; words: number }[]
}

export function ActivityPopover({ children }: { children: React.ReactNode }) {
  const { t, lang } = useI18n()
  const dailyGoal = usePrefsStore((s) => s.dailyGoal)
  const setDailyGoal = usePrefsStore((s) => s.setDailyGoal)
  const [open, setOpen] = React.useState(false)
  const [stats, setStats] = React.useState<StatsResponse | null>(null)
  const [goalDraft, setGoalDraft] = React.useState(String(dailyGoal))

  const load = React.useCallback(() => {
    fetch('/api/stats')
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status))
        return (await res.json()) as StatsResponse
      })
      .then(setStats)
      .catch(() => setStats(null))
  }, [])

  React.useEffect(() => {
    if (open) {
      setGoalDraft(String(dailyGoal))
      load()
    }
  }, [open, dailyGoal, load])

  const maxWords = Math.max(1, ...(stats?.days.map((d) => d.words) ?? [1]))
  const todayWords = stats?.today ?? 0
  const goalPct = dailyGoal > 0 ? Math.min(100, Math.round((todayWords / dailyGoal) * 100)) : 0
  const goalReached = dailyGoal > 0 && todayWords >= dailyGoal
  const hasData = (stats?.days.reduce((sum, d) => sum + d.words, 0) ?? 0) > 0 || (stats?.streak ?? 0) > 0

  const commitGoal = () => {
    const parsed = Number.parseInt(goalDraft, 10)
    if (Number.isFinite(parsed)) setDailyGoal(parsed)
  }

  const dayLabel = (date: string, words: number) => {
    const d = new Date(`${date}T12:00:00`)
    const formatted = d.toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-US', {
      day: 'numeric',
      month: 'short',
    })
    return `${formatted} — ${words} ${t('statusWords')}`
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-72 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <PencilLine className="size-3" aria-hidden />
          {t('activityTitle')}
        </p>

        {stats ? (
          <div className="flex flex-col gap-3">
            {/* streak + oggi */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border bg-card p-2 text-center">
                <p className="flex items-center justify-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  <Flame className={cn('size-3', stats.streak > 0 && 'text-orange-500')} aria-hidden />
                  {t('activityStreakLabel')}
                </p>
                <p className="mt-0.5 text-lg font-bold leading-tight">
                  {stats.streak === 1
                    ? t('activityStreakOne')
                    : t('activityStreakDays', { n: stats.streak })}
                </p>
              </div>
              <div className="rounded-lg border bg-card p-2">
                <p className="text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t('activityTodayLabel')}
                </p>
                <p className="mt-0.5 text-center text-lg font-bold leading-tight">{todayWords}</p>
                <Progress
                  className="mt-1 h-1.5"
                  value={goalPct}
                  aria-label={`${t('activityGoalLabel')}: ${goalPct}%`}
                />
              </div>
            </div>

            {goalReached ? (
              <p className="flex items-center justify-center gap-1.5 rounded-md bg-primary/10 px-2 py-1.5 text-center text-xs font-medium text-primary">
                <Check className="size-3.5" aria-hidden />
                {t('activityGoalReached')}
              </p>
            ) : null}

            {/* mini-grafico 14 giorni */}
            <div>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {t('activityLast14')}
              </p>
              <div className="flex h-12 items-end gap-1" role="img" aria-label={t('activityLast14')}>
                {stats.days.map((d) => (
                  <span
                    key={d.date}
                    title={dayLabel(d.date, d.words)}
                    className={cn(
                      'min-h-1 flex-1 rounded-sm transition-colors',
                      d.words > 0 ? 'bg-primary/70' : 'bg-muted'
                    )}
                    style={{ height: `${Math.max(6, (d.words / maxWords) * 100)}%` }}
                  />
                ))}
              </div>
            </div>

            {/* obiettivo */}
            <div className="flex items-center gap-2">
              <label htmlFor="daily-goal" className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {t('activitySetGoal')}
              </label>
              <Input
                id="daily-goal"
                type="number"
                min={0}
                max={100000}
                value={goalDraft}
                onChange={(e) => setGoalDraft(e.target.value)}
                onBlur={commitGoal}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitGoal()
                    e.currentTarget.blur()
                  }
                }}
                className="h-7 w-20 text-xs"
              />
            </div>
          </div>
        ) : hasData ? null : (
          <p className="text-xs text-muted-foreground">{t('activityNoData')}</p>
        )}
      </PopoverContent>
    </Popover>
  )
}

/** Pulsante-flame per la footer bar della sidebar. */
export function ActivityButton() {
  const { t } = useI18n()
  return (
    <ActivityPopover>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 cursor-pointer text-muted-foreground hover:text-foreground"
        aria-label={t('activityTitle')}
        title={t('activityTitle')}
      >
        <Flame className="size-4" aria-hidden />
      </Button>
    </ActivityPopover>
  )
}
