import { createClient } from "@/lib/supabase/server"
import { ReportsContent } from "@/components/reports/reports-content"

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

  return <ReportsContent platformTransactions={platformTransactions} bankTransactions={bankTransactions} />
}
