import { createClient } from "@/lib/supabase/server"
import { BankBatchList } from "@/components/transactions/bank-batch-list"

async function getBankBatches() {
  const supabase = await createClient()

  const { data: batches } = await supabase
    .from("csv_import_batches")
    .select("*, bank:banks(*)")
    .eq("source_type", "bank")
    .order("created_at", { ascending: false })

  return { batches: batches || [] }
}

export default async function BankTransactionsPage() {
  const { batches } = await getBankBatches()

  return <BankBatchList batches={batches} />
}
