import { generateText, tool } from "ai"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()

    console.log("[v0] AI chat request received, messages count:", messages?.length)

    const supabase = await createClient()

    const result = await generateText({
      model: "google/gemini-2.0-flash",
      system: `你是 TOSHO Money 系統的 AI 助手。你可以幫助用戶：
1. 搜尋交易記錄（確認碼、收款金額）
2. 查詢對賬狀態和統計
3. 查看匯入的 CSV 檔案清單
4. 查詢銀行和平台交易明細
5. 執行手動對賬（填入確認碼或交易編碼）
6. 更新交易狀態
7. 刪除 CSV 批次
8. 提供系統使用指導

你擁有資料管理權限，可以幫助用戶修改和管理資料。
請用用戶使用的語言回覆。當執行查詢時，請清晰地展示結果。
執行修改操作前，請先確認用戶的意圖。
如果用戶問的問題不在你的能力範圍內，請禮貌地說明並建議他們使用系統的其他功能。`,
      messages,
      maxSteps: 5,
      tools: {
        // 獲取統計資料
        getStatistics: tool({
          description: "獲取系統統計資料，包括匯入檔案數、交易筆數、對賬狀態等",
          parameters: z.object({}),
          execute: async () => {
            console.log("[v0] getStatistics called")

            const { data: batches } = await supabase
              .from("csv_import_batches")
              .select("id, source_type, file_name, records_count")

            const bankBatches = (batches || []).filter((b: any) => b.source_type === "bank")
            const platformBatches = (batches || []).filter((b: any) => b.source_type === "platform")

            const { data: platformStats } = await supabase
              .from("platform_transactions")
              .select("reconciliation_status, type")

            const payoutRows = (platformStats || []).filter((t: any) => t.type === "Payout")
            const reconciledPayouts = payoutRows.filter((t: any) => t.reconciliation_status === "reconciled")

            const { data: bankStats } = await supabase
              .from("bank_transactions")
              .select("reconciliation_status, is_income")

            const incomeRows = (bankStats || []).filter((t: any) => t.is_income === true)
            const reconciledBank = incomeRows.filter((t: any) => t.reconciliation_status === "reconciled")

            return {
              bankCsvCount: bankBatches.length,
              platformCsvCount: platformBatches.length,
              platformTransactions: {
                total: payoutRows.length,
                reconciled: reconciledPayouts.length,
                unreconciled: payoutRows.length - reconciledPayouts.length,
                rate: payoutRows.length > 0 ? Math.round((reconciledPayouts.length / payoutRows.length) * 100) : 0,
              },
              bankTransactions: {
                totalIncome: incomeRows.length,
                reconciled: reconciledBank.length,
                unreconciled: incomeRows.length - reconciledBank.length,
                rate: incomeRows.length > 0 ? Math.round((reconciledBank.length / incomeRows.length) * 100) : 0,
              },
            }
          },
        }),

        // 搜尋平台交易
        searchTransactions: tool({
          description: "搜尋平台交易記錄，可以用確認碼或收款金額搜尋",
          parameters: z.object({
            query: z.string().describe("搜尋關鍵字（確認碼或收款金額）"),
          }),
          execute: async ({ query }) => {
            console.log("[v0] searchTransactions called with query:", query)

            const { data, error } = await supabase
              .from("platform_transactions")
              .select(`
                id, type, confirmation_code, payout_amount, reconciliation_status,
                matched_bank_transaction_code, raw_data,
                csv_import_batches!inner (id, file_name, platform_name)
              `)
              .or(
                `confirmation_code.ilike.%${query}%,raw_data->>確認碼.ilike.%${query}%,raw_data->>收款.ilike.%${query}%`,
              )
              .limit(10)

            if (error) {
              console.log("[v0] searchTransactions error:", error)
              return { error: error.message }
            }

            const results = (data || []).map((tx: any) => ({
              id: tx.id,
              type: tx.type,
              confirmationCode: tx.confirmation_code || tx.raw_data?.["確認碼"] || "-",
              payoutAmount: tx.raw_data?.["收款"] || tx.payout_amount || "-",
              status: tx.reconciliation_status === "reconciled" ? "已對賬" : "未對賬",
              transactionCode: tx.matched_bank_transaction_code || "-",
              fileName: tx.csv_import_batches?.file_name || "-",
              batchId: tx.csv_import_batches?.id,
              rowIndex: tx.raw_data?.["_row_index"],
            }))

            return { count: results.length, results }
          },
        }),

        // 獲取 CSV 清單
        getCsvList: tool({
          description: "獲取已匯入的 CSV 檔案清單",
          parameters: z.object({
            type: z.enum(["all", "bank", "platform"]).describe("篩選類型：all=全部, bank=銀行, platform=平台"),
          }),
          execute: async ({ type }) => {
            console.log("[v0] getCsvList called with type:", type)

            let query = supabase
              .from("csv_import_batches")
              .select(
                "id, file_name, source_type, platform_name, bank_code, records_count, created_at, completion_status",
              )
              .order("created_at", { ascending: false })

            if (type === "bank") {
              query = query.eq("source_type", "bank")
            } else if (type === "platform") {
              query = query.eq("source_type", "platform")
            }

            const { data, error } = await query.limit(20)

            if (error) {
              console.log("[v0] getCsvList error:", error)
              return { error: error.message }
            }

            return {
              count: (data || []).length,
              files: (data || []).map((b: any) => ({
                id: b.id,
                fileName: b.file_name,
                type: b.source_type === "bank" ? "銀行" : "平台",
                source: b.platform_name || b.bank_code || "-",
                recordsCount: b.records_count,
                status: b.completion_status === "completed" ? "對賬完成" : "未完成",
                createdAt: b.created_at,
              })),
            }
          },
        }),

        // 查詢收入統計
        getIncomeStatistics: tool({
          description: "查詢指定年份或月份的收入統計",
          parameters: z.object({
            year: z.number().describe("年份，如 2025"),
            month: z.number().optional().describe("月份（可選），1-12"),
          }),
          execute: async ({ year, month }) => {
            console.log("[v0] getIncomeStatistics called with year:", year, "month:", month)

            // 查詢平台交易的收款金額
            const { data: platformTx } = await supabase
              .from("platform_transactions")
              .select("raw_data, type, reconciliation_status")
              .eq("type", "Payout")

            let totalIncome = 0
            let reconciledIncome = 0
            let count = 0

            for (const tx of platformTx || []) {
              // 從日期欄位解析年月
              const dateStr = tx.raw_data?.["日期"] || ""
              const txYear = Number.parseInt(dateStr.substring(0, 4))
              const txMonth = Number.parseInt(dateStr.substring(5, 7))

              const amountStr = tx.raw_data?.["收款"] || "0"
              const amount = Number.parseFloat(amountStr.replace(/[,￥¥]/g, "")) || 0

              if (txYear === year && (!month || txMonth === month)) {
                totalIncome += amount
                count++
                if (tx.reconciliation_status === "reconciled") {
                  reconciledIncome += amount
                }
              }
            }

            return {
              year,
              month: month || "全年",
              totalIncome: Math.round(totalIncome),
              reconciledIncome: Math.round(reconciledIncome),
              unreconciledIncome: Math.round(totalIncome - reconciledIncome),
              transactionCount: count,
            }
          },
        }),

        // 產生頁面導航連結
        navigateTo: tool({
          description: "產生系統頁面的導航連結",
          parameters: z.object({
            page: z
              .enum(["dashboard", "platform-transactions", "bank-transactions", "reconciliation", "settings"])
              .describe("要導航的頁面"),
          }),
          execute: async ({ page }) => {
            const pages: Record<string, { url: string; description: string }> = {
              dashboard: { url: "/dashboard", description: "儀表板首頁" },
              "platform-transactions": { url: "/dashboard/transactions/platform", description: "平台交易清單" },
              "bank-transactions": { url: "/dashboard/transactions/bank", description: "銀行交易清單" },
              reconciliation: { url: "/dashboard/reconciliation", description: "對賬管理" },
              settings: { url: "/dashboard/settings", description: "系統設定" },
            }
            return pages[page] || { url: "/dashboard", description: "儀表板" }
          },
        }),
      },
    })

    console.log("[v0] AI result:", {
      text: result.text?.substring(0, 100),
      toolCallsCount: result.toolCalls?.length,
      toolResultsCount: result.toolResults?.length,
    })

    // 構建回應，包含工具調用結果
    const toolInvocations =
      result.toolResults?.map((tr, i) => ({
        toolName: result.toolCalls?.[i]?.toolName || "unknown",
        state: "result",
        result: tr.result,
      })) || []

    return Response.json({
      content: result.text || "",
      toolInvocations,
    })
  } catch (error) {
    console.error("[v0] AI chat API error:", error)
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}
