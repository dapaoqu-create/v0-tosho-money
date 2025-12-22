import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const confirmationCode = searchParams.get("code")

  if (!confirmationCode) {
    return NextResponse.json({ error: "Missing confirmation code" }, { status: 400 })
  }

  const supabase = await createClient()

  // 查詢確認碼對應的平台交易
  const { data, error } = await supabase
    .from("platform_transactions")
    .select("batch_id, confirmation_code, raw_data")
    .or(`confirmation_code.eq.${confirmationCode},raw_data->確認碼.eq.${confirmationCode}`)
    .limit(1)
    .single()

  if (error || !data) {
    // 嘗試使用 raw_data 搜尋
    const { data: allBatches } = await supabase.from("csv_import_batches").select("id").eq("source_type", "platform")

    if (allBatches) {
      for (const batch of allBatches) {
        const { data: txs } = await supabase
          .from("platform_transactions")
          .select("batch_id, raw_data")
          .eq("batch_id", batch.id)

        if (txs) {
          const found = txs.find((tx) => {
            const rawConfirmCode = tx.raw_data?.["確認碼"]
            return rawConfirmCode === confirmationCode
          })

          if (found) {
            const rowIndex = found.raw_data?._row_index || found.raw_data?.["_row_index"]
            return NextResponse.json({
              batchId: found.batch_id,
              rowIndex: rowIndex ? Number.parseInt(rowIndex) : null,
            })
          }
        }
      }
    }

    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const rowIndex = data.raw_data?._row_index || data.raw_data?.["_row_index"]
  return NextResponse.json({
    batchId: data.batch_id,
    rowIndex: rowIndex ? Number.parseInt(rowIndex) : null,
  })
}
