import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

function parseAmount(value: any): number {
  if (value === null || value === undefined || value === "") return 0
  const str = String(value)
    .replace(/[,，\s]/g, "")
    .trim()
  // 取整數部分，保留正負號
  const num = Number.parseFloat(str)
  if (isNaN(num)) return 0
  return Math.floor(num)
}

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

    // 查詢銀行交易
    const { data: bankTransactions } = await supabase.from("bank_transactions").select("*").in("batch_id", bankBatchIds)

    // 查詢平台交易
    const { data: platformTransactions } = await supabase
      .from("platform_transactions")
      .select("*")
      .in("batch_id", platformBatchIds)

    if (!bankTransactions?.length || !platformTransactions?.length) {
      return NextResponse.json({
        success: true,
        matches: [],
        message: "沒有可對賬的交易",
      })
    }

    const payoutByAmount = new Map<number, any[]>()

    for (const tx of platformTransactions) {
      const rawData = tx.raw_data || {}
      const txType = rawData["類型"] || ""

      if (txType === "Payout") {
        const amountStr = rawData["收款"] || ""
        const amount = parseAmount(amountStr)

        // 只處理正數金額
        if (amount > 0) {
          if (!payoutByAmount.has(amount)) {
            payoutByAmount.set(amount, [])
          }
          payoutByAmount.get(amount)!.push(tx)
        }
      }
    }

    // 但由於 Payout 和預訂的關聯是透過金額累計，這裡改用簡單方式：
    // 對每筆 Payout，找到 入帳日期 相同的所有預訂的確認碼
    const getConfirmationCodesForPayout = (payoutTx: any): string[] => {
      const payoutDate = payoutTx.raw_data?.["日期"] || ""
      const codes: string[] = []

      for (const tx of platformTransactions) {
        const rawData = tx.raw_data || {}
        const txType = rawData["類型"] || ""
        const confirmCode = rawData["確認碼"] || ""
        const txDate = rawData["入帳日期"] || ""

        // 預訂類型且入帳日期與 Payout 日期相同
        if ((txType === "預訂" || txType === "Reservation") && confirmCode && txDate === payoutDate) {
          codes.push(confirmCode)
        }
      }

      return codes
    }

    const matches: any[] = []
    let matchIndex = 1
    const usedPayoutIds = new Set<string>()

    for (const bankTx of bankTransactions) {
      const rawData = bankTx.raw_data || {}
      const amountStr = rawData["入出金(円)"] || ""
      const bankAmount = parseAmount(amountStr)
      const bankDate = rawData["取引日"] || ""

      if (bankAmount <= 0) continue

      // 已對賬的跳過
      if (bankTx.reconciliation_status === "reconciled") continue

      // 查找相同金額的 Payout
      const matchingPayouts = payoutByAmount.get(bankAmount) || []

      for (const payoutTx of matchingPayouts) {
        if (usedPayoutIds.has(payoutTx.id)) continue
        if (payoutTx.reconciliation_status === "reconciled") continue

        const confirmationCodes = getConfirmationCodesForPayout(payoutTx)

        matches.push({
          index: matchIndex++,
          confirmationCode: confirmationCodes.join(", ") || "-",
          transactionCode: bankTx.transaction_code || "-",
          transactionDate: bankDate,
          amount: bankAmount,
          bankTransactionId: bankTx.id,
          platformTransactionId: payoutTx.id,
          platformBookingIds: [], // 簡化處理
        })

        usedPayoutIds.add(payoutTx.id)
        break // 一筆銀行交易只配對一筆 Payout
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
    return NextResponse.json({ error: "對賬預覽失敗", details: String(error) }, { status: 500 })
  }
}
