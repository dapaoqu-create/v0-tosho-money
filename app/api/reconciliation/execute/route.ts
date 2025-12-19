import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

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

    // 獲取選定銀行批次的所有交易
    const { data: bankTransactions } = await supabase
      .from("bank_transactions")
      .select("*")
      .in("batch_id", bankBatchIds)
      .eq("reconciliation_status", "unreconciled")

    // 獲取選定平台批次的所有交易
    const { data: platformTransactions } = await supabase
      .from("platform_transactions")
      .select("*")
      .in("batch_id", platformBatchIds)
      .eq("reconciliation_status", "unreconciled")

    if (!bankTransactions?.length || !platformTransactions?.length) {
      return NextResponse.json({
        success: true,
        message: "沒有可對賬的交易",
        matched: 0,
      })
    }

    let matchedCount = 0
    const bankField = rule.bank_field // 例如: "入出金(円)"
    const platformField = rule.platform_field // 例如: "收款"

    // 對每筆銀行交易進行配對
    for (const bankTx of bankTransactions) {
      // 從 raw_data 獲取銀行金額
      const bankRawData = bankTx.raw_data || {}
      const bankAmountStr = bankRawData[bankField] || ""
      const bankAmount = Number.parseFloat(bankAmountStr.replace(/[,，]/g, "")) || 0

      if (bankAmount <= 0) continue // 只處理入金

      // 找出金額匹配的平台交易（收款欄位）
      const matchedPlatformTxs: any[] = []
      const confirmationCodes: string[] = []

      for (const platformTx of platformTransactions) {
        if (platformTx.reconciliation_status === "reconciled") continue

        const platformRawData = platformTx.raw_data || {}
        const platformAmountStr = platformRawData[platformField] || ""
        const platformAmount = Number.parseFloat(platformAmountStr.replace(/[,，]/g, "")) || 0

        // 金額完全一致
        if (Math.abs(bankAmount - platformAmount) < 0.01 && platformAmount > 0) {
          matchedPlatformTxs.push(platformTx)

          // 獲取確認碼 - 當前行或下一行的確認碼
          const confirmCode = platformRawData["確認碼"] || platformTx.confirmation_code
          if (confirmCode) {
            confirmationCodes.push(confirmCode)
          }
        }
      }

      if (matchedPlatformTxs.length > 0) {
        // 更新銀行交易
        await supabase
          .from("bank_transactions")
          .update({
            reconciliation_status: "reconciled",
            matched_confirmation_codes: confirmationCodes,
            reconciled: true,
          })
          .eq("id", bankTx.id)

        // 更新平台交易
        for (const platformTx of matchedPlatformTxs) {
          await supabase
            .from("platform_transactions")
            .update({
              reconciliation_status: "reconciled",
              matched_bank_transaction_code: bankTx.transaction_code,
              reconciled: true,
            })
            .eq("id", platformTx.id)
        }

        // 記錄對賬匹配
        await supabase.from("reconciliation_matches").insert({
          rule_id: ruleId,
          bank_transaction_id: bankTx.id,
          platform_transaction_ids: matchedPlatformTxs.map((tx) => tx.id),
          confirmation_codes: confirmationCodes,
          is_manual: false,
        })

        matchedCount++
      }
    }

    return NextResponse.json({
      success: true,
      message: `對賬完成`,
      matched: matchedCount,
    })
  } catch (error) {
    console.error("Reconciliation error:", error)
    return NextResponse.json({ error: "對賬執行失敗" }, { status: 500 })
  }
}
