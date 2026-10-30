/**
 * Taccuino — preferenze dell'interfaccia persistite localmente (zustand).
 * - accent     : accento cromatico del tema (terracotta predefinito)
 * - dailyGoal  : obiettivo di parole al giorno (statistiche di scrittura)
 * - typewriter : scorrimento "macchina da scrivere" in modalità focus
 */
'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Accent = 'terracotta' | 'sage' | 'amber' | 'rose' | 'violet' | 'teal'

export const ACCENTS: Accent[] = ['terracotta', 'sage', 'amber', 'rose', 'violet', 'teal']

interface PrefsState {
  accent: Accent
  dailyGoal: number
  typewriter: boolean
  setAccent: (accent: Accent) => void
  setDailyGoal: (goal: number) => void
  setTypewriter: (enabled: boolean) => void
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      accent: 'terracotta',
      dailyGoal: 250,
      typewriter: false,
      setAccent: (accent) => set({ accent }),
      setDailyGoal: (goal) => set({ dailyGoal: Math.min(100_000, Math.max(0, Math.round(goal))) }),
      setTypewriter: (typewriter) => set({ typewriter }),
    }),
    { name: 'taccuino-prefs' }
  )
)
