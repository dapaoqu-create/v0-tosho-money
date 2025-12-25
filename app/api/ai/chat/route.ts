import { generateText } from "ai"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()

    console.log("[v0] AI chat request received, messages count:", messages?.length)

    const supabase = await createClient()

    // 先獲取一些基本統計數據提供給 AI
    const { data: batches } = await supabase
      .from("csv_import_batches")
      .select("id, source_type, file_name, records_count")

    const bankBatches = (batches || []).filter((b: any) => b.source_type === "bank")
    const platformBatches = (batches || []).filter((b: any) => b.source_type === "platform")

    const { data: platformStats } = await supabase.from("platform_transactions").select("reconciliation_status, type")

    const payoutRows = (platformStats || []).filter((t: any) => t.type === "Payout")
    const reconciledPayouts = payoutRows.filter((t: any) => t.reconciliation_status === "reconciled")

    const { data: bankStats } = await supabase.from("bank_transactions").select("reconciliation_status, is_income")

    const incomeRows = (bankStats || []).filter((t: any) => t.is_income === true)
    const reconciledBank = incomeRows.filter((t: any) => t.reconciliation_status === "reconciled")

    const systemStats = {
      bankCsvCount: bankBatches.length,
      platformCsvCount: platformBatches.length,
      platformTransactions: {
        total: payoutRows.length,
        reconciled: reconciledPayouts.length,
        unreconciled: payoutRows.length - reconciledPayouts.length,
      },
      bankTransactions: {
        totalIncome: incomeRows.length,
        reconciled: reconciledBank.length,
        unreconciled: incomeRows.length - reconciledBank.length,
      },
    }

    const result = await generateText({
      model: "openai/gpt-4o-mini",
      system: `你是 TOSHO Money 系統的 AI 助手。

當前系統統計數據：
- 銀行 CSV 檔案數：${systemStats.bankCsvCount}
- 平台 CSV 檔案數：${systemStats.platformCsvCount}
- 平台交易（Payout）：總共 ${systemStats.platformTransactions.total} 筆，已對賬 ${systemStats.platformTransactions.reconciled} 筆，未對賬 ${systemStats.platformTransactions.unreconciled} 筆
- 銀行入金交易：總共 ${systemStats.bankTransactions.totalIncome} 筆，已對賬 ${systemStats.bankTransactions.reconciled} 筆，未對賬 ${systemStats.bankTransactions.unreconciled} 筆

你可以幫助用戶：
1. 回答關於系統統計的問題
2. 提供系統使用指導
3. 解釋對賬流程

請用用戶使用的語言回覆。回答要簡潔明瞭。`,
      messages,
    })

    console.log("[v0] AI result text:", result.text?.substring(0, 100))

    return Response.json({
      content: result.text || "抱歉，無法生成回應。",
      toolInvocations: [],
    })
  } catch (error) {
    console.error("[v0] AI chat API error:", error)
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}
