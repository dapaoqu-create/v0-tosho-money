"use client"

import { DashboardHeader } from "@/components/dashboard-header"
import { BankTransactionsTable } from "@/components/transactions/bank-transactions-table"

interface BankTransactionsContentProps {
  transactions: any[]
  banks: any[]
}

export function BankTransactionsContent({ transactions, banks }: BankTransactionsContentProps) {
  return (
    <div className="space-y-6">
      <DashboardHeader titleKey="bank.title" subtitleKey="bank.subtitle" />
      <BankTransactionsTable transactions={transactions} banks={banks} />
    </div>
  )
}
