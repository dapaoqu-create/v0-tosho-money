import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

function parseAmount(value: any): number {
  if (value === null || value === undefined || value === "") return 0
  // 轉為字串，移除逗號、空格，然後解析
  const str = String(value).replace(/[,，\s]/g, "")
  // 移除 .00 或其他小數部分（因為都是 .00）
  const intPart = str.split(".")[0]
  return Number.parseInt(intPart, 10) || 0
}

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

    console.log("[v0] === Bank Transactions Analysis ===")
    const bankAmounts: number[] = []
    bankTransactions.forEach((tx, i) => {
      const rawData = tx.raw_data || {}
      const amountValue = rawData[bankField]
      const amount = parseAmount(amountValue)
      bankAmounts.push(amount)
      if (i < 10) {
        console.log(`[v0] Bank[${i}]: field="${bankField}", value="${amountValue}", parsed=${amount}`)
      }
    })

    console.log("[v0] === Platform Transactions Analysis ===")
    const platformAmounts: number[] = []
    platformTransactions.forEach((tx, i) => {
      const rawData = tx.raw_data || {}
      const type = rawData["類型"] || ""
      const amountValue = rawData[platformField]
      const amount = parseAmount(amountValue)
      if (type === "Payout") {
        platformAmounts.push(amount)
      }
      if (i < 10) {
        console.log(
          `[v0] Platform[${i}]: type="${type}", field="${platformField}", value="${amountValue}", parsed=${amount}`,
        )
      }
    })

    console.log("[v0] Bank amounts (first 10):", bankAmounts.slice(0, 10))
    console.log("[v0] Platform Payout amounts:", platformAmounts)

    const incomeTransactions = bankTransactions.filter((tx) => {
      const rawData = tx.raw_data || {}
      const amount = parseAmount(rawData[bankField])
      const notReconciled = !tx.reconciliation_status || tx.reconciliation_status === "unreconciled"
      return amount > 0 && notReconciled
    })

    console.log("[v0] Income transactions (positive amount, not reconciled):", incomeTransactions.length)

    const payoutTransactions = platformTransactions.filter((tx) => {
      const rawData = tx.raw_data || {}
      const type = rawData["類型"] || tx.type || ""
      const notReconciled = !tx.reconciliation_status || tx.reconciliation_status === "unreconciled"
      return type === "Payout" && notReconciled
    })

    console.log("[v0] Payout transactions:", payoutTransactions.length)

    // 獲取所有預訂類型的交易（用於獲取確認碼）
    const bookingTransactions = platformTransactions.filter((tx) => {
      const rawData = tx.raw_data || {}
      const type = rawData["類型"] || tx.type || ""
      return type === "預訂" || type === "Reservation"
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
    const usedPayoutIds = new Set<string>()

    for (const bankTx of incomeTransactions) {
      const bankRawData = bankTx.raw_data || {}
      const bankAmount = parseAmount(bankRawData[bankField])
      const bankDate = bankRawData["取引日"] || bankTx.transaction_date || ""

      console.log(`[v0] Looking for match: bankAmount=${bankAmount}, date=${bankDate}`)

      // 找金額匹配的 Payout 交易
      for (const payoutTx of payoutTransactions) {
        if (usedPayoutIds.has(payoutTx.id)) continue

        const payoutRawData = payoutTx.raw_data || {}
        const payoutAmount = parseAmount(payoutRawData[platformField])

        if (bankAmount === payoutAmount && payoutAmount > 0) {
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
          usedPayoutIds.add(payoutTx.id)
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
        bankAmountsSample: bankAmounts.slice(0, 5),
        platformAmountsSample: platformAmounts.slice(0, 5),
      },
    })
  } catch (error) {
    console.error("[v0] Reconciliation preview error:", error)
    return NextResponse.json({ error: "對賬預覽失敗", details: String(error) }, { status: 500 })
  }
}
