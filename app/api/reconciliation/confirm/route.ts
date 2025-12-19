import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const { logId, matches: directMatches, ruleId } = await request.json()

    let matches: Array<{
      confirmationCode: string
      transactionCode: string
      bankTransactionId: string
      platformTransactionId: string
      platformBookingIds?: string[]
    }> = []

    if (logId) {
      // 從日誌獲取配對（舊邏輯）
      const { data: log } = await supabase
        .from("reconciliation_logs")
        .select("*")
        .eq("id", logId)
        .eq("status", "pending")
        .single()

      if (!log) {
        return NextResponse.json({ error: "Log not found or already processed" }, { status: 404 })
      }
      matches = log.matches || []
    } else if (directMatches && Array.isArray(directMatches)) {
      // 直接使用傳入的配對陣列（新邏輯）
      matches = directMatches
    } else {
      return NextResponse.json({ error: "Missing matches data" }, { status: 400 })
    }

    if (matches.length === 0) {
      return NextResponse.json({ error: "No matches to confirm" }, { status: 400 })
    }

    let successCount = 0
    let errorCount = 0

    // 更新每筆配對的交易
    for (const match of matches) {
      try {
        // 更新銀行交易
        const { error: bankError } = await supabase
          .from("bank_transactions")
          .update({
            reconciliation_status: "reconciled",
            matched_confirmation_codes:
              match.confirmationCode && match.confirmationCode !== "-"
                ? match.confirmationCode.split(", ").filter(Boolean)
                : [],
            reconciled: true,
          })
          .eq("id", match.bankTransactionId)

        if (bankError) {
          console.error("[v0] Bank update error:", bankError)
          errorCount++
          continue
        }

        // 更新平台 Payout 交易
        const { error: platformError } = await supabase
          .from("platform_transactions")
          .update({
            reconciliation_status: "reconciled",
            matched_bank_transaction_code: match.transactionCode || "",
            reconciled: true,
          })
          .eq("id", match.platformTransactionId)

        if (platformError) {
          console.error("[v0] Platform update error:", platformError)
          errorCount++
          continue
        }

        // 更新相關的預訂交易
        if (match.platformBookingIds && match.platformBookingIds.length > 0) {
          await supabase
            .from("platform_transactions")
            .update({
              reconciliation_status: "reconciled",
              matched_bank_transaction_code: match.transactionCode || "",
              reconciled: true,
            })
            .in("id", match.platformBookingIds)
        }

        successCount++
      } catch (err) {
        console.error("[v0] Match update error:", err)
        errorCount++
      }
    }

    // 如果有 logId，更新日誌狀態
    if (logId) {
      await supabase
        .from("reconciliation_logs")
        .update({
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", logId)
    } else {
      // 新增一條確認日誌
      await supabase.from("reconciliation_logs").insert({
        rule_id: ruleId || null,
        matches_count: successCount,
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        matches: matches,
      })
    }

    return NextResponse.json({
      success: true,
      message: `已確認 ${successCount} 筆對賬${errorCount > 0 ? `，${errorCount} 筆失敗` : ""}`,
      confirmed: successCount,
      errors: errorCount,
    })
  } catch (error) {
    console.error("Reconciliation confirm error:", error)
    return NextResponse.json({ error: "對賬確認失敗", details: String(error) }, { status: 500 })
  }
}
