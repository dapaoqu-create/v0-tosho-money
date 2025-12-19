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

function parseAmount(amountStr: string): number {
  if (!amountStr) return 0
  const cleaned = amountStr.replace(/,/g, "").replace(/\s/g, "").split(".")[0]
  return Math.abs(Number.parseInt(cleaned) || 0)
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null
  const cleaned = dateStr.trim()

  // 格式1: YYYYMMDD (如 20241202)
  let match = cleaned.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (match) {
    return new Date(Number.parseInt(match[1]), Number.parseInt(match[2]) - 1, Number.parseInt(match[3]))
  }

  // 格式2: YYYY/MM/DD 或 YYYY-MM-DD
  match = cleaned.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/)
  if (match) {
    return new Date(Number.parseInt(match[1]), Number.parseInt(match[2]) - 1, Number.parseInt(match[3]))
  }

  // 格式3: MM/DD/YYYY 或 MM-DD-YYYY
  match = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (match) {
    return new Date(Number.parseInt(match[3]), Number.parseInt(match[1]) - 1, Number.parseInt(match[2]))
  }

  const parsed = Date.parse(cleaned)
  if (!isNaN(parsed)) {
    return new Date(parsed)
  }

  return null
}

function daysBetween(date1: Date | null, date2: Date | null): number {
  if (!date1 || !date2) return Number.POSITIVE_INFINITY
  const diffTime = Math.abs(date2.getTime() - date1.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
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

    // 按 batch_id 和 _row_index 建立索引
    const txByBatchAndRow = new Map<string, any>()
    let hasRowIndex = false

    for (const tx of platformTransactions) {
      const rawData = tx.raw_data || {}
      const rowIndex = rawData["_row_index"]
      const batchId = tx.batch_id

      if (rowIndex !== undefined && rowIndex !== null) {
        hasRowIndex = true
        const key = `${batchId}:${rowIndex}`
        txByBatchAndRow.set(key, tx)
      }
    }

    debug.hasRowIndex = hasRowIndex
    debug.txByBatchAndRowSize = txByBatchAndRow.size

    // 收集 Payout 並找到下一行的確認碼
    const payoutList: any[] = []

    for (const tx of platformTransactions) {
      const rawData = tx.raw_data || {}
      const txType = String(rawData["類型"] || "").trim()

      if (txType === "Payout") {
        const payoutAmountStr = String(rawData["收款"] || "")
        const payoutAmount = parseAmount(payoutAmountStr)
        const txDate = String(rawData["日期"] || "").trim()
        const parsedDate = parseDate(txDate)
        const rowIndex = rawData["_row_index"]
        const batchId = tx.batch_id

        let confirmationCode = null

        // 方法1: 使用行號找下一行的確認碼
        if (hasRowIndex && rowIndex !== undefined && rowIndex !== null) {
          const nextRowIndex = Number.parseInt(rowIndex) + 1
          const nextKey = `${batchId}:${nextRowIndex}`
          const nextTx = txByBatchAndRow.get(nextKey)

          if (nextTx) {
            const nextRawData = nextTx.raw_data || {}
            const nextConfirmCode = String(nextRawData["確認碼"] || "").trim()
            if (nextConfirmCode) {
              confirmationCode = nextConfirmCode
            }
          }
        }

        if (payoutAmount > 0) {
          payoutList.push({
            id: tx.id,
            amount: payoutAmount,
            date: txDate,
            parsedDate,
            rawData,
            confirmationCode,
            rowIndex,
            batchId,
          })
        }
      }
    }

    debug.payoutCount = payoutList.length
    debug.payoutsWithConfirmCode = payoutList.filter((p) => p.confirmationCode).length
    debug.payoutExamples = payoutList.slice(0, 10).map((p) => ({
      amount: p.amount,
      date: p.date,
      rowIndex: p.rowIndex,
      confirmationCode: p.confirmationCode,
    }))

    // 收集銀行入金交易
    const bankList: any[] = []

    for (const bankTx of bankTransactions) {
      const rawData = bankTx.raw_data || {}
      const amountStr = String(rawData["入出金(円)"] || "")
      const bankAmount = parseAmount(amountStr)
      const txDate = String(rawData["取引日"] || "").trim()
      const parsedDate = parseDate(txDate)

      if (bankAmount > 0) {
        bankList.push({
          id: bankTx.id,
          amount: bankAmount,
          date: txDate,
          parsedDate,
          transactionCode: bankTx.transaction_code,
          rawData,
        })
      }
    }

    debug.bankPositiveCount = bankList.length

    // 按金額分組
    const payoutByAmount = new Map<number, any[]>()
    for (const payout of payoutList) {
      if (!payoutByAmount.has(payout.amount)) {
        payoutByAmount.set(payout.amount, [])
      }
      payoutByAmount.get(payout.amount)!.push(payout)
    }

    const bankByAmount = new Map<number, any[]>()
    for (const bank of bankList) {
      if (!bankByAmount.has(bank.amount)) {
        bankByAmount.set(bank.amount, [])
      }
      bankByAmount.get(bank.amount)!.push(bank)
    }

    // 找交集金額
    const allBankAmounts = new Set(bankList.map((b) => b.amount))
    const allPayoutAmounts = new Set(payoutList.map((p) => p.amount))
    const intersection: number[] = []
    for (const bankAmt of allBankAmounts) {
      if (allPayoutAmounts.has(bankAmt)) {
        intersection.push(bankAmt)
      }
    }

    debug.intersectionCount = intersection.length
    debug.intersectionAmounts = intersection.sort((a, b) => a - b).slice(0, 50)

    // 配對銀行和 Payout（金額相同 + 日期7天內）
    const matches: any[] = []
    let matchIndex = 1
    const usedPayoutIds = new Set<string>()
    const usedBankIds = new Set<string>()

    for (const amount of intersection) {
      const bankTxList = bankByAmount.get(amount) || []
      const payoutTxList = payoutByAmount.get(amount) || []

      for (const bankTx of bankTxList) {
        if (usedBankIds.has(bankTx.id)) continue

        let bestMatch: any = null
        let bestDaysDiff = Number.POSITIVE_INFINITY

        for (const payoutTx of payoutTxList) {
          if (usedPayoutIds.has(payoutTx.id)) continue

          const daysDiff = daysBetween(bankTx.parsedDate, payoutTx.parsedDate)

          if (daysDiff <= 7 && daysDiff < bestDaysDiff) {
            bestDaysDiff = daysDiff
            bestMatch = payoutTx
          }
        }

        if (bestMatch) {
          matches.push({
            index: matchIndex++,
            confirmationCode: bestMatch.confirmationCode || "-",
            transactionCode: bankTx.transactionCode || "-",
            transactionDate: bankTx.date,
            payoutDate: bestMatch.date,
            amount: amount,
            daysDiff: bestDaysDiff,
            bankTransactionId: bankTx.id,
            platformTransactionId: bestMatch.id,
          })

          usedPayoutIds.add(bestMatch.id)
          usedBankIds.add(bankTx.id)
        }
      }
    }

    debug.matchesCount = matches.length
    debug.unmatchedBankCount = bankList.filter((b) => !usedBankIds.has(b.id)).length
    debug.unmatchedPayoutCount = payoutList.filter((p) => !usedPayoutIds.has(p.id)).length

    if (!hasRowIndex) {
      debug.warning = "現有資料沒有行號(_row_index)，確認碼可能不準確。請重新匯入 CSV 以獲得正確的確認碼配對。"
    }

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
