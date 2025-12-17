import { createClient } from "@/lib/supabase/server"
import { ReportsView } from "@/components/reports/reports-view"

async function getReportData() {
  const supabase = await createClient()

  const { data: platformTransactions } = await supabase
    .from("platform_transactions")
    .select("*")
    .order("transaction_date", { ascending: false })

  const { data: bankTransactions } = await supabase
    .from("bank_transactions")
    .select("*")
    .order("transaction_date", { ascending: false })

  return {
    platformTransactions: platformTransactions || [],
    bankTransactions: bankTransactions || [],
  }
}

export default async function ReportsPage() {
  const { platformTransactions, bankTransactions } = await getReportData()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">レポート</h1>
        <p className="text-muted-foreground">日本の確定申告用レポートを生成</p>
      </div>

      <ReportsView platformTransactions={platformTransactions} bankTransactions={bankTransactions} />
    </div>
  )
}
