"use client"

import { DashboardHeader } from "@/components/dashboard-header"
import { ReconciliationView } from "@/components/reconciliation/reconciliation-view"

interface ReconciliationContentProps {
  platformPayouts: any[]
  bankIncome: any[]
}

export function ReconciliationContent({ platformPayouts, bankIncome }: ReconciliationContentProps) {
  return (
    <div className="space-y-6">
      <DashboardHeader titleKey="reconciliation.title" subtitleKey="reconciliation.subtitle" />
      <ReconciliationView platformPayouts={platformPayouts} bankIncome={bankIncome} />
    </div>
  )
}
