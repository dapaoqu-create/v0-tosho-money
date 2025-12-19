import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

async function fetchAllRows(supabase: any, table: string) {
  const allRows: any[] = []
  const pageSize = 1000
  let page = 0
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (error) {
      console.error(`[v0] Error fetching ${table} page ${page}:`, error)
      break
    }

    if (data && data.length > 0) {
      allRows.push(...data)
      page++
      hasMore = data.length === pageSize
    } else {
      hasMore = false
    }
  }

  return allRows
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const debug: any = {}

  try {
    const { ruleId, bankBatchIds, platformBatchIds } = await request.json()

    debug.request = { ruleId, bankBatchIds, platformBatchIds }

    const bankTransactions = await fetchAllRows(supabase, "bank_transactions")
    debug.bankCount = bankTransactions.length

    const platformTransactions = await fetchAllRows(supabase, "platform_transactions")
    debug.platformCount = platformTransactions.length

    if (!bankTransactions.length || !platformTransactions.length) {
      return NextResponse.json({
        success: true,
        matches: [],
        message: "沒有找到交易資料",
        debug,
      })
    }

    const bankAmountExamples: string[] = []
    const payoutAmountExamples: string[] = []

    // 建立 Payout 金額映射
    const payoutByAmount = new Map<number, any[]>()
    const allPayoutAmounts = new Set<number>()

    for (const tx of platformTransactions) {
      const rawData = tx.raw_data || {}
      const txType = String(rawData["類型"] || "").trim()

      if (txType === "Payout") {
        const amountStr = String(rawData["收款"] || "")

        const cleanAmount = amountStr.replace(/,/g, "").replace(/\s/g, "").split(".")[0]
        const amount = Math.abs(Number.parseInt(cleanAmount) || 0)

        if (payoutAmountExamples.length < 20) {
          payoutAmountExamples.push(`"${amountStr}" -> ${amount}`)
        }

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

      const cleanAmount = amountStr.replace(/,/g, "").replace(/\s/g, "")
      const bankAmount = Number.parseInt(cleanAmount) || 0

      if (bankAmountExamples.length < 20) {
        bankAmountExamples.push(`"${amountStr}" -> ${bankAmount}`)
      }

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
    debug.intersectionAmounts = intersection.sort((a, b) => a - b).slice(0, 50)
    debug.bankAmountExamples = bankAmountExamples
    debug.payoutAmountExamples = payoutAmountExamples
    debug.allPayoutAmountsSorted = Array.from(allPayoutAmounts)
      .sort((a, b) => a - b)
      .slice(0, 50)
    debug.allBankAmountsSorted = Array.from(allBankAmounts)
      .sort((a, b) => a - b)
      .slice(0, 50)

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

    const matches: any[] = []
    let matchIndex = 1
    const usedPayoutIds = new Set<string>()
    const usedBankIds = new Set<string>()

    const skippedBankReconciled = 0
    const skippedPayoutReconciled = 0
    let attemptedMatches = 0

    for (const amount of intersection) {
      const bankTxList = bankAmountToTx.get(amount) || []
      const payoutTxList = payoutByAmount.get(amount) || []

      for (const bankTx of bankTxList) {
        if (usedBankIds.has(bankTx.id)) continue

        // if (bankTx.reconciliation_status === "reconciled") {
        //   skippedBankReconciled++
        //   continue
        // }

        for (const payoutTx of payoutTxList) {
          if (usedPayoutIds.has(payoutTx.id)) continue

          // if (payoutTx.reconciliation_status === "reconciled") {
          //   skippedPayoutReconciled++
          //   continue
          // }

          attemptedMatches++

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
    debug.skippedBankReconciled = skippedBankReconciled
    debug.skippedPayoutReconciled = skippedPayoutReconciled
    debug.attemptedMatches = attemptedMatches
    debug.bankMapSize = bankAmountToTx.size
    debug.payoutMapSize = payoutByAmount.size

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
