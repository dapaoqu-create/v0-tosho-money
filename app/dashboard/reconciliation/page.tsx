import { createClient } from "@/lib/supabase/server"
import { ReconciliationView } from "@/components/reconciliation/reconciliation-view"

async function getReconciliationData() {
  const supabase = await createClient()

  // Get unreconciled platform payouts
  const { data: platformPayouts } = await supabase
    .from("platform_transactions")
    .select("*, platform:platforms(*)")
    .eq("type", "Payout")
    .eq("reconciled", false)
    .order("transaction_date", { ascending: false })

  // Get bank transactions that look like platform income
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">対帳</h1>
        <p className="text-muted-foreground">銀行入金とプラットフォーム売上を照合し、入金状況を確認</p>
      </div>

      <ReconciliationView platformPayouts={platformPayouts} bankIncome={bankIncome} />
    </div>
  )
}
