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
      const isClearing = !confirmationCode || confirmationCode.trim() === ""

      // 獲取銀行交易
      const { data: bankTx, error: bankError } = await supabase
        .from("bank_transactions")
        .select("*")
        .eq("id", transactionId)
        .single()

      if (!bankTx) {
        return NextResponse.json({ error: "Bank transaction not found" }, { status: 404 })
      }

      const bankTransactionCode = bankTx.transaction_code
      const previousCodes = bankTx.matched_confirmation_codes || []

      if (isClearing) {
        await supabase
          .from("bank_transactions")
          .update({
            reconciliation_status: "unreconciled",
            matched_confirmation_codes: [],
            reconciled: false,
          })
          .eq("id", transactionId)

        for (const prevCode of previousCodes) {
          // 查找之前關聯的平台交易
          const { data: prevPlatformTxs } = await supabase
            .from("platform_transactions")
            .select("*")
            .or(`confirmation_code.eq.${prevCode},raw_data->>確認碼.eq.${prevCode}`)

          for (const prevTx of prevPlatformTxs || []) {
            // 重置預訂行狀態
            await supabase
              .from("platform_transactions")
              .update({
                reconciliation_status: "unreconciled",
                reconciled: false,
              })
              .eq("id", prevTx.id)

            // 找到對應的 Payout 行並清除交易編碼
            const { data: batchPayouts } = await supabase
              .from("platform_transactions")
              .select("*")
              .eq("batch_id", prevTx.batch_id)
              .eq("type", "Payout")

            const prevRowIndex = getRowIndex(prevTx)
            const payoutTx = batchPayouts
              ?.filter((p) => getRowIndex(p) < prevRowIndex)
              .sort((a, b) => getRowIndex(b) - getRowIndex(a))[0]

            if (payoutTx && payoutTx.matched_bank_transaction_code === bankTransactionCode) {
              await supabase
                .from("platform_transactions")
                .update({
                  reconciliation_status: "unreconciled",
                  matched_bank_transaction_code: null,
                  reconciled: false,
                })
                .eq("id", payoutTx.id)
            }
          }
        }

        return NextResponse.json({ success: true, cleared: true })
      }

      // 正常填寫確認碼的邏輯
      // 更新銀行交易
      await supabase
        .from("bank_transactions")
        .update({
          reconciliation_status: "reconciled",
          matched_confirmation_codes: [confirmationCode],
          reconciled: true,
        })
        .eq("id", transactionId)

      // 查詢平台交易
      const { data: platformTxsByCode } = await supabase
        .from("platform_transactions")
        .select("*")
        .eq("confirmation_code", confirmationCode)

      let platformTxs = platformTxsByCode || []

      if (platformTxs.length === 0) {
        const { data: batches } = await supabase
          .from("csv_import_batches")
          .select("batch_id")
          .eq("source_type", "platform")

        for (const batch of batches || []) {
          const { data: batchTxs } = await supabase
            .from("platform_transactions")
            .select("*")
            .eq("batch_id", batch.batch_id)

          const matchedTxs =
            batchTxs?.filter(
              (tx) =>
                tx.raw_data?.["確認碼"] === confirmationCode || tx.raw_data?.["Confirmation Code"] === confirmationCode,
            ) || []

          if (matchedTxs.length > 0) {
            platformTxs = matchedTxs
            break
          }
        }
      }

      if (platformTxs.length > 0) {
        for (const platformTx of platformTxs) {
          const platformRowIndex = getRowIndex(platformTx)

          await supabase
            .from("platform_transactions")
            .update({
              reconciliation_status: "reconciled",
              reconciled: true,
            })
            .eq("id", platformTx.id)

          const { data: batchPayouts } = await supabase
            .from("platform_transactions")
            .select("*")
            .eq("batch_id", platformTx.batch_id)
            .eq("type", "Payout")

          const filteredPayouts = batchPayouts?.filter((p) => getRowIndex(p) < platformRowIndex) || []
          const sortedPayouts = filteredPayouts.sort((a, b) => getRowIndex(b) - getRowIndex(a))
          const payoutTx = sortedPayouts[0]

          if (payoutTx) {
            await supabase
              .from("platform_transactions")
              .update({
                reconciliation_status: "reconciled",
                matched_bank_transaction_code: bankTransactionCode,
                reconciled: true,
              })
              .eq("id", payoutTx.id)
          }
        }
      }

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
      const isClearing = !transactionCode || transactionCode.trim() === ""

      const { data: platformTx } = await supabase
        .from("platform_transactions")
        .select("*")
        .eq("id", transactionId)
        .single()

      if (!platformTx) {
        return NextResponse.json({ error: "Platform transaction not found" }, { status: 404 })
      }

      const platformRowIndex = getRowIndex(platformTx)
      const previousCode = platformTx.matched_bank_transaction_code

      if (isClearing) {
        if (platformTx?.type === "Payout") {
          // 清除 Payout 行
          await supabase
            .from("platform_transactions")
            .update({
              reconciliation_status: "unreconciled",
              matched_bank_transaction_code: null,
              reconciled: false,
            })
            .eq("id", transactionId)

          // 找到關聯的預訂行並清除
          const { data: batchTxs } = await supabase
            .from("platform_transactions")
            .select("*")
            .eq("batch_id", platformTx.batch_id)

          const nextPayout = batchTxs
            ?.filter((t) => t.type === "Payout" && getRowIndex(t) > platformRowIndex)
            .sort((a, b) => getRowIndex(a) - getRowIndex(b))[0]

          const nextPayoutRowIndex = nextPayout ? getRowIndex(nextPayout) : Number.POSITIVE_INFINITY

          const relatedBookings =
            batchTxs?.filter(
              (t) => t.type !== "Payout" && getRowIndex(t) > platformRowIndex && getRowIndex(t) < nextPayoutRowIndex,
            ) || []

          for (const booking of relatedBookings) {
            await supabase
              .from("platform_transactions")
              .update({
                reconciliation_status: "unreconciled",
                reconciled: false,
              })
              .eq("id", booking.id)
          }

          // 清除銀行交易的關聯
          if (previousCode) {
            const confirmationCodes = relatedBookings
              .map((b) => b.confirmation_code || b.raw_data?.["確認碼"])
              .filter((code): code is string => !!code)

            const { data: bankTxs } = await supabase
              .from("bank_transactions")
              .select("*")
              .eq("transaction_code", previousCode)

            for (const bankTx of bankTxs || []) {
              const existingCodes = bankTx.matched_confirmation_codes || []
              const newCodes = existingCodes.filter((c: string) => !confirmationCodes.includes(c))

              await supabase
                .from("bank_transactions")
                .update({
                  reconciliation_status: newCodes.length > 0 ? "reconciled" : "unreconciled",
                  matched_confirmation_codes: newCodes,
                  reconciled: newCodes.length > 0,
                })
                .eq("id", bankTx.id)
            }
          }
        } else {
          // 清除預訂行關聯
          await supabase
            .from("platform_transactions")
            .update({
              reconciliation_status: "unreconciled",
              reconciled: false,
            })
            .eq("id", transactionId)

          // 找到對應的 Payout 並清除
          const { data: batchPayouts } = await supabase
            .from("platform_transactions")
            .select("*")
            .eq("batch_id", platformTx?.batch_id)
            .eq("type", "Payout")

          const payoutTx = batchPayouts
            ?.filter((p) => getRowIndex(p) < platformRowIndex)
            .sort((a, b) => getRowIndex(b) - getRowIndex(a))[0]

          if (payoutTx) {
            await supabase
              .from("platform_transactions")
              .update({
                reconciliation_status: "unreconciled",
                matched_bank_transaction_code: null,
                reconciled: false,
              })
              .eq("id", payoutTx.id)
          }
        }

        return NextResponse.json({ success: true, cleared: true })
      }

      // 正常填寫交易編碼的邏輯
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

        const nextPayout = batchTxs
          ?.filter((t) => t.type === "Payout" && getRowIndex(t) > platformRowIndex)
          .sort((a, b) => getRowIndex(a) - getRowIndex(b))[0]

        const nextPayoutRowIndex = nextPayout ? getRowIndex(nextPayout) : Number.POSITIVE_INFINITY

        const relatedBookings =
          batchTxs?.filter(
            (t) => t.type !== "Payout" && getRowIndex(t) > platformRowIndex && getRowIndex(t) < nextPayoutRowIndex,
          ) || []

        for (const booking of relatedBookings) {
          await supabase
            .from("platform_transactions")
            .update({
              reconciliation_status: "reconciled",
              reconciled: true,
            })
            .eq("id", booking.id)
        }

        const confirmationCodes = relatedBookings
          .map((b) => b.confirmation_code || b.raw_data?.["確認碼"])
          .filter((code): code is string => !!code)

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

          await supabase.from("reconciliation_matches").insert({
            bank_transaction_id: bankTxs[0].id,
            platform_transaction_ids: [transactionId, ...relatedBookings.map((b) => b.id)],
            confirmation_codes: confirmationCodes,
            is_manual: true,
          })
        }
      } else {
        const { data: batchPayouts } = await supabase
          .from("platform_transactions")
          .select("*")
          .eq("batch_id", platformTx?.batch_id)
          .eq("type", "Payout")

        const payoutTx = batchPayouts
          ?.filter((p) => getRowIndex(p) < platformRowIndex)
          .sort((a, b) => getRowIndex(b) - getRowIndex(a))[0]

        if (payoutTx) {
          await supabase
            .from("platform_transactions")
            .update({
              reconciliation_status: "reconciled",
              matched_bank_transaction_code: transactionCode,
              reconciled: true,
            })
            .eq("id", payoutTx.id)
        }

        await supabase
          .from("platform_transactions")
          .update({
            reconciliation_status: "reconciled",
            reconciled: true,
          })
          .eq("id", transactionId)

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
