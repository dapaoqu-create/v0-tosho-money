import { generateText, tool } from "ai"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()
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

        // 搜尋銀行交易
        searchBankTransactions: tool({
          description: "搜尋銀行交易記錄，可以用交易編碼或金額搜尋",
          parameters: z.object({
            query: z.string().describe("搜尋關鍵字（交易編碼或金額）"),
          }),
          execute: async ({ query }) => {
            const { data, error } = await supabase
              .from("bank_transactions")
              .select(`
                id, transaction_code, reconciliation_status, is_income,
                matched_confirmation_codes, raw_data,
                csv_import_batches!inner (id, file_name, bank_code)
              `)
              .or(`transaction_code.ilike.%${query}%,raw_data->>入出金(円).ilike.%${query}%`)
              .limit(10)

            if (error) return { error: error.message }

            const results = (data || []).map((tx: any) => ({
              id: tx.id,
              transactionCode: tx.transaction_code,
              amount: tx.raw_data?.["入出金(円)"] || "-",
              date: tx.raw_data?.["取引日"] || "-",
              isIncome: tx.is_income,
              status: tx.reconciliation_status === "reconciled" ? "已對賬" : "未對賬",
              confirmationCodes: tx.matched_confirmation_codes?.join(", ") || "-",
              fileName: tx.csv_import_batches?.file_name || "-",
              batchId: tx.csv_import_batches?.id,
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
                .select("id, type, confirmation_code, raw_data, reconciliation_status, matched_bank_transaction_code")
                .eq("batch_id", batch.id)
                .order("raw_data->_row_index", { ascending: true })
                .limit(limit)

              return {
                batchId: batch.id,
                fileName: batch.file_name,
                type: "平台",
                transactions: (transactions || []).map((t: any) => ({
                  id: t.id,
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
                .select("id, transaction_code, raw_data, reconciliation_status, matched_confirmation_codes")
                .eq("batch_id", batch.id)
                .limit(limit)

              return {
                batchId: batch.id,
                fileName: batch.file_name,
                type: "銀行",
                transactions: (transactions || []).map((t: any) => ({
                  id: t.id,
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
                  id, type, confirmation_code, raw_data,
                  csv_import_batches!inner (id, file_name)
                `)
                .eq("type", "Payout")
                .eq("reconciliation_status", "unreconciled")
                .limit(limit)

              return {
                type: "平台 Payout",
                count: (data || []).length,
                transactions: (data || []).map((t: any) => ({
                  id: t.id,
                  fileName: t.csv_import_batches?.file_name || "-",
                  batchId: t.csv_import_batches?.id,
                  amount: t.raw_data?.["收款"] || "-",
                  date: t.raw_data?.["日期"] || "-",
                })),
              }
            } else {
              const { data } = await supabase
                .from("bank_transactions")
                .select(`
                  id, transaction_code, raw_data,
                  csv_import_batches!inner (id, file_name)
                `)
                .eq("is_income", true)
                .eq("reconciliation_status", "unreconciled")
                .limit(limit)

              return {
                type: "銀行入金",
                count: (data || []).length,
                transactions: (data || []).map((t: any) => ({
                  id: t.id,
                  fileName: t.csv_import_batches?.file_name || "-",
                  batchId: t.csv_import_batches?.id,
                  transactionCode: t.transaction_code,
                  amount: t.raw_data?.["入出金(円)"] || "-",
                  date: t.raw_data?.["取引日"] || "-",
                })),
              }
            }
          },
        }),

        updateBankConfirmationCodes: tool({
          description: "手動對賬：為銀行交易添加確認碼，這會同時更新對應的平台交易狀態",
          parameters: z.object({
            bankTransactionId: z.string().describe("銀行交易 ID"),
            confirmationCodes: z.array(z.string()).describe("要添加的確認碼列表"),
          }),
          execute: async ({ bankTransactionId, confirmationCodes }) => {
            // 獲取銀行交易
            const { data: bankTx, error: fetchError } = await supabase
              .from("bank_transactions")
              .select("id, transaction_code, matched_confirmation_codes")
              .eq("id", bankTransactionId)
              .single()

            if (fetchError || !bankTx) {
              return { error: "找不到指定的銀行交易" }
            }

            // 合併現有和新的確認碼
            const existingCodes = bankTx.matched_confirmation_codes || []
            const allCodes = [...new Set([...existingCodes, ...confirmationCodes])]

            // 更新銀行交易
            const { error: updateError } = await supabase
              .from("bank_transactions")
              .update({
                matched_confirmation_codes: allCodes,
                reconciliation_status: "reconciled",
              })
              .eq("id", bankTransactionId)

            if (updateError) {
              return { error: `更新銀行交易失敗: ${updateError.message}` }
            }

            // 更新對應的平台交易
            for (const code of confirmationCodes) {
              await supabase
                .from("platform_transactions")
                .update({
                  reconciliation_status: "reconciled",
                  matched_bank_transaction_code: bankTx.transaction_code,
                })
                .or(`confirmation_code.eq.${code},raw_data->>確認碼.eq.${code}`)
            }

            return {
              success: true,
              message: `已成功添加 ${confirmationCodes.length} 個確認碼到銀行交易`,
              transactionCode: bankTx.transaction_code,
              confirmationCodes: allCodes,
            }
          },
        }),

        updatePlatformTransactionCode: tool({
          description: "手動對賬：為平台交易（Payout 行）添加銀行交易編碼",
          parameters: z.object({
            confirmationCode: z.string().describe("確認碼"),
            bankTransactionCode: z.string().describe("銀行交易編碼"),
          }),
          execute: async ({ confirmationCode, bankTransactionCode }) => {
            // 更新平台交易
            const { data: updated, error: updateError } = await supabase
              .from("platform_transactions")
              .update({
                reconciliation_status: "reconciled",
                matched_bank_transaction_code: bankTransactionCode,
              })
              .or(`confirmation_code.eq.${confirmationCode},raw_data->>確認碼.eq.${confirmationCode}`)
              .select("id")

            if (updateError) {
              return { error: `更新平台交易失敗: ${updateError.message}` }
            }

            // 更新銀行交易
            const { data: bankTx } = await supabase
              .from("bank_transactions")
              .select("id, matched_confirmation_codes")
              .eq("transaction_code", bankTransactionCode)
              .single()

            if (bankTx) {
              const existingCodes = bankTx.matched_confirmation_codes || []
              if (!existingCodes.includes(confirmationCode)) {
                await supabase
                  .from("bank_transactions")
                  .update({
                    matched_confirmation_codes: [...existingCodes, confirmationCode],
                    reconciliation_status: "reconciled",
                  })
                  .eq("id", bankTx.id)
              }
            }

            return {
              success: true,
              message: `已成功將確認碼 ${confirmationCode} 與交易編碼 ${bankTransactionCode} 對賬`,
              updatedCount: (updated || []).length,
            }
          },
        }),

        cancelReconciliation: tool({
          description: "取消對賬：將已對賬的交易恢復為未對賬狀態",
          parameters: z.object({
            type: z.enum(["bank", "platform"]).describe("交易類型"),
            transactionId: z.string().describe("交易 ID"),
          }),
          execute: async ({ type, transactionId }) => {
            if (type === "bank") {
              // 獲取銀行交易的確認碼
              const { data: bankTx } = await supabase
                .from("bank_transactions")
                .select("transaction_code, matched_confirmation_codes")
                .eq("id", transactionId)
                .single()

              if (!bankTx) {
                return { error: "找不到指定的銀行交易" }
              }

              // 清除銀行交易的對賬狀態
              await supabase
                .from("bank_transactions")
                .update({
                  matched_confirmation_codes: [],
                  reconciliation_status: "unreconciled",
                })
                .eq("id", transactionId)

              // 清除相關平台交易的對賬狀態
              if (bankTx.matched_confirmation_codes?.length > 0) {
                for (const code of bankTx.matched_confirmation_codes) {
                  await supabase
                    .from("platform_transactions")
                    .update({
                      reconciliation_status: "unreconciled",
                      matched_bank_transaction_code: null,
                    })
                    .or(`confirmation_code.eq.${code},raw_data->>確認碼.eq.${code}`)
                }
              }

              return {
                success: true,
                message: `已取消銀行交易 ${bankTx.transaction_code} 的對賬`,
              }
            } else {
              // 獲取平台交易
              const { data: platformTx } = await supabase
                .from("platform_transactions")
                .select("confirmation_code, raw_data, matched_bank_transaction_code")
                .eq("id", transactionId)
                .single()

              if (!platformTx) {
                return { error: "找不到指定的平台交易" }
              }

              const confirmCode = platformTx.confirmation_code || platformTx.raw_data?.["確認碼"]

              // 清除平台交易的對賬狀態
              await supabase
                .from("platform_transactions")
                .update({
                  reconciliation_status: "unreconciled",
                  matched_bank_transaction_code: null,
                })
                .eq("id", transactionId)

              // 從銀行交易中移除此確認碼
              if (platformTx.matched_bank_transaction_code && confirmCode) {
                const { data: bankTx } = await supabase
                  .from("bank_transactions")
                  .select("id, matched_confirmation_codes")
                  .eq("transaction_code", platformTx.matched_bank_transaction_code)
                  .single()

                if (bankTx) {
                  const newCodes = (bankTx.matched_confirmation_codes || []).filter((c: string) => c !== confirmCode)
                  await supabase
                    .from("bank_transactions")
                    .update({
                      matched_confirmation_codes: newCodes,
                      reconciliation_status: newCodes.length > 0 ? "reconciled" : "unreconciled",
                    })
                    .eq("id", bankTx.id)
                }
              }

              return {
                success: true,
                message: `已取消確認碼 ${confirmCode} 的對賬`,
              }
            }
          },
        }),

        deleteCsvBatch: tool({
          description: "刪除 CSV 批次及其所有交易記錄（請謹慎使用）",
          parameters: z.object({
            batchId: z.string().describe("CSV 批次 ID"),
            confirmDelete: z.boolean().describe("確認刪除（必須為 true 才會執行）"),
          }),
          execute: async ({ batchId, confirmDelete }) => {
            if (!confirmDelete) {
              return { error: "請確認刪除操作（設置 confirmDelete 為 true）" }
            }

            // 獲取批次資訊
            const { data: batch } = await supabase
              .from("csv_import_batches")
              .select("file_name, source_type, records_count")
              .eq("id", batchId)
              .single()

            if (!batch) {
              return { error: "找不到指定的 CSV 批次" }
            }

            // 刪除交易記錄
            if (batch.source_type === "platform") {
              await supabase.from("platform_transactions").delete().eq("batch_id", batchId)
            } else {
              await supabase.from("bank_transactions").delete().eq("batch_id", batchId)
            }

            // 刪除批次記錄
            await supabase.from("csv_import_batches").delete().eq("id", batchId)

            return {
              success: true,
              message: `已刪除 CSV 批次 "${batch.file_name}" 及其 ${batch.records_count} 筆交易記錄`,
            }
          },
        }),

        getIncomeStatistics: tool({
          description: "獲取指定時間範圍的收入統計",
          parameters: z.object({
            year: z.number().describe("年份"),
            month: z.number().optional().describe("月份（1-12），不填則統計整年"),
          }),
          execute: async ({ year, month }) => {
            const query = supabase.from("bank_transactions").select("raw_data, is_income").eq("is_income", true)

            const { data: transactions } = await query

            const filtered = (transactions || []).filter((t: any) => {
              const dateStr = t.raw_data?.["取引日"]
              if (!dateStr) return false

              // 解析日期 (格式: YYYY/MM/DD 或 YYYY-MM-DD)
              const parts = dateStr.split(/[/-]/)
              if (parts.length < 3) return false

              const txYear = Number.parseInt(parts[0])
              const txMonth = Number.parseInt(parts[1])

              if (txYear !== year) return false
              if (month && txMonth !== month) return false

              return true
            })

            let totalIncome = 0
            filtered.forEach((t: any) => {
              const amount = t.raw_data?.["入出金(円)"]
              if (amount) {
                const num = Number.parseInt(String(amount).replace(/,/g, ""))
                if (!isNaN(num) && num > 0) {
                  totalIncome += num
                }
              }
            })

            return {
              year,
              month: month || "全年",
              transactionCount: filtered.length,
              totalIncome: totalIncome.toLocaleString(),
              totalIncomeRaw: totalIncome,
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
