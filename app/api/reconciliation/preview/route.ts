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

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null

  // 清理字串
  const cleaned = dateStr.trim()

  let match = cleaned.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (match) {
    return new Date(Number.parseInt(match[1]), Number.parseInt(match[2]) - 1, Number.parseInt(match[3]))
  }

  // 格式2: 2024/12/14 或 2024-12-14
  match = cleaned.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/)
  if (match) {
    return new Date(Number.parseInt(match[1]), Number.parseInt(match[2]) - 1, Number.parseInt(match[3]))
  }

  // 格式3: 12/14/2025 或 12-14-2025 (月/日/年)
  match = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (match) {
    return new Date(Number.parseInt(match[3]), Number.parseInt(match[1]) - 1, Number.parseInt(match[2]))
  }

  // 格式4: 直接嘗試 Date.parse
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

    // 步驟1: 收集所有預訂（有確認碼的行），按日期和 id 排序
    const allBookings: any[] = []

    for (const tx of platformTransactions) {
      const rawData = tx.raw_data || {}
      const txType = String(rawData["類型"] || "").trim()
      const confirmCode = String(rawData["確認碼"] || "").trim()
      const txDate = String(rawData["日期"] || "").trim()

      if ((txType === "預訂" || txType === "Reservation") && confirmCode) {
        allBookings.push({
          id: tx.id,
          confirmationCode: confirmCode,
          date: txDate,
          used: false, // 標記是否已被配對
        })
      }
    }

    // 步驟2: 收集所有 Payout，按日期排序
    const payoutList: any[] = []

    for (const tx of platformTransactions) {
      const rawData = tx.raw_data || {}
      const txType = String(rawData["類型"] || "").trim()

      if (txType === "Payout") {
        const amountStr = String(rawData["收款"] || "")
        const cleanAmount = amountStr.replace(/,/g, "").replace(/\s/g, "").split(".")[0]
        const amount = Math.abs(Number.parseInt(cleanAmount) || 0)
        const txDate = String(rawData["日期"] || "").trim()
        const parsedDate = parseDate(txDate)

        if (amount > 0) {
          payoutList.push({
            id: tx.id,
            amount,
            date: txDate,
            parsedDate,
            rawData,
            confirmationCode: null, // 稍後配對
            bookingId: null,
          })
        }
      }
    }

    // 步驟3: 為每個 Payout 配對一個確認碼（一對一）
    // 規則：找同一天、尚未被使用的第一個預訂
    for (const payout of payoutList) {
      // 找同一天且尚未被使用的預訂
      const sameDayBooking = allBookings.find((b) => b.date === payout.date && !b.used)

      if (sameDayBooking) {
        payout.confirmationCode = sameDayBooking.confirmationCode
        payout.bookingId = sameDayBooking.id
        sameDayBooking.used = true // 標記為已使用
      }
    }

    // 步驟4: 收集銀行入金交易
    const bankList: any[] = []

    for (const bankTx of bankTransactions) {
      const rawData = bankTx.raw_data || {}
      const amountStr = String(rawData["入出金(円)"] || "")
      const cleanAmount = amountStr.replace(/,/g, "").replace(/\s/g, "")
      const bankAmount = Number.parseInt(cleanAmount) || 0
      const txDate = String(rawData["取引日"] || "").trim()
      const parsedDate = parseDate(txDate)

      // 只處理正數（入金），跳過負數（支出）
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
    debug.payoutCount = payoutList.length
    debug.bookingsCount = allBookings.length
    debug.payoutsWithConfirmCode = payoutList.filter((p) => p.confirmationCode).length

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

    debug.bankAmountExamples = bankList.slice(0, 20).map((b) => {
      const parsed = b.parsedDate
        ? `${b.parsedDate.getFullYear()}/${b.parsedDate.getMonth() + 1}/${b.parsedDate.getDate()}`
        : "null"
      return `"${b.rawData["入出金(円)"]}" -> ${b.amount} (${b.date} => ${parsed})`
    })
    debug.payoutAmountExamples = payoutList.slice(0, 20).map((p) => {
      const parsed = p.parsedDate
        ? `${p.parsedDate.getFullYear()}/${p.parsedDate.getMonth() + 1}/${p.parsedDate.getDate()}`
        : "null"
      return `"${p.rawData["收款"]}" -> ${p.amount} (${p.date} => ${parsed}) [確認碼: ${p.confirmationCode || "無"}]`
    })

    // 步驟5: 配對銀行和 Payout
    const matches: any[] = []
    let matchIndex = 1
    const usedPayoutIds = new Set<string>()
    const usedBankIds = new Set<string>()

    for (const amount of intersection) {
      const bankTxList = bankByAmount.get(amount) || []
      const payoutTxList = payoutByAmount.get(amount) || []

      // 對於每個銀行交易，找到日期最接近的 Payout（7天內）
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
            platformBookingId: bestMatch.bookingId,
          })

          usedPayoutIds.add(bestMatch.id)
          usedBankIds.add(bankTx.id)
        }
      }
    }

    const unmatchedBankCount = bankList.filter((b) => !usedBankIds.has(b.id)).length
    const unmatchedPayoutCount = payoutList.filter((p) => !usedPayoutIds.has(p.id)).length

    debug.matchesCount = matches.length
    debug.unmatchedBankCount = unmatchedBankCount
    debug.unmatchedPayoutCount = unmatchedPayoutCount
    debug.bankMapSize = bankByAmount.size
    debug.payoutMapSize = payoutByAmount.size

    const unmatchedBankExamples = bankList
      .filter((b) => !usedBankIds.has(b.id))
      .slice(0, 10)
      .map((b) => ({
        amount: b.amount,
        date: b.date,
        hasPayoutWithSameAmount: payoutByAmount.has(b.amount),
        payoutDates: (payoutByAmount.get(b.amount) || []).map((p) => p.date),
      }))

    debug.unmatchedBankExamples = unmatchedBankExamples

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
