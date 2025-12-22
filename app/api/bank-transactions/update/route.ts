import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { transactionId, transactionCode } = await request.json()

    if (!transactionId) {
      return NextResponse.json({ error: "Transaction ID is required" }, { status: 400 })
    }

    // 更新銀行交易的交易編碼
    const { error } = await supabase
      .from("bank_transactions")
      .update({
        transaction_code: transactionCode,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transactionId)

    if (error) {
      console.error("Update bank transaction error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Update bank transaction error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}
