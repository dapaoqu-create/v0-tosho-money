import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const { mode, platformId, bankId } = await request.json()
    const supabase = await createClient()

    if (mode === "manual" && platformId && bankId) {
      // Manual reconciliation
      await supabase
        .from("platform_transactions")
        .update({ reconciled: true, reconciled_with: bankId })
        .eq("id", platformId)

      await supabase
        .from("bank_transactions")
        .update({ reconciled: true, reconciled_with: platformId })
        .eq("id", bankId)

      return NextResponse.json({ success: true, matched: 1 })
    }

    if (mode === "auto") {
      // Auto reconciliation
      const { data: platformPayouts } = await supabase
        .from("platform_transactions")
        .select("*")
        .eq("type", "Payout")
        .eq("reconciled", false)

      const { data: bankIncome } = await supabase
        .from("bank_transactions")
        .select("*")
        .gt("amount", 0)
        .eq("reconciled", false)

      if (!platformPayouts || !bankIncome) {
        return NextResponse.json({ success: true, matched: 0 })
      }

      let matchCount = 0
      const usedBankIds = new Set<string>()

      for (const payout of platformPayouts) {
        const payoutAmount = Math.round(payout.payout_amount || 0)
        const payoutDate = new Date(payout.payout_date || payout.transaction_date)

        for (const bank of bankIncome) {
          if (usedBankIds.has(bank.id)) continue

          const bankAmount = Math.round(bank.amount)
          const bankDate = new Date(bank.transaction_date)
          const daysDiff = Math.abs(payoutDate.getTime() - bankDate.getTime()) / (1000 * 60 * 60 * 24)

          // Match if amount is exactly the same and date is within 5 days
          if (payoutAmount === bankAmount && daysDiff <= 5) {
            await supabase
              .from("platform_transactions")
              .update({ reconciled: true, reconciled_with: bank.id })
              .eq("id", payout.id)

            await supabase
              .from("bank_transactions")
              .update({ reconciled: true, reconciled_with: payout.id })
              .eq("id", bank.id)

            usedBankIds.add(bank.id)
            matchCount++
            break
          }
        }
      }

      return NextResponse.json({ success: true, matched: matchCount })
    }

    return NextResponse.json({ error: "Invalid mode" }, { status: 400 })
  } catch (error) {
    console.error("Reconciliation error:", error)
    return NextResponse.json({ error: "対帳処理中にエラーが発生しました" }, { status: 500 })
  }
}
