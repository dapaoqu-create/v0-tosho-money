import { createClient } from "@/lib/supabase/server"
import { PlatformBatchList } from "@/components/transactions/platform-batch-list"

async function getPlatformBatches() {
  const supabase = await createClient()

  const { data: batches } = await supabase
    .from("csv_import_batches")
    .select("*, platform:platforms(*), property:properties(*)")
    .eq("source_type", "platform")
    .order("created_at", { ascending: false })

  return { batches: batches || [] }
}

export default async function PlatformTransactionsPage() {
  const { batches } = await getPlatformBatches()

  return <PlatformBatchList batches={batches} />
}
