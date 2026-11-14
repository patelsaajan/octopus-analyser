import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 'separate' gives import and export a chart each, with their own scales; 'joint' puts both on one chart.
export type ChartLayout = 'separate' | 'joint'

type SettingsState = {
  chartLayout: ChartLayout
  setChartLayout: (chartLayout: ChartLayout) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      chartLayout: 'separate',
      setChartLayout: (chartLayout) => set({ chartLayout }),
    }),
    { name: 'octopus-analyser-settings' },
  ),
)
