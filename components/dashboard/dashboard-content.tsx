"use client"

import { DashboardHeader } from "@/components/dashboard-header"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { DailyChart } from "@/components/dashboard/daily-chart"
import { RecentTransactions } from "@/components/dashboard/recent-transactions"
import { useLanguage } from "@/lib/i18n/context"
import type { DashboardStats, MonthlyData, DailyData } from "@/lib/types"

interface DashboardContentProps {
  stats: DashboardStats
  monthlyData: MonthlyData[]
  dailyData: DailyData[]
  bankTransactions: any[]
  platformTransactions: any[]
}

export function DashboardContent({
  stats,
  monthlyData,
  dailyData,
  bankTransactions,
  platformTransactions,
}: DashboardContentProps) {
  const { t } = useLanguage()

  return (
    <div className="space-y-6">
      <DashboardHeader titleKey="dashboard.title" subtitleKey="dashboard.subtitle" />

      <StatsCards stats={stats} />

      <div className="grid gap-6 lg:grid-cols-2">
        <RevenueChart data={monthlyData} title={t("dashboard.monthlyChart")} />
        <DailyChart data={dailyData} title={t("dashboard.dailyChart")} />
      </div>

      <RecentTransactions bankTransactions={bankTransactions} platformTransactions={platformTransactions} />
    </div>
  )
}
