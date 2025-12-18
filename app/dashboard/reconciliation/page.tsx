import { createClient } from "@/lib/supabase/server"
import { ReconciliationContent } from "@/components/reconciliation/reconciliation-content"

async function getReconciliationData() {
  const supabase = await createClient()

  const { data: platformPayouts } = await supabase
    .from("platform_transactions")
    .select("*, platform:platforms(*)")
    .eq("type", "Payout")
    .eq("reconciled", false)
    .order("transaction_date", { ascending: false })

  const { data: bankIncome } = await supabase
    .from("bank_transactions")
    .select("*, bank:banks(*)")
    .gt("amount", 0)
    .eq("reconciled", false)
    .order("transaction_date", { ascending: false })

  return {
    platformPayouts: platformPayouts || [],
    bankIncome: bankIncome || [],
  }
}

export default async function ReconciliationPage() {
  const { platformPayouts, bankIncome } = await getReconciliationData()

  return <ReconciliationContent platformPayouts={platformPayouts} bankIncome={bankIncome} />
}
