import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const { type, transactionId, confirmationCode, transactionCode } = await request.json()

    if (!transactionId) {
      return NextResponse.json({ error: "Missing transaction ID" }, { status: 400 })
    }

    if (type === "bank") {
      // 銀行報表手動填寫確認碼
      if (!confirmationCode) {
        return NextResponse.json({ error: "Missing confirmation code" }, { status: 400 })
      }

      // 更新銀行交易
      await supabase
        .from("bank_transactions")
        .update({
          reconciliation_status: "reconciled",
          matched_confirmation_codes: [confirmationCode],
          reconciled: true,
        })
        .eq("id", transactionId)

      // 獲取銀行交易的交易編碼
      const { data: bankTx } = await supabase
        .from("bank_transactions")
        .select("transaction_code")
        .eq("id", transactionId)
        .single()

      // 更新對應的平台交易
      const { data: platformTxs } = await supabase
        .from("platform_transactions")
        .select("*")
        .eq("confirmation_code", confirmationCode)

      if (platformTxs && platformTxs.length > 0) {
        for (const platformTx of platformTxs) {
          await supabase
            .from("platform_transactions")
            .update({
              reconciliation_status: "reconciled",
              matched_bank_transaction_code: bankTx?.transaction_code || null,
              reconciled: true,
            })
            .eq("id", platformTx.id)
        }
      }

      // 記錄手動對賬
      await supabase.from("reconciliation_matches").insert({
        bank_transaction_id: transactionId,
        platform_transaction_ids: platformTxs?.map((tx) => tx.id) || [],
        confirmation_codes: [confirmationCode],
        is_manual: true,
      })
    } else if (type === "platform") {
      // 平台報表手動填寫交易編碼
      if (!transactionCode) {
        return NextResponse.json({ error: "Missing transaction code" }, { status: 400 })
      }

      // 獲取平台交易的確認碼
      const { data: platformTx } = await supabase
        .from("platform_transactions")
        .select("confirmation_code")
        .eq("id", transactionId)
        .single()

      // 更新平台交易
      await supabase
        .from("platform_transactions")
        .update({
          reconciliation_status: "reconciled",
          matched_bank_transaction_code: transactionCode,
          reconciled: true,
        })
        .eq("id", transactionId)

      // 更新對應的銀行交易
      const { data: bankTxs } = await supabase
        .from("bank_transactions")
        .select("*")
        .eq("transaction_code", transactionCode)

      if (bankTxs && bankTxs.length > 0) {
        for (const bankTx of bankTxs) {
          const existingCodes = bankTx.matched_confirmation_codes || []
          const newCodes = platformTx?.confirmation_code
            ? [...new Set([...existingCodes, platformTx.confirmation_code])]
            : existingCodes

          await supabase
            .from("bank_transactions")
            .update({
              reconciliation_status: "reconciled",
              matched_confirmation_codes: newCodes,
              reconciled: true,
            })
            .eq("id", bankTx.id)
        }

        // 記錄手動對賬
        await supabase.from("reconciliation_matches").insert({
          bank_transaction_id: bankTxs[0].id,
          platform_transaction_ids: [transactionId],
          confirmation_codes: platformTx?.confirmation_code ? [platformTx.confirmation_code] : [],
          is_manual: true,
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Manual reconciliation error:", error)
    return NextResponse.json({ error: "手動對賬失敗" }, { status: 500 })
  }
}
