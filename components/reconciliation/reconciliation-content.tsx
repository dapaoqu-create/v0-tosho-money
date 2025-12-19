"use client"
import { DashboardHeader } from "@/components/dashboard-header"
import { ReconciliationPanel } from "@/components/reconciliation/reconciliation-panel"

interface ReconciliationRule {
  id: string
  name: string
  bank_field: string
  platform_field: string
}

interface ImportBatch {
  id: string
  file_name: string
  source_type: string
  platform_name?: string
  account_name?: string
  property_name?: string
  bank_code?: string
  memo?: string
  records_count: number
  created_at: string
}

interface ReconciliationContentProps {
  rules: ReconciliationRule[]
  bankBatches: ImportBatch[]
  platformBatches: ImportBatch[]
}

export function ReconciliationContent({ rules, bankBatches, platformBatches }: ReconciliationContentProps) {
  return (
    <div className="space-y-6">
      <DashboardHeader titleKey="reconciliation.title" subtitleKey="reconciliation.subtitle" />
      <ReconciliationPanel rules={rules} bankBatches={bankBatches} platformBatches={platformBatches} />
    </div>
  )
}
