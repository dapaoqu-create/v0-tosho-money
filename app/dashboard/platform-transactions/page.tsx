import { createClient } from "@/lib/supabase/server"
import { PlatformTransactionsContent } from "@/components/transactions/platform-transactions-content"

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

  return <PlatformTransactionsContent transactions={transactions} platforms={platforms} properties={properties} />
}
