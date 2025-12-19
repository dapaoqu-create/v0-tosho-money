import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const { logId } = await request.json()

    if (!logId) {
      return NextResponse.json({ error: "Missing log ID" }, { status: 400 })
    }

    // 獲取對賬日誌
    const { data: log } = await supabase
      .from("reconciliation_logs")
      .select("*")
      .eq("id", logId)
      .eq("status", "pending")
      .single()

    if (!log) {
      return NextResponse.json({ error: "Log not found or already processed" }, { status: 404 })
    }

    const matches = log.matches as Array<{
      confirmationCode: string
      transactionCode: string
      bankTransactionId: string
      platformTransactionId: string
      platformBookingIds: string[]
    }>

    // 更新每筆配對的交易
    for (const match of matches) {
      // 更新銀行交易
      await supabase
        .from("bank_transactions")
        .update({
          reconciliation_status: "reconciled",
          matched_confirmation_codes: match.confirmationCode ? match.confirmationCode.split(", ").filter(Boolean) : [],
          reconciled: true,
        })
        .eq("id", match.bankTransactionId)

      // 更新平台 Payout 交易
      await supabase
        .from("platform_transactions")
        .update({
          reconciliation_status: "reconciled",
          matched_bank_transaction_code: match.transactionCode,
          reconciled: true,
        })
        .eq("id", match.platformTransactionId)

      // 更新相關的預訂交易
      if (match.platformBookingIds?.length > 0) {
        await supabase
          .from("platform_transactions")
          .update({
            reconciliation_status: "reconciled",
            matched_bank_transaction_code: match.transactionCode,
            reconciled: true,
          })
          .in("id", match.platformBookingIds)
      }
    }

    // 更新日誌狀態
    await supabase
      .from("reconciliation_logs")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", logId)

    return NextResponse.json({
      success: true,
      message: `已確認 ${matches.length} 筆對賬`,
      confirmed: matches.length,
    })
  } catch (error) {
    console.error("Reconciliation confirm error:", error)
    return NextResponse.json({ error: "對賬確認失敗" }, { status: 500 })
  }
}
