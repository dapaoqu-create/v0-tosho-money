"use client"

import { DashboardHeader } from "@/components/dashboard-header"
import { StatisticsView } from "@/components/statistics/statistics-view"

interface StatisticsContentProps {
  platformTransactions: any[]
  bankTransactions: any[]
  properties: any[]
}

export function StatisticsContent({ platformTransactions, bankTransactions, properties }: StatisticsContentProps) {
  return (
    <div className="space-y-6">
      <DashboardHeader titleKey="statistics.title" subtitleKey="statistics.subtitle" />
      <StatisticsView
        platformTransactions={platformTransactions}
        bankTransactions={bankTransactions}
        properties={properties}
      />
    </div>
  )
}
