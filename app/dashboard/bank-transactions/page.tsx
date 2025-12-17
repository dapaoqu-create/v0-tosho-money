import { createClient } from "@/lib/supabase/server"
import { BankTransactionsTable } from "@/components/transactions/bank-transactions-table"

async function getBankTransactions() {
  const supabase = await createClient()

  const { data: transactions } = await supabase
    .from("bank_transactions")
    .select("*, bank:banks(*)")
    .order("transaction_date", { ascending: false })

  const { data: banks } = await supabase.from("banks").select("*")

  return { transactions: transactions || [], banks: banks || [] }
}

export default async function BankTransactionsPage() {
  const { transactions, banks } = await getBankTransactions()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">銀行取引</h1>
        <p className="text-muted-foreground">銀行の出入金データを管理</p>
      </div>

      <BankTransactionsTable transactions={transactions} banks={banks} />
    </div>
  )
}
