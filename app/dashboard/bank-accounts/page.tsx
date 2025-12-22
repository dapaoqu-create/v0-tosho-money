import { createClient } from "@/lib/supabase/server"
import { BankAccountsContent } from "@/components/bank-accounts/bank-accounts-content"

async function getBankAccountsData() {
  const supabase = await createClient()

  // Get all banks with their transaction summaries
  const { data: banks } = await supabase.from("banks").select("*").order("name")

  // Get transaction totals per bank
  const bankIds = (banks || []).map((b) => b.id)

  const bankStats = await Promise.all(
    bankIds.map(async (bankId) => {
      const { data: transactions } = await supabase
        .from("bank_transactions")
        .select("amount, balance, transaction_date")
        .eq("bank_id", bankId)
        .order("transaction_date", { ascending: false })
        .limit(1)

      const { count: totalTransactions } = await supabase
        .from("bank_transactions")
        .select("*", { count: "exact", head: true })
        .eq("bank_id", bankId)

      const latestTransaction = transactions?.[0]

      return {
        bankId,
        latestBalance: latestTransaction?.balance || 0,
        latestDate: latestTransaction?.transaction_date || null,
        totalTransactions: totalTransactions || 0,
      }
    }),
  )

  const bankStatsMap = bankStats.reduce(
    (acc, stat) => {
      acc[stat.bankId] = stat
      return acc
    },
    {} as Record<string, (typeof bankStats)[0]>,
  )

  return {
    banks: banks || [],
    bankStats: bankStatsMap,
  }
}

export default async function BankAccountsPage() {
  const { banks, bankStats } = await getBankAccountsData()

  return <BankAccountsContent banks={banks} bankStats={bankStats} />
}
