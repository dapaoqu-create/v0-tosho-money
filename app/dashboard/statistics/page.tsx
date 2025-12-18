import { createClient } from "@/lib/supabase/server"
import { StatisticsContent } from "@/components/statistics/statistics-content"

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
    <StatisticsContent
      platformTransactions={platformTransactions}
      bankTransactions={bankTransactions}
      properties={properties}
    />
  )
}
