"use client"

import { DashboardHeader } from "@/components/dashboard-header"
import { PlatformTransactionsTable } from "@/components/transactions/platform-transactions-table"

interface PlatformTransactionsContentProps {
  transactions: any[]
  platforms: any[]
  properties: any[]
}

export function PlatformTransactionsContent({ transactions, platforms, properties }: PlatformTransactionsContentProps) {
  return (
    <div className="space-y-6">
      <DashboardHeader titleKey="platform.title" subtitleKey="platform.subtitle" />
      <PlatformTransactionsTable transactions={transactions} platforms={platforms} properties={properties} />
    </div>
  )
}
