import { createClient } from "@/lib/supabase/server"
import { StatisticsView } from "@/components/statistics/statistics-view"

async function getStatisticsData() {
  const supabase = await createClient()

  const { data: platformTransactions } = await supabase
    .from("platform_transactions")
    .select("*")
    .order("transaction_date", { ascending: false })

  const { data: bankTransactions } = await supabase
    .from("bank_transactions")
    .select("*")
    .order("transaction_date", { ascending: false })

  const { data: properties } = await supabase.from("properties").select("*")

  return {
    platformTransactions: platformTransactions || [],
    bankTransactions: bankTransactions || [],
    properties: properties || [],
  }
}

export default async function StatisticsPage() {
  const { platformTransactions, bankTransactions, properties } = await getStatisticsData()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">統計</h1>
        <p className="text-muted-foreground">収入・支出の詳細分析</p>
      </div>

      <StatisticsView
        platformTransactions={platformTransactions}
        bankTransactions={bankTransactions}
        properties={properties}
      />
    </div>
  )
}
