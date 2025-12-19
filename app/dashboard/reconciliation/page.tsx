import { createClient } from "@/lib/supabase/server"
import { ReconciliationContent } from "@/components/reconciliation/reconciliation-content"

async function getReconciliationData() {
  const supabase = await createClient()

  // 獲取對賬規則
  const { data: rules } = await supabase
    .from("reconciliation_rules")
    .select("*")
    .order("created_at", { ascending: true })

  // 獲取所有銀行批次
  const { data: bankBatches } = await supabase
    .from("csv_import_batches")
    .select("*")
    .eq("source_type", "bank")
    .order("created_at", { ascending: false })

  // 獲取所有平台批次
  const { data: platformBatches } = await supabase
    .from("csv_import_batches")
    .select("*")
    .eq("source_type", "platform")
    .order("created_at", { ascending: false })

  return {
    rules: rules || [],
    bankBatches: bankBatches || [],
    platformBatches: platformBatches || [],
  }
}

export default async function ReconciliationPage() {
  const { rules, bankBatches, platformBatches } = await getReconciliationData()

  return <ReconciliationContent rules={rules} bankBatches={bankBatches} platformBatches={platformBatches} />
}
