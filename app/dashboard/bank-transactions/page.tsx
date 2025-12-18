import { createClient } from "@/lib/supabase/server"
import { BankTransactionsContent } from "@/components/transactions/bank-transactions-content"

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

  return <BankTransactionsContent transactions={transactions} banks={banks} />
}
