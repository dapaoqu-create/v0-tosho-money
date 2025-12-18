"use client"

import { DashboardHeader } from "@/components/dashboard-header"
import { ReportsView } from "@/components/reports/reports-view"

interface ReportsContentProps {
  platformTransactions: any[]
  bankTransactions: any[]
}

export function ReportsContent({ platformTransactions, bankTransactions }: ReportsContentProps) {
  return (
    <div className="space-y-6">
      <DashboardHeader titleKey="reports.title" subtitleKey="reports.subtitle" />
      <ReportsView platformTransactions={platformTransactions} bankTransactions={bankTransactions} />
    </div>
  )
}
