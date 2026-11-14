import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CustomPlan } from '@/lib/custom-plans'

// 'separate' gives import and export a chart each, with their own scales; 'joint' puts both on one chart.
export type ChartLayout = 'separate' | 'joint'

// How the Plan analysis page lays out the plans it compares.
export type PlanView = 'cards' | 'table'

type SettingsState = {
  chartLayout: ChartLayout
  setChartLayout: (chartLayout: ChartLayout) => void
  planView: PlanView
  setPlanView: (planView: PlanView) => void
  // Plans typed in by hand to compare against on the Plan analysis page.
  customPlans: CustomPlan[]
  addCustomPlan: (plan: CustomPlan) => void
  // Replaces the saved plan with the same id.
  updateCustomPlan: (plan: CustomPlan) => void
  removeCustomPlan: (id: string) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      chartLayout: 'separate',
      setChartLayout: (chartLayout) => set({ chartLayout }),
      planView: 'table',
      setPlanView: (planView) => set({ planView }),
      customPlans: [],
      addCustomPlan: (plan) => set((state) => ({ customPlans: [...state.customPlans, plan] })),
      updateCustomPlan: (plan) =>
        set((state) => ({ customPlans: state.customPlans.map((saved) => (saved.id === plan.id ? plan : saved)) })),
      removeCustomPlan: (id) => set((state) => ({ customPlans: state.customPlans.filter((plan) => plan.id !== id) })),
    }),
    { name: 'octopus-analyser-settings' },
  ),
)
