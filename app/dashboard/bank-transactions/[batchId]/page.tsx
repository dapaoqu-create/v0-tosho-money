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

  // 使用分頁獲取所有資料
  const allTransactions: any[] = []
  let page = 0
  const pageSize = 1000

  while (true) {
    const { data: transactions, error } = await supabase
      .from("bank_transactions")
      .select("*")
      .eq("batch_id", batchId)
      .order("transaction_date", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (error) break
    if (!transactions || transactions.length === 0) break

    allTransactions.push(...transactions)

    if (transactions.length < pageSize) break
    page++
  }

  return { batch, transactions: allTransactions }
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
