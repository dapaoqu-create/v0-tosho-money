import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const debug: any = {}

  try {
    const { ruleId, bankBatchIds, platformBatchIds } = await request.json()

    debug.request = { ruleId, bankBatchIds, platformBatchIds }

    const { data: bankTransactions, error: bankError } = await supabase
      .from("bank_transactions")
      .select("*")
      .range(0, 9999)

    debug.bankCount = bankTransactions?.length || 0
    debug.bankError = bankError?.message || null

    const { data: platformTransactions, error: platformError } = await supabase
      .from("platform_transactions")
      .select("*")
      .range(0, 9999)

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

    // 建立 Payout 金額映射
    const payoutByAmount = new Map<number, any[]>()
    const allPayoutAmounts = new Set<number>()

    for (const tx of platformTransactions) {
      const rawData = tx.raw_data || {}
      const txType = String(rawData["類型"] || "").trim()

      if (txType === "Payout") {
        const amountStr = String(rawData["收款"] || "")
        const cleanAmount = amountStr.replace(/[^0-9.-]/g, "").split(".")[0]
        const amount = Math.abs(Number.parseInt(cleanAmount) || 0)

        if (amount > 0) {
          allPayoutAmounts.add(amount)
          if (!payoutByAmount.has(amount)) {
            payoutByAmount.set(amount, [])
          }
          payoutByAmount.get(amount)!.push(tx)
        }
      }
    }

    // 建立銀行金額映射（只處理正數入金）
    const allBankAmounts = new Set<number>()
    const bankAmountToTx = new Map<number, any[]>()

    for (const bankTx of bankTransactions) {
      const rawData = bankTx.raw_data || {}
      const amountStr = String(rawData["入出金(円)"] || "")

      const cleanAmount = amountStr.replace(/[^0-9.-]/g, "")
      const bankAmount = Number.parseInt(cleanAmount) || 0

      // 只處理正數（入金），跳過負數（支出）
      if (bankAmount > 0) {
        allBankAmounts.add(bankAmount)
        if (!bankAmountToTx.has(bankAmount)) {
          bankAmountToTx.set(bankAmount, [])
        }
        bankAmountToTx.get(bankAmount)!.push(bankTx)
      }
    }

    const intersection: number[] = []
    for (const bankAmt of allBankAmounts) {
      if (allPayoutAmounts.has(bankAmt)) {
        intersection.push(bankAmt)
      }
    }

    debug.payoutCount = allPayoutAmounts.size
    debug.bankPositiveCount = allBankAmounts.size
    debug.intersectionCount = intersection.length
    debug.intersectionAmounts = intersection.sort((a, b) => a - b).slice(0, 30)
    debug.allPayoutAmountsSorted = Array.from(allPayoutAmounts)
      .sort((a, b) => a - b)
      .slice(0, 30)
    debug.allBankAmountsSorted = Array.from(allBankAmounts)
      .sort((a, b) => a - b)
      .slice(0, 30)

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

    // 進行配對
    const matches: any[] = []
    let matchIndex = 1
    const usedPayoutIds = new Set<string>()
    const usedBankIds = new Set<string>()

    for (const amount of intersection) {
      const bankTxList = bankAmountToTx.get(amount) || []
      const payoutTxList = payoutByAmount.get(amount) || []

      for (const bankTx of bankTxList) {
        if (usedBankIds.has(bankTx.id)) continue
        if (bankTx.reconciliation_status === "reconciled") continue

        for (const payoutTx of payoutTxList) {
          if (usedPayoutIds.has(payoutTx.id)) continue
          if (payoutTx.reconciliation_status === "reconciled") continue

          const bankDate = String(bankTx.raw_data?.["取引日"] || "")
          const payoutDate = String(payoutTx.raw_data?.["日期"] || "")
          const confirmationCodes = confirmationCodesByDate.get(payoutDate) || []

          matches.push({
            index: matchIndex++,
            confirmationCode: confirmationCodes.join(", ") || "-",
            transactionCode: bankTx.transaction_code || "-",
            transactionDate: bankDate,
            amount: amount,
            bankTransactionId: bankTx.id,
            platformTransactionId: payoutTx.id,
          })

          usedPayoutIds.add(payoutTx.id)
          usedBankIds.add(bankTx.id)
          break
        }
      }
    }

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
