import { createClient } from "@/lib/supabase/server"
import { BankBatchDetail } from "@/components/transactions/bank-batch-detail"
import { notFound } from "next/navigation"

async function getBatchData(batchId: string) {
  const supabase = await createClient()

  const { data: batch } = await supabase
    .from("csv_import_batches")
    .select("*, bank:banks(*)")
    .eq("id", batchId)
    .single()

  if (!batch) {
    return null
  }

  const { data: transactions } = await supabase
    .from("bank_transactions")
    .select("*")
    .eq("batch_id", batchId)
    .order("transaction_date", { ascending: false })

  return { batch, transactions: transactions || [] }
}

export default async function BankBatchDetailPage({
  params,
}: {
  params: Promise<{ batchId: string }>
}) {
  const { batchId } = await params
  const data = await getBatchData(batchId)

  if (!data) {
    notFound()
  }

  return <BankBatchDetail batch={data.batch} transactions={data.transactions} />
}
