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

    console.log("[v0] Rule:", rule.name)

    // 查詢銀行入金交易（正數金額，未對賬）
    const { data: bankData, error: bankError } = await supabase.rpc("get_bank_income_transactions", {
      batch_ids: bankBatchIds,
    })

    // 如果 RPC 不存在，使用普通查詢
    const { data: bankTransactions } = await supabase.from("bank_transactions").select("*").in("batch_id", bankBatchIds)

    const { data: platformTransactions } = await supabase
      .from("platform_transactions")
      .select("*")
      .in("batch_id", platformBatchIds)

    console.log("[v0] Bank transactions:", bankTransactions?.length)
    console.log("[v0] Platform transactions:", platformTransactions?.length)

    if (!bankTransactions?.length || !platformTransactions?.length) {
      return NextResponse.json({
        success: true,
        matches: [],
        message: "沒有可對賬的交易",
      })
    }

    const parseAmount = (value: any): number => {
      if (value === null || value === undefined || value === "") return 0
      const str = String(value)
        .replace(/[,，\s]/g, "")
        .trim()
      // 取整數部分
      const num = Number.parseFloat(str)
      return Math.floor(Math.abs(num))
    }

    const payoutByAmount = new Map<number, any[]>()

    for (const tx of platformTransactions) {
      const rawData = tx.raw_data || {}
      const txType = rawData["類型"] || ""

      if (txType === "Payout") {
        const amountStr = rawData["收款"] || rawData[rule.platform_field] || ""
        const amount = parseAmount(amountStr)

        if (amount > 0) {
          console.log("[v0] Payout found:", amount, "from", amountStr)
          if (!payoutByAmount.has(amount)) {
            payoutByAmount.set(amount, [])
          }
          payoutByAmount.get(amount)!.push(tx)
        }
      }
    }

    console.log("[v0] Payout amounts map size:", payoutByAmount.size)
    console.log("[v0] Payout amounts:", Array.from(payoutByAmount.keys()))

    const bookingsByDate = new Map<string, any[]>()
    for (const tx of platformTransactions) {
      const rawData = tx.raw_data || {}
      const txType = rawData["類型"] || ""
      const confirmCode = rawData["確認碼"] || ""

      if ((txType === "預訂" || txType === "Reservation") && confirmCode) {
        const date = rawData["日期"] || ""
        if (!bookingsByDate.has(date)) {
          bookingsByDate.set(date, [])
        }
        bookingsByDate.get(date)!.push(tx)
      }
    }

    const matches: any[] = []
    let matchIndex = 1
    const usedPayoutIds = new Set<string>()

    for (const bankTx of bankTransactions) {
      const rawData = bankTx.raw_data || {}
      const amountStr = rawData["入出金(円)"] || rawData[rule.bank_field] || ""
      const bankAmount = parseAmount(amountStr)
      const bankDate = rawData["取引日"] || ""

      // 只處理入金（正數）
      if (bankAmount <= 0) continue

      // 已對賬的跳過
      if (bankTx.reconciliation_status === "reconciled") continue

      console.log("[v0] Checking bank amount:", bankAmount, "original:", amountStr)

      // 查找相同金額的 Payout
      const matchingPayouts = payoutByAmount.get(bankAmount) || []

      for (const payoutTx of matchingPayouts) {
        if (usedPayoutIds.has(payoutTx.id)) continue
        if (payoutTx.reconciliation_status === "reconciled") continue

        const payoutRawData = payoutTx.raw_data || {}
        const payoutDate = payoutRawData["日期"] || ""

        // 找相關的預訂確認碼
        const relatedBookings = bookingsByDate.get(payoutDate) || []
        const confirmationCodes = relatedBookings.map((b: any) => b.raw_data?.["確認碼"] || "").filter(Boolean)

        console.log("[v0] Match found! Amount:", bankAmount, "Codes:", confirmationCodes)

        matches.push({
          index: matchIndex++,
          confirmationCode: confirmationCodes.join(", ") || "-",
          transactionCode: bankTx.transaction_code || "-",
          transactionDate: bankDate,
          amount: bankAmount,
          bankTransactionId: bankTx.id,
          platformTransactionId: payoutTx.id,
          platformBookingIds: relatedBookings.map((b: any) => b.id),
        })

        usedPayoutIds.add(payoutTx.id)
        break // 一筆銀行交易只配對一筆 Payout
      }
    }

    console.log("[v0] Total matches:", matches.length)

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
    console.error("[v0] Reconciliation preview error:", error)
    return NextResponse.json({ error: "對賬預覽失敗", details: String(error) }, { status: 500 })
  }
}
