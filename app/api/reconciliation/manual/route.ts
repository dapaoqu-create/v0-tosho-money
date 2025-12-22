import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

function getRowIndex(tx: any): number {
  return Number.parseInt(tx.raw_data?._row_index || tx._row_index || "0", 10)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const { type, transactionId, confirmationCode, transactionCode } = await request.json()

    console.log("[v0] Manual reconciliation request:", { type, transactionId, confirmationCode, transactionCode })

    if (!transactionId) {
      return NextResponse.json({ error: "Missing transaction ID" }, { status: 400 })
    }

    if (type === "bank") {
      // 銀行報表手動填寫確認碼
      if (!confirmationCode) {
        return NextResponse.json({ error: "Missing confirmation code" }, { status: 400 })
      }

      // 獲取銀行交易的交易編碼
      const { data: bankTx, error: bankError } = await supabase
        .from("bank_transactions")
        .select("*")
        .eq("id", transactionId)
        .single()

      console.log("[v0] Bank transaction:", {
        id: bankTx?.id,
        transactionCode: bankTx?.transaction_code,
        error: bankError,
      })

      if (!bankTx) {
        return NextResponse.json({ error: "Bank transaction not found" }, { status: 404 })
      }

      const bankTransactionCode = bankTx.transaction_code
      console.log("[v0] Bank transaction code:", bankTransactionCode)

      // 更新銀行交易
      const { error: updateBankError } = await supabase
        .from("bank_transactions")
        .update({
          reconciliation_status: "reconciled",
          matched_confirmation_codes: [confirmationCode],
          reconciled: true,
        })
        .eq("id", transactionId)

      console.log("[v0] Updated bank transaction, error:", updateBankError)

      // 先嘗試用 confirmation_code 欄位查詢
      const { data: platformTxsByCode } = await supabase
        .from("platform_transactions")
        .select("*")
        .eq("confirmation_code", confirmationCode)

      console.log("[v0] Platform txs by confirmation_code field:", platformTxsByCode?.length || 0)

      // 如果沒找到，分批查詢所有批次，在每個批次中查找
      let platformTxs = platformTxsByCode || []

      if (platformTxs.length === 0) {
        // 獲取所有平台批次
        const { data: batches } = await supabase
          .from("csv_import_batches")
          .select("batch_id")
          .eq("source_type", "platform")

        console.log("[v0] Found platform batches:", batches?.length || 0)

        // 逐個批次查詢
        for (const batch of batches || []) {
          const { data: batchTxs } = await supabase
            .from("platform_transactions")
            .select("*")
            .eq("batch_id", batch.batch_id)

          // 在 JavaScript 中過濾
          const matchedTxs =
            batchTxs?.filter(
              (tx) =>
                tx.raw_data?.["確認碼"] === confirmationCode || tx.raw_data?.["Confirmation Code"] === confirmationCode,
            ) || []

          if (matchedTxs.length > 0) {
            platformTxs = matchedTxs
            console.log("[v0] Found matching txs in batch:", batch.batch_id, "count:", matchedTxs.length)
            break // 找到就停止
          }
        }
      }

      console.log("[v0] Total platform transactions found:", platformTxs.length)

      if (platformTxs.length > 0) {
        for (const platformTx of platformTxs) {
          const platformRowIndex = getRowIndex(platformTx)
          console.log("[v0] Processing platform tx:", {
            id: platformTx.id,
            rowIndex: platformRowIndex,
            batchId: platformTx.batch_id,
            type: platformTx.type,
          })

          // 更新預訂行狀態
          const { error: updateBookingError } = await supabase
            .from("platform_transactions")
            .update({
              reconciliation_status: "reconciled",
              reconciled: true,
            })
            .eq("id", platformTx.id)

          console.log("[v0] Updated booking row, error:", updateBookingError)

          // 查詢同批次的所有 Payout
          const { data: batchPayouts, error: payoutQueryError } = await supabase
            .from("platform_transactions")
            .select("*")
            .eq("batch_id", platformTx.batch_id)
            .eq("type", "Payout")

          console.log("[v0] Batch payouts found:", batchPayouts?.length, "error:", payoutQueryError)

          // 在 JavaScript 中找到最近的前一個 Payout
          const filteredPayouts =
            batchPayouts?.filter((p) => {
              const payoutRowIndex = getRowIndex(p)
              console.log("[v0] Checking payout row:", payoutRowIndex, "< booking row:", platformRowIndex)
              return payoutRowIndex < platformRowIndex
            }) || []

          console.log("[v0] Filtered payouts (before booking):", filteredPayouts.length)

          // 排序找到最近的 Payout
          const sortedPayouts = filteredPayouts.sort((a, b) => getRowIndex(b) - getRowIndex(a))
          const payoutTx = sortedPayouts[0]

          console.log(
            "[v0] Found payout tx:",
            payoutTx
              ? {
                  id: payoutTx.id,
                  rowIndex: getRowIndex(payoutTx),
                  currentStatus: payoutTx.reconciliation_status,
                  currentCode: payoutTx.matched_bank_transaction_code,
                }
              : null,
          )

          if (payoutTx) {
            const { error: updatePayoutError } = await supabase
              .from("platform_transactions")
              .update({
                reconciliation_status: "reconciled",
                matched_bank_transaction_code: bankTransactionCode,
                reconciled: true,
              })
              .eq("id", payoutTx.id)

            console.log(
              "[v0] Updated payout with bank transaction code:",
              bankTransactionCode,
              "error:",
              updatePayoutError,
            )

            // 驗證更新是否成功
            const { data: verifyPayout } = await supabase
              .from("platform_transactions")
              .select("reconciliation_status, matched_bank_transaction_code")
              .eq("id", payoutTx.id)
              .single()

            console.log("[v0] Verified payout after update:", verifyPayout)
          } else {
            console.log("[v0] No payout found before booking row")
          }
        }
      } else {
        console.log("[v0] No platform transactions found with confirmation code:", confirmationCode)
      }

      // 記錄手動對賬
      try {
        await supabase.from("reconciliation_matches").insert({
          bank_transaction_id: transactionId,
          platform_transaction_ids: platformTxs?.map((tx) => tx.id) || [],
          confirmation_codes: [confirmationCode],
          is_manual: true,
        })
      } catch (e) {
        console.log("[v0] Failed to insert reconciliation_matches:", e)
      }
    } else if (type === "platform") {
      // 平台報表手動填寫交易編碼
      if (!transactionCode) {
        return NextResponse.json({ error: "Missing transaction code" }, { status: 400 })
      }

      // 獲取平台交易的確認碼和類型
      const { data: platformTx } = await supabase
        .from("platform_transactions")
        .select("*")
        .eq("id", transactionId)
        .single()

      const platformRowIndex = getRowIndex(platformTx)

      if (platformTx?.type === "Payout") {
        await supabase
          .from("platform_transactions")
          .update({
            reconciliation_status: "reconciled",
            matched_bank_transaction_code: transactionCode,
            reconciled: true,
          })
          .eq("id", transactionId)

        const { data: batchTxs } = await supabase
          .from("platform_transactions")
          .select("*")
          .eq("batch_id", platformTx.batch_id)

        // 找到下一個 Payout 的 row_index
        const nextPayout = batchTxs
          ?.filter((t) => t.type === "Payout" && getRowIndex(t) > platformRowIndex)
          .sort((a, b) => getRowIndex(a) - getRowIndex(b))[0]

        const nextPayoutRowIndex = nextPayout ? getRowIndex(nextPayout) : Number.POSITIVE_INFINITY

        // 找到此 Payout 和下一個 Payout 之間的預訂行
        const relatedBookings =
          batchTxs?.filter(
            (t) => t.type !== "Payout" && getRowIndex(t) > platformRowIndex && getRowIndex(t) < nextPayoutRowIndex,
          ) || []

        // 更新這些預訂行
        for (const booking of relatedBookings) {
          await supabase
            .from("platform_transactions")
            .update({
              reconciliation_status: "reconciled",
              reconciled: true,
            })
            .eq("id", booking.id)
        }

        // 收集確認碼用於更新銀行交易
        const confirmationCodes = relatedBookings
          .map((b) => b.confirmation_code || b.raw_data?.["確認碼"])
          .filter((code): code is string => !!code)

        // 更新對應的銀行交易
        const { data: bankTxs } = await supabase
          .from("bank_transactions")
          .select("*")
          .eq("transaction_code", transactionCode)

        if (bankTxs && bankTxs.length > 0) {
          for (const bankTx of bankTxs) {
            const existingCodes = bankTx.matched_confirmation_codes || []
            const newCodes = [...new Set([...existingCodes, ...confirmationCodes])]

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
            platform_transaction_ids: [transactionId, ...relatedBookings.map((b) => b.id)],
            confirmation_codes: confirmationCodes,
            is_manual: true,
          })
        }
      } else {
        // 如果是預訂行被選中，找到對應的 Payout 行
        const { data: batchPayouts } = await supabase
          .from("platform_transactions")
          .select("*")
          .eq("batch_id", platformTx?.batch_id)
          .eq("type", "Payout")

        // 在 JavaScript 中找到最近的前一個 Payout
        const payoutTx = batchPayouts
          ?.filter((p) => getRowIndex(p) < platformRowIndex)
          .sort((a, b) => getRowIndex(b) - getRowIndex(a))[0]

        if (payoutTx) {
          // 更新 Payout 行的交易編碼
          await supabase
            .from("platform_transactions")
            .update({
              reconciliation_status: "reconciled",
              matched_bank_transaction_code: transactionCode,
              reconciled: true,
            })
            .eq("id", payoutTx.id)
        }

        // 更新當前預訂行的對賬狀態
        await supabase
          .from("platform_transactions")
          .update({
            reconciliation_status: "reconciled",
            reconciled: true,
          })
          .eq("id", transactionId)

        // 更新對應的銀行交易
        const { data: bankTxs } = await supabase
          .from("bank_transactions")
          .select("*")
          .eq("transaction_code", transactionCode)

        if (bankTxs && bankTxs.length > 0) {
          const confirmationCode = platformTx?.confirmation_code || platformTx?.raw_data?.["確認碼"]

          for (const bankTx of bankTxs) {
            const existingCodes = bankTx.matched_confirmation_codes || []
            const newCodes = confirmationCode ? [...new Set([...existingCodes, confirmationCode])] : existingCodes

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
            confirmation_codes: confirmationCode ? [confirmationCode] : [],
            is_manual: true,
          })
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Manual reconciliation error:", error)
    return NextResponse.json({ error: "手動對賬失敗" }, { status: 500 })
  }
}
