import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")?.trim()

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const supabase = await createClient()

  try {
    // 搜尋平台交易 - 確認碼和收款金額
    const { data: transactions, error } = await supabase
      .from("platform_transactions")
      .select(`
        id,
        type,
        confirmation_code,
        payout_amount,
        reconciliation_status,
        matched_bank_transaction_code,
        raw_data,
        batch_id,
        csv_import_batches!inner (
          id,
          file_name,
          platform_name
        )
      `)
      .or(`confirmation_code.ilike.%${query}%,raw_data->>確認碼.ilike.%${query}%,raw_data->>收款.ilike.%${query}%`)
      .limit(50)

    if (error) {
      console.error("[v0] 搜尋錯誤:", error)
      throw error
    }

    // 格式化結果
    const results = (transactions || []).map((tx: any) => {
      const rawData = tx.raw_data || {}
      const confirmCode = tx.confirmation_code || rawData["確認碼"] || ""
      const payoutAmount = rawData["收款"] || tx.payout_amount || ""
      const rowIndex = rawData["_row_index"] || 0

      return {
        id: tx.id,
        type: tx.type,
        confirmationCode: confirmCode,
        payoutAmount: payoutAmount,
        reconciliationStatus: tx.reconciliation_status,
        matchedBankTransactionCode: tx.matched_bank_transaction_code,
        rowIndex: rowIndex,
        batchId: tx.batch_id,
        fileName: tx.csv_import_batches?.file_name || "",
        platformName: tx.csv_import_batches?.platform_name || "",
      }
    })

    // 按確認碼優先排序，然後按收款金額
    results.sort((a: any, b: any) => {
      // 確認碼完全匹配優先
      const aCodeMatch = a.confirmationCode.toLowerCase().includes(query.toLowerCase())
      const bCodeMatch = b.confirmationCode.toLowerCase().includes(query.toLowerCase())
      if (aCodeMatch && !bCodeMatch) return -1
      if (!aCodeMatch && bCodeMatch) return 1
      return 0
    })

    return NextResponse.json({ results: results.slice(0, 20) })
  } catch (error) {
    console.error("[v0] 搜尋平台交易錯誤:", error)
    return NextResponse.json({ error: "搜尋失敗" }, { status: 500 })
  }
}
