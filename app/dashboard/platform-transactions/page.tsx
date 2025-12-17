import { createClient } from "@/lib/supabase/server"
import { PlatformTransactionsTable } from "@/components/transactions/platform-transactions-table"

async function getPlatformTransactions() {
  const supabase = await createClient()

  const { data: transactions } = await supabase
    .from("platform_transactions")
    .select("*, platform:platforms(*), property:properties(*)")
    .order("transaction_date", { ascending: false })

  const { data: platforms } = await supabase.from("platforms").select("*")
  const { data: properties } = await supabase.from("properties").select("*")

  return {
    transactions: transactions || [],
    platforms: platforms || [],
    properties: properties || [],
  }
}

export default async function PlatformTransactionsPage() {
  const { transactions, platforms, properties } = await getPlatformTransactions()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">プラットフォーム取引</h1>
        <p className="text-muted-foreground">Airbnb等のプラットフォーム収入データを管理</p>
      </div>

      <PlatformTransactionsTable transactions={transactions} platforms={platforms} properties={properties} />
    </div>
  )
}
