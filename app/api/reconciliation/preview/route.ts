import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const { ruleId, bankBatchIds, platformBatchIds } = await request.json()

    console.log("[v0] Reconciliation preview request:", { ruleId, bankBatchIds, platformBatchIds })

    if (!ruleId || !bankBatchIds?.length || !platformBatchIds?.length) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    // 獲取對賬規則
    const { data: rule } = await supabase.from("reconciliation_rules").select("*").eq("id", ruleId).single()

    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 })
    }

    const { data: matchResults, error: matchError } = await supabase.rpc("match_reconciliation", {
      bank_batch_ids: bankBatchIds,
      platform_batch_ids: platformBatchIds,
    })

    // 如果 RPC 不存在，使用備用的直接查詢方式
    if (matchError) {
      console.log("[v0] RPC not available, using direct query")

      // 查詢所有銀行入金交易（正數金額）
      const { data: bankTransactions, error: bankError } = await supabase
        .from("bank_transactions")
        .select("*")
        .in("batch_id", bankBatchIds)

      console.log("[v0] Bank transactions query result:", {
        count: bankTransactions?.length,
        error: bankError,
        sampleBatchId: bankBatchIds[0],
      })

      // 查詢所有平台交易
      const { data: platformTransactions, error: platformError } = await supabase
        .from("platform_transactions")
        .select("*")
        .in("batch_id", platformBatchIds)

      console.log("[v0] Platform transactions query result:", {
        count: platformTransactions?.length,
        error: platformError,
        sampleBatchId: platformBatchIds[0],
      })

      if (!bankTransactions?.length || !platformTransactions?.length) {
        // 如果沒有找到資料，嘗試不過濾 batch_id 來檢查是否有資料
        const { data: allBankTx } = await supabase.from("bank_transactions").select("id, batch_id").limit(5)
        const { data: allPlatformTx } = await supabase.from("platform_transactions").select("id, batch_id").limit(5)

        console.log(
          "[v0] Debug - Sample bank batch_ids:",
          allBankTx?.map((t) => t.batch_id),
        )
        console.log(
          "[v0] Debug - Sample platform batch_ids:",
          allPlatformTx?.map((t) => t.batch_id),
        )

        return NextResponse.json({
          success: true,
          matches: [],
          message: "沒有找到可對賬的交易資料",
          debug: {
            requestedBankBatchIds: bankBatchIds,
            requestedPlatformBatchIds: platformBatchIds,
            sampleBankBatchIds: allBankTx?.map((t) => t.batch_id),
            samplePlatformBatchIds: allPlatformTx?.map((t) => t.batch_id),
          },
        })
      }

      // 建立 Payout 金額索引
      const payoutByAmount = new Map<number, any[]>()

      for (const tx of platformTransactions) {
        const rawData = tx.raw_data || {}
        const txType = String(rawData["類型"] || "").trim()

        if (txType === "Payout") {
          const amountStr = String(rawData["收款"] || "")
          // 移除逗號和空格，取整數部分
          const cleanAmount = amountStr.replace(/[,，\s]/g, "")
          const amount = Math.floor(Math.abs(Number.parseFloat(cleanAmount) || 0))

          if (amount > 0) {
            if (!payoutByAmount.has(amount)) {
              payoutByAmount.set(amount, [])
            }
            payoutByAmount.get(amount)!.push(tx)
          }
        }
      }

      console.log("[v0] Payout amounts found:", Array.from(payoutByAmount.keys()).slice(0, 10))

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

      // 進行比對
      const matches: any[] = []
      let matchIndex = 1
      const usedPayoutIds = new Set<string>()

      for (const bankTx of bankTransactions) {
        const rawData = bankTx.raw_data || {}
        const amountStr = String(rawData["入出金(円)"] || "")

        // 移除逗號，轉換為數字
        const cleanAmount = amountStr.replace(/[,，\s]/g, "")
        const bankAmount = Math.floor(Number.parseFloat(cleanAmount) || 0)
        const bankDate = String(rawData["取引日"] || "")

        // 只處理正數金額（入金）
        if (bankAmount <= 0) continue

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

      console.log("[v0] Matches found:", matches.length)

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
    }

    // 如果 RPC 成功，使用 RPC 結果
    return NextResponse.json({
      success: true,
      matches: matchResults || [],
      message: `找到 ${matchResults?.length || 0} 筆配對`,
    })
  } catch (error) {
    console.error("[v0] Reconciliation preview error:", error)
    return NextResponse.json({ error: "對賬預覽失敗", details: String(error) }, { status: 500 })
  }
}
