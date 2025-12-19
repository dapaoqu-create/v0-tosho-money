import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const debug: any = {}

  try {
    const { ruleId, bankBatchIds, platformBatchIds } = await request.json()

    debug.request = { ruleId, bankBatchIds, platformBatchIds }

    // 查詢所有銀行交易
    const { data: bankTransactions, error: bankError } = await supabase.from("bank_transactions").select("*")

    debug.bankCount = bankTransactions?.length || 0
    debug.bankError = bankError?.message || null

    // 查詢所有平台交易
    const { data: platformTransactions, error: platformError } = await supabase
      .from("platform_transactions")
      .select("*")

    debug.platformCount = platformTransactions?.length || 0
    debug.platformError = platformError?.message || null

    if (!bankTransactions?.length || !platformTransactions?.length) {
      return NextResponse.json({
        success: true,
        matches: [],
        message: "沒有找到交易資料",
        debug,
      })
    }

    debug.sampleBankRawData = bankTransactions[0]?.raw_data
    debug.sampleBankKeys = Object.keys(bankTransactions[0]?.raw_data || {})
    debug.samplePlatformRawData = platformTransactions[0]?.raw_data
    debug.samplePlatformKeys = Object.keys(platformTransactions[0]?.raw_data || {})

    // 建立 Payout 金額索引 (收款欄位)
    const payoutByAmount = new Map<number, any[]>()
    const payoutAmounts: number[] = []

    for (const tx of platformTransactions) {
      const rawData = tx.raw_data || {}
      const txType = String(rawData["類型"] || "").trim()

      // 只處理 Payout 類型
      if (txType === "Payout") {
        const amountStr = String(rawData["收款"] || "")
        // 移除逗號和空格，取整數部分（移除 .00）
        const cleanAmount = amountStr.replace(/[,，\s]/g, "").split(".")[0]
        const amount = Math.abs(Number.parseInt(cleanAmount) || 0)

        if (amount > 0) {
          payoutAmounts.push(amount)
          if (!payoutByAmount.has(amount)) {
            payoutByAmount.set(amount, [])
          }
          payoutByAmount.get(amount)!.push(tx)
        }
      }
    }

    debug.payoutAmountsSample = payoutAmounts.slice(0, 20)
    debug.payoutCount = payoutAmounts.length

    // 找出所有預訂的確認碼，按入帳日期分組
    const confirmationCodesByDate = new Map<string, string[]>()
    for (const tx of platformTransactions) {
      const rawData = tx.raw_data || {}
      const txType = String(rawData["類型"] || "").trim()
      const confirmCode = String(rawData["確認碼"] || "").trim()
      const accountDate = String(rawData["入帳日期"] || "").trim()

      if ((txType === "預訂" || txType === "Reservation") && confirmCode && accountDate) {
        if (!confirmationCodesByDate.has(accountDate)) {
          confirmationCodesByDate.set(accountDate, [])
        }
        confirmationCodesByDate.get(accountDate)!.push(confirmCode)
      }
    }

    // 進行比對：銀行「入出金(円)」正數 對比 平台「收款」
    const matches: any[] = []
    let matchIndex = 1
    const usedPayoutIds = new Set<string>()
    const bankAmounts: number[] = []

    for (const bankTx of bankTransactions) {
      const rawData = bankTx.raw_data || {}
      const amountStr = String(rawData["入出金(円)"] || "")

      // 移除逗號，轉換為數字
      const cleanAmount = amountStr.replace(/[,，\s]/g, "")
      const bankAmount = Number.parseInt(cleanAmount) || 0
      const bankDate = String(rawData["取引日"] || "")

      if (bankAmount <= 0) {
        continue
      }

      bankAmounts.push(bankAmount)

      // 已對賬的跳過
      if (bankTx.reconciliation_status === "reconciled") continue

      // 查找相同金額的 Payout
      const matchingPayouts = payoutByAmount.get(bankAmount) || []

      for (const payoutTx of matchingPayouts) {
        if (usedPayoutIds.has(payoutTx.id)) continue
        if (payoutTx.reconciliation_status === "reconciled") continue

        // 獲取該 Payout 日期對應的確認碼
        const payoutDate = String(payoutTx.raw_data?.["日期"] || "")
        const confirmationCodes = confirmationCodesByDate.get(payoutDate) || []

        matches.push({
          index: matchIndex++,
          confirmationCode: confirmationCodes.join(", ") || "-",
          transactionCode: bankTx.transaction_code || "-",
          transactionDate: bankDate,
          amount: bankAmount,
          bankTransactionId: bankTx.id,
          platformTransactionId: payoutTx.id,
        })

        usedPayoutIds.add(payoutTx.id)
        break // 一筆銀行交易只配對一筆 Payout
      }
    }

    debug.bankAmountsSample = bankAmounts.slice(0, 20)
    debug.bankPositiveCount = bankAmounts.length
    debug.matchesCount = matches.length

    return NextResponse.json({
      success: true,
      matches,
      message: `找到 ${matches.length} 筆配對`,
      debug,
    })
  } catch (error) {
    debug.error = String(error)
    return NextResponse.json({ error: "對賬預覽失敗", details: String(error), debug }, { status: 500 })
  }
}
