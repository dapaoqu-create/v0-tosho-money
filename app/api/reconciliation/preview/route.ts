import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const { ruleId, bankBatchIds, platformBatchIds } = await request.json()

    console.log("[v0] Reconciliation preview started", { ruleId, bankBatchIds, platformBatchIds })

    if (!ruleId || !bankBatchIds?.length || !platformBatchIds?.length) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    // 獲取對賬規則
    const { data: rule } = await supabase.from("reconciliation_rules").select("*").eq("id", ruleId).single()

    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 })
    }

    console.log("[v0] Rule found:", rule.name, "bank_field:", rule.bank_field, "platform_field:", rule.platform_field)

    const { data: bankTransactions, error: bankError } = await supabase
      .from("bank_transactions")
      .select("*")
      .in("batch_id", bankBatchIds)

    console.log("[v0] Bank transactions fetched:", bankTransactions?.length, "error:", bankError)

    const { data: platformTransactions, error: platformError } = await supabase
      .from("platform_transactions")
      .select("*")
      .in("batch_id", platformBatchIds)

    console.log("[v0] Platform transactions fetched:", platformTransactions?.length, "error:", platformError)

    if (!bankTransactions?.length || !platformTransactions?.length) {
      return NextResponse.json({
        success: true,
        matches: [],
        message: "沒有可對賬的交易",
        debug: {
          bankCount: bankTransactions?.length || 0,
          platformCount: platformTransactions?.length || 0,
          bankError,
          platformError,
        },
      })
    }

    const bankField = rule.bank_field // 例如: "入出金(円)"
    const platformField = rule.platform_field // 例如: "收款"

    const incomeTransactions = bankTransactions.filter((tx) => {
      const rawData = tx.raw_data || {}
      const amountStr = rawData[bankField] || String(tx.amount) || "0"
      const amount = Number.parseFloat(String(amountStr).replace(/[,，]/g, "")) || 0
      const isIncome = amount > 0
      const notReconciled = !tx.reconciliation_status || tx.reconciliation_status === "unreconciled"
      return isIncome && notReconciled
    })

    console.log("[v0] Income transactions (positive amount, not reconciled):", incomeTransactions.length)
    if (incomeTransactions.length > 0) {
      const sample = incomeTransactions[0]
      console.log("[v0] Sample bank tx raw_data:", JSON.stringify(sample.raw_data))
    }

    const payoutTransactions = platformTransactions.filter((tx) => {
      const rawData = tx.raw_data || {}
      const type = rawData["類型"] || tx.type || ""
      const notReconciled = !tx.reconciliation_status || tx.reconciliation_status === "unreconciled"
      return (type === "Payout" || type === "payout") && notReconciled
    })

    console.log("[v0] Payout transactions:", payoutTransactions.length)
    if (payoutTransactions.length > 0) {
      const sample = payoutTransactions[0]
      console.log("[v0] Sample payout tx raw_data:", JSON.stringify(sample.raw_data))
    }

    // 獲取所有預訂類型的交易（用於獲取確認碼）
    const bookingTransactions = platformTransactions.filter((tx) => {
      const rawData = tx.raw_data || {}
      const type = rawData["類型"] || tx.type || ""
      return type === "預訂" || type === "Reservation" || type === "booking"
    })

    console.log("[v0] Booking transactions (for confirmation codes):", bookingTransactions.length)

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
        if ((payoutTx as any)._matched) continue

        const payoutRawData = payoutTx.raw_data || {}
        const payoutAmountStr = payoutRawData[platformField] || String(payoutTx.payout_amount) || "0"
        const payoutAmount = Math.round(Number.parseFloat(String(payoutAmountStr).replace(/[,，]/g, "")) || 0)

        if (matchIndex <= 3) {
          console.log(`[v0] Comparing bank ${bankAmount} vs payout ${payoutAmount}`)
        }

        // 金額完全一致（取整數比對）
        if (Math.abs(bankAmount - payoutAmount) < 1 && payoutAmount > 0) {
          // 找對應的預訂（通常是 Payout 同日期的預訂）
          const payoutDate = payoutRawData["日期"] || payoutTx.transaction_date || ""

          // 找同一天有確認碼的預訂
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

          console.log(
            `[v0] Match found! Bank: ${bankAmount}, Payout: ${payoutAmount}, Codes: ${confirmationCodes.join(",")}`,
          )

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
          ;(payoutTx as any)._matched = true
          break
        }
      }
    }

    console.log("[v0] Total matches found:", matches.length)

    // 創建預覽日誌
    const { data: log, error: logError } = await supabase
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

    console.log("[v0] Log created:", log?.id, "error:", logError)

    return NextResponse.json({
      success: true,
      logId: log?.id,
      matches,
      message: `找到 ${matches.length} 筆配對`,
      debug: {
        incomeCount: incomeTransactions.length,
        payoutCount: payoutTransactions.length,
        bookingCount: bookingTransactions.length,
      },
    })
  } catch (error) {
    console.error("[v0] Reconciliation preview error:", error)
    return NextResponse.json({ error: "對賬預覽失敗", details: String(error) }, { status: 500 })
  }
}
