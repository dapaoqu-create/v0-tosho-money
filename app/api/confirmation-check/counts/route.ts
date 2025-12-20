import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()

    // 獲取所有平台交易批次
    const { data: batches, error: batchError } = await supabase.from("platform_transaction_batches").select("id")

    if (batchError) {
      console.error("查詢批次失敗:", batchError)
      return NextResponse.json({ error: "查詢批次失敗" }, { status: 500 })
    }

    // 為每個批次計算確認碼數量
    const counts: Record<string, number> = {}

    for (const batch of batches || []) {
      const { data: transactions, error } = await supabase
        .from("platform_transactions")
        .select("raw_data")
        .eq("batch_id", batch.id)

      if (error) {
        console.error(`查詢批次 ${batch.id} 交易失敗:`, error)
        counts[batch.id] = 0
        continue
      }

      // 計算有確認碼的記錄數
      let confirmationCount = 0
      for (const tx of transactions || []) {
        const rawData = tx.raw_data as Record<string, string>
        const code = rawData["確認碼"] || rawData["Confirmation Code"] || rawData["confirmation_code"]
        const type = rawData["類型"] || rawData["Type"] || rawData["type"]

        // 只計算有確認碼且不是 Payout 的行
        if (code && code.trim() && type !== "Payout") {
          confirmationCount++
        }
      }

      counts[batch.id] = confirmationCount
    }

    return NextResponse.json({ counts })
  } catch (error) {
    console.error("獲取確認碼計數錯誤:", error)
    return NextResponse.json({ error: "獲取計數失敗" }, { status: 500 })
  }
}
