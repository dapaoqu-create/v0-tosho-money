import { generateText, tool } from "ai"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()
    const supabase = await createClient()

    const result = await generateText({
      model: "openai/gpt-4o-mini",
      system: `你是 TOSHO Money 系統的 AI 助手。你可以幫助用戶：
1. 搜尋交易記錄（確認碼、收款金額）
2. 查詢對賬狀態和統計
3. 查看匯入的 CSV 檔案清單
4. 查詢銀行和平台交易明細
5. 提供系統使用指導

請用用戶使用的語言回覆。當執行查詢時，請清晰地展示結果。
如果用戶問的問題不在你的能力範圍內，請禮貌地說明並建議他們使用系統的其他功能。`,
      messages,
      tools: {
        // 搜尋平台交易
        searchTransactions: tool({
          description: "搜尋平台交易記錄，可以用確認碼或收款金額搜尋",
          parameters: z.object({
            query: z.string().describe("搜尋關鍵字（確認碼或收款金額）"),
          }),
          execute: async ({ query }) => {
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

            if (error) return { error: error.message }

            const results = (data || []).map((tx: any) => ({
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

        // 獲取統計資料
        getStatistics: tool({
          description: "獲取系統統計資料，包括匯入檔案數、交易筆數、對賬狀態等",
          parameters: z.object({}),
          execute: async () => {
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

        // 獲取 CSV 清單
        getCsvList: tool({
          description: "獲取已匯入的 CSV 檔案清單",
          parameters: z.object({
            type: z.enum(["all", "bank", "platform"]).describe("篩選類型：all=全部, bank=銀行, platform=平台"),
          }),
          execute: async ({ type }) => {
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

            if (error) return { error: error.message }

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

        // 查詢特定 CSV 的交易明細
        getCsvDetails: tool({
          description: "查詢特定 CSV 檔案的交易明細",
          parameters: z.object({
            fileName: z.string().describe("CSV 檔案名稱（部分名稱即可）"),
            limit: z.number().optional().describe("返回筆數限制，預設 10"),
          }),
          execute: async ({ fileName, limit = 10 }) => {
            const { data: batches } = await supabase
              .from("csv_import_batches")
              .select("id, file_name, source_type")
              .ilike("file_name", `%${fileName}%`)
              .limit(1)

            if (!batches || batches.length === 0) {
              return { error: `找不到包含 "${fileName}" 的 CSV 檔案` }
            }

            const batch = batches[0]

            if (batch.source_type === "platform") {
              const { data: transactions } = await supabase
                .from("platform_transactions")
                .select("type, confirmation_code, raw_data, reconciliation_status, matched_bank_transaction_code")
                .eq("batch_id", batch.id)
                .order("raw_data->_row_index", { ascending: true })
                .limit(limit)

              return {
                fileName: batch.file_name,
                type: "平台",
                transactions: (transactions || []).map((t: any) => ({
                  type: t.type,
                  confirmationCode: t.confirmation_code || t.raw_data?.["確認碼"] || "-",
                  amount: t.raw_data?.["收款"] || "-",
                  status: t.reconciliation_status === "reconciled" ? "已對賬" : "未對賬",
                  transactionCode: t.matched_bank_transaction_code || "-",
                })),
              }
            } else {
              const { data: transactions } = await supabase
                .from("bank_transactions")
                .select("transaction_code, raw_data, reconciliation_status, matched_confirmation_codes")
                .eq("batch_id", batch.id)
                .limit(limit)

              return {
                fileName: batch.file_name,
                type: "銀行",
                transactions: (transactions || []).map((t: any) => ({
                  transactionCode: t.transaction_code,
                  date: t.raw_data?.["取引日"] || "-",
                  amount: t.raw_data?.["入出金(円)"] || "-",
                  status: t.reconciliation_status === "reconciled" ? "已對賬" : "未對賬",
                  confirmationCodes: t.matched_confirmation_codes?.join(", ") || "-",
                })),
              }
            }
          },
        }),

        // 查詢未對賬交易
        getUnreconciledTransactions: tool({
          description: "查詢未對賬的交易記錄",
          parameters: z.object({
            type: z.enum(["bank", "platform"]).describe("交易類型：bank=銀行入金, platform=平台 Payout"),
            limit: z.number().optional().describe("返回筆數限制，預設 10"),
          }),
          execute: async ({ type, limit = 10 }) => {
            if (type === "platform") {
              const { data } = await supabase
                .from("platform_transactions")
                .select(`
                  type, confirmation_code, raw_data,
                  csv_import_batches!inner (file_name)
                `)
                .eq("type", "Payout")
                .eq("reconciliation_status", "unreconciled")
                .limit(limit)

              return {
                type: "平台 Payout",
                count: (data || []).length,
                transactions: (data || []).map((t: any) => ({
                  fileName: t.csv_import_batches?.file_name || "-",
                  amount: t.raw_data?.["收款"] || "-",
                  date: t.raw_data?.["日期"] || "-",
                })),
              }
            } else {
              const { data } = await supabase
                .from("bank_transactions")
                .select(`
                  transaction_code, raw_data,
                  csv_import_batches!inner (file_name)
                `)
                .eq("is_income", true)
                .eq("reconciliation_status", "unreconciled")
                .limit(limit)

              return {
                type: "銀行入金",
                count: (data || []).length,
                transactions: (data || []).map((t: any) => ({
                  fileName: t.csv_import_batches?.file_name || "-",
                  transactionCode: t.transaction_code,
                  amount: t.raw_data?.["入出金(円)"] || "-",
                  date: t.raw_data?.["取引日"] || "-",
                })),
              }
            }
          },
        }),

        // 導航到特定頁面
        navigateTo: tool({
          description: "產生系統頁面的連結，讓用戶可以快速導航",
          parameters: z.object({
            page: z
              .enum(["dashboard", "bank-transactions", "platform-transactions", "reconciliation", "memos", "settings"])
              .describe("要導航的頁面"),
            batchId: z.string().optional().describe("如果是交易頁面，可以指定批次 ID"),
            highlight: z.string().optional().describe("要高亮的確認碼"),
            row: z.number().optional().describe("要高亮的行索引"),
          }),
          execute: async ({ page, batchId, highlight, row }) => {
            let url = `/dashboard`

            switch (page) {
              case "dashboard":
                url = "/dashboard"
                break
              case "bank-transactions":
                url = batchId ? `/dashboard/transactions/bank/${batchId}` : "/dashboard/transactions/bank"
                break
              case "platform-transactions":
                url = batchId ? `/dashboard/transactions/platform/${batchId}` : "/dashboard/transactions/platform"
                if (highlight || row) {
                  const params = new URLSearchParams()
                  if (highlight) params.set("highlight", highlight)
                  if (row) params.set("row", row.toString())
                  url += `?${params.toString()}`
                }
                break
              case "reconciliation":
                url = "/dashboard/reconciliation"
                break
              case "memos":
                url = "/dashboard/memos"
                break
              case "settings":
                url = "/dashboard/settings"
                break
            }

            return { url, description: `點擊前往: ${page}` }
          },
        }),
      },
      maxSteps: 5,
    })

    return Response.json({
      content: result.text,
      toolInvocations: result.steps.flatMap((step) =>
        step.toolCalls.map((tc, i) => ({
          toolName: tc.toolName,
          args: tc.args,
          state: "result",
          result: step.toolResults[i]?.result,
        })),
      ),
    })
  } catch (error) {
    console.error("[v0] AI Chat API Error:", error)
    return Response.json({ error: "AI 服務暫時無法使用，請稍後再試" }, { status: 500 })
  }
}
