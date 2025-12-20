"use client"

import { useState, useEffect, useMemo } from "react"
import { useLanguage } from "@/lib/i18n/context"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CheckCircle2, XCircle, Loader2, Download, AlertTriangle } from "lucide-react"

interface ImportBatch {
  id: string
  platform_name: string
  account_name: string
  file_name: string
  record_count: number
  created_at: string
  confirmation_code_count?: number // 添加確認碼數量欄位
}

interface NotFoundItem {
  code: string
  date: string
  guest: string
  amount: string
  batchId: string
}

interface CheckResult {
  total: number
  matched: number
  notFound: NotFoundItem[]
  apiError?: boolean
  message?: string
}

export default function ConfirmationCheckPage() {
  const { t } = useLanguage()
  const [batches, setBatches] = useState<ImportBatch[]>([])
  const [selectedBatches, setSelectedBatches] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<CheckResult | null>(null)

  useEffect(() => {
    loadBatches()
  }, [])

  const selectedConfirmationCodeCount = useMemo(() => {
    return batches
      .filter((b) => selectedBatches.includes(b.id))
      .reduce((sum, b) => sum + (b.confirmation_code_count || 0), 0)
  }, [batches, selectedBatches])

  const totalConfirmationCodeCount = useMemo(() => {
    return batches.reduce((sum, b) => sum + (b.confirmation_code_count || 0), 0)
  }, [batches])

  const loadBatches = async () => {
    const supabase = createClient()

    // 獲取批次列表
    const { data: batchData, error: batchError } = await supabase
      .from("csv_import_batches")
      .select("*")
      .eq("source_type", "platform")
      .order("created_at", { ascending: false })

    if (batchError || !batchData) {
      setLoading(false)
      return
    }

    const batchesWithCounts = await Promise.all(
      batchData.map(async (batch) => {
        // 查詢該批次的所有交易
        const { data: transactions } = await supabase
          .from("platform_transactions")
          .select("raw_data")
          .eq("batch_id", batch.id)

        // 在前端計算有確認碼的數量
        const confirmationCount =
          transactions?.filter((tx) => {
            const rawData = tx.raw_data as Record<string, unknown>
            const code = rawData?.["確認碼"]
            return code && String(code).trim() !== ""
          }).length || 0

        return {
          ...batch,
          confirmation_code_count: confirmationCount,
        }
      }),
    )

    setBatches(batchesWithCounts)
    setLoading(false)
  }

  const toggleBatch = (batchId: string) => {
    setSelectedBatches((prev) => (prev.includes(batchId) ? prev.filter((id) => id !== batchId) : [...prev, batchId]))
  }

  const selectAll = () => {
    if (selectedBatches.length === batches.length) {
      setSelectedBatches([])
    } else {
      setSelectedBatches(batches.map((b) => b.id))
    }
  }

  const handleCheck = async () => {
    if (selectedBatches.length === 0) return

    setChecking(true)
    setResult(null)

    try {
      const response = await fetch("/api/confirmation-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchIds: selectedBatches }),
      })

      const data = await response.json()
      setResult(data)
    } catch (error) {
      console.error("檢查失敗:", error)
      setResult({
        total: 0,
        matched: 0,
        notFound: [],
        apiError: true,
        message: "檢查過程發生錯誤",
      })
    } finally {
      setChecking(false)
    }
  }

  const exportNotFound = () => {
    if (!result || result.notFound.length === 0) return

    const headers = ["確認碼", "日期", "房客", "金額"]
    const rows = result.notFound.map((item) => [item.code, item.date, item.guest, item.amount])

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n")
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `未登記確認碼_${new Date().toISOString().split("T")[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("confirmCheck.title")}</h1>
        <p className="text-muted-foreground">{t("confirmCheck.subtitle")}</p>
      </div>

      {/* 選擇 CSV */}
      <Card>
        <CardHeader>
          <CardTitle>{t("confirmCheck.selectBatches")}</CardTitle>
          <CardDescription>{t("confirmCheck.selectBatchesDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : batches.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>{t("confirmCheck.noBatches")}</p>
              <p className="text-sm">{t("confirmCheck.importFirst")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Checkbox
                  id="select-all"
                  checked={selectedBatches.length === batches.length}
                  onCheckedChange={selectAll}
                />
                <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                  全選 ({batches.length} 個檔案)
                </label>
                {selectedBatches.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    已選 {selectedConfirmationCodeCount} 筆確認碼
                  </Badge>
                )}
              </div>

              <div className="grid gap-2 max-h-64 overflow-y-auto">
                {batches.map((batch) => (
                  <div
                    key={batch.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedBatches.includes(batch.id) ? "bg-primary/10 border-primary" : "hover:bg-muted"
                    }`}
                    onClick={() => toggleBatch(batch.id)}
                  >
                    <Checkbox
                      checked={selectedBatches.includes(batch.id)}
                      onCheckedChange={() => toggleBatch(batch.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{batch.file_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {batch.platform_name} - {batch.account_name} · {batch.confirmation_code_count || 0} 筆確認碼
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(batch.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>

              <Button onClick={handleCheck} disabled={selectedBatches.length === 0 || checking} className="w-full">
                {checking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("confirmCheck.checking")}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {t("confirmCheck.startCheck")} ({selectedBatches.length} 個檔案, {selectedConfirmationCodeCount}{" "}
                    筆確認碼)
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 檢查結果 */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{t("confirmCheck.results")}</span>
              {result.notFound.length > 0 && (
                <Button variant="outline" size="sm" onClick={exportNotFound}>
                  <Download className="mr-2 h-4 w-4" />
                  {t("confirmCheck.exportNotFound")}
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result.apiError && (
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2 text-yellow-800">
                <AlertTriangle className="h-5 w-5" />
                <span>{result.message || t("confirmCheck.apiError")}</span>
              </div>
            )}

            {/* 統計摘要 */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-3xl font-bold">{result.total}</div>
                <div className="text-sm text-muted-foreground">{t("confirmCheck.totalCodes")}</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-3xl font-bold text-green-600">{result.matched}</div>
                <div className="text-sm text-green-600">{t("confirmCheck.matched")}</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-3xl font-bold text-red-600">{result.notFound.length}</div>
                <div className="text-sm text-red-600">{t("confirmCheck.notFound")}</div>
              </div>
            </div>

            {/* 未登記清單 */}
            {result.notFound.length > 0 ? (
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  {t("confirmCheck.notFoundDesc")} ({result.notFound.length})
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>{t("confirmCheck.confirmationCode")}</TableHead>
                        <TableHead>{t("confirmCheck.date")}</TableHead>
                        <TableHead>{t("confirmCheck.guest")}</TableHead>
                        <TableHead className="text-right">{t("confirmCheck.amount")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.notFound.map((item, index) => (
                        <TableRow key={`${item.code}-${index}`}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell>
                            <Badge variant="destructive">{item.code}</Badge>
                          </TableCell>
                          <TableCell>{item.date}</TableCell>
                          <TableCell>{item.guest}</TableCell>
                          <TableCell className="text-right">{item.amount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <p className="text-green-600 font-medium">{t("confirmCheck.allMatched")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
