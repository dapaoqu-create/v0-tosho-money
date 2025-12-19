import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const { ruleId, bankBatchIds, platformBatchIds } = await request.json()

    if (!ruleId || !bankBatchIds?.length || !platformBatchIds?.length) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    // 獲取對賬規則
    const { data: rule } = await supabase.from("reconciliation_rules").select("*").eq("id", ruleId).single()

    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 })
    }

    // 獲取選定銀行批次的所有交易（只取入金，即正數金額）
    const { data: bankTransactions } = await supabase
      .from("bank_transactions")
      .select("*")
      .in("batch_id", bankBatchIds)
      .is("reconciliation_status", null)
      .or("reconciliation_status.eq.unreconciled")

    // 獲取選定平台批次的所有交易（只取 Payout 類型）
    const { data: platformTransactions } = await supabase
      .from("platform_transactions")
      .select("*")
      .in("batch_id", platformBatchIds)
      .is("reconciliation_status", null)
      .or("reconciliation_status.eq.unreconciled")

    if (!bankTransactions?.length || !platformTransactions?.length) {
      return NextResponse.json({
        success: true,
        matches: [],
        message: "沒有可對賬的交易",
      })
    }

    const bankField = rule.bank_field // 例如: "入出金(円)"
    const platformField = rule.platform_field // 例如: "收款"

    // 過濾出入金交易（正數）
    const incomeTransactions = bankTransactions.filter((tx) => {
      const rawData = tx.raw_data || {}
      const amountStr = rawData[bankField] || String(tx.amount) || "0"
      const amount = Number.parseFloat(String(amountStr).replace(/[,，]/g, "")) || 0
      return amount > 0
    })

    // 過濾出 Payout 類型的平台交易
    const payoutTransactions = platformTransactions.filter((tx) => {
      const rawData = tx.raw_data || {}
      const type = rawData["類型"] || tx.type || ""
      return type === "Payout" || type === "payout"
    })

    // 獲取所有預訂類型的交易（用於獲取確認碼）
    const bookingTransactions = platformTransactions.filter((tx) => {
      const rawData = tx.raw_data || {}
      const type = rawData["類型"] || tx.type || ""
      return type === "預訂" || type === "Reservation" || type === "booking"
    })

    const matches: Array<{
      index: number
      confirmationCode: string
      transactionCode: string
      transactionDate: string
      amount: number
      bankTransactionId: string
      platformTransactionId: string
      platformBookingIds: string[]
    }> = []

    let matchIndex = 1

    // 對每筆銀行入金交易進行配對
    for (const bankTx of incomeTransactions) {
      const bankRawData = bankTx.raw_data || {}
      const bankAmountStr = bankRawData[bankField] || String(bankTx.amount) || "0"
      const bankAmount = Number.parseFloat(String(bankAmountStr).replace(/[,，]/g, "")) || 0
      const bankDate = bankRawData["取引日"] || bankTx.transaction_date || ""

      // 找金額匹配的 Payout 交易
      for (const payoutTx of payoutTransactions) {
        if (payoutTx._matched) continue

        const payoutRawData = payoutTx.raw_data || {}
        const payoutAmountStr = payoutRawData[platformField] || String(payoutTx.payout_amount) || "0"
        const payoutAmount = Number.parseFloat(String(payoutAmountStr).replace(/[,，]/g, "")) || 0

        // 金額完全一致
        if (Math.abs(bankAmount - payoutAmount) < 0.01 && payoutAmount > 0) {
          // 找對應的預訂（通常是 Payout 前一行或同日期的預訂）
          const payoutDate = payoutRawData["日期"] || payoutTx.transaction_date || ""

          // 找同一天或前一天有確認碼的預訂
          const relatedBookings = bookingTransactions.filter((booking) => {
            const bookingRawData = booking.raw_data || {}
            const bookingDate = bookingRawData["日期"] || booking.transaction_date || ""
            const bookingConfirmCode = bookingRawData["確認碼"] || booking.confirmation_code || ""
            return bookingDate === payoutDate && bookingConfirmCode
          })

          // 獲取確認碼
          const confirmationCodes = relatedBookings
            .map((b) => {
              const rd = b.raw_data || {}
              return rd["確認碼"] || b.confirmation_code || ""
            })
            .filter(Boolean)

          matches.push({
            index: matchIndex++,
            confirmationCode: confirmationCodes.join(", ") || "-",
            transactionCode: bankTx.transaction_code || "-",
            transactionDate: bankDate,
            amount: bankAmount,
            bankTransactionId: bankTx.id,
            platformTransactionId: payoutTx.id,
            platformBookingIds: relatedBookings.map((b) => b.id),
          })

          // 標記為已配對
          payoutTx._matched = true
          break
        }
      }
    }

    // 創建預覽日誌
    const { data: log } = await supabase
      .from("reconciliation_logs")
      .insert({
        rule_id: ruleId,
        rule_name: rule.name,
        bank_batch_ids: bankBatchIds,
        platform_batch_ids: platformBatchIds,
        matched_count: matches.length,
        status: "pending",
        matches: matches,
      })
      .select()
      .single()

    return NextResponse.json({
      success: true,
      logId: log?.id,
      matches,
      message: `找到 ${matches.length} 筆配對`,
    })
  } catch (error) {
    console.error("Reconciliation preview error:", error)
    return NextResponse.json({ error: "對賬預覽失敗" }, { status: 500 })
  }
}
