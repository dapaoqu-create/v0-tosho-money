import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { transactionId, confirmationCode } = await request.json()

    if (!transactionId) {
      return NextResponse.json({ error: "Transaction ID is required" }, { status: 400 })
    }

    // 獲取現有交易資料
    const { data: existingTx, error: fetchError } = await supabase
      .from("platform_transactions")
      .select("raw_data")
      .eq("id", transactionId)
      .single()

    if (fetchError) {
      console.error("Fetch platform transaction error:", fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    // 更新 raw_data 中的確認碼
    const updatedRawData = {
      ...existingTx.raw_data,
      確認碼: confirmationCode,
    }

    // 更新平台交易的確認碼
    const { error } = await supabase
      .from("platform_transactions")
      .update({
        confirmation_code: confirmationCode,
        raw_data: updatedRawData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transactionId)

    if (error) {
      console.error("Update platform transaction error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Update platform transaction error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}
