"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Clock, Download, FileText, Search, XCircle, CheckCircle } from "lucide-react"
import { useLanguage } from "@/lib/i18n/context"
import { createClient } from "@/lib/supabase/client"

interface Batch {
  id: string
  file_name: string
  platform_name: string
  account_name: string
  record_count: number
  created_at: string
  confirmation_code_count?: number
}

interface NotFoundItem {
  code: string
  date: string
  guest: string
  amount: string
  batchId: string
}

export default function ConfirmationCheckPage() {
  const { t } = useLanguage()
  const [batches, setBatches] = useState<Batch[]>([])
  const [selectedBatches, setSelectedBatches] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<{
    total: number
    matched: number
    notFound: NotFoundItem[]
  } | null>(null)

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
        // 使用分頁獲取該批次的所有交易
        const PAGE_SIZE = 1000
        let offset = 0
        let hasMore = true
        let confirmationCount = 0

        while (hasMore) {
          const { data: transactions } = await supabase
            .from("platform_transactions")
            .select("raw_data")
            .eq("batch_id", batch.id)
            .range(offset, offset + PAGE_SIZE - 1)

          if (transactions && transactions.length > 0) {
            // 計算有確認碼且不是 Payout 的數量（與 API 邏輯一致）
            confirmationCount += transactions.filter((tx) => {
              const rawData = tx.raw_data as Record<string, unknown>
              const code = rawData?.["確認碼"] || rawData?.["Confirmation Code"]
              const type = rawData?.["類型"] || rawData?.["Type"]
              return code && String(code).trim() !== "" && type !== "Payout"
            }).length

            offset += PAGE_SIZE
            hasMore = transactions.length === PAGE_SIZE
          } else {
            hasMore = false
          }
        }

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

      if (data.error) {
        console.error("檢查失敗:", data.error)
        return
      }

      setResult({
        total: data.total,
        matched: data.matched,
        notFound: data.notFound || [],
      })
    } catch (error) {
      console.error("檢查錯誤:", error)
    } finally {
      setChecking(false)
    }
  }

  const exportNotFound = () => {
    if (!result || result.notFound.length === 0) return

    const csvContent = [
      ["確認碼", "日期", "房客", "金額"].join(","),
      ...result.notFound.map((item) => [item.code, item.date, item.guest, item.amount].join(",")),
    ].join("\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `未登記確認碼_${new Date().toISOString().split("T")[0]}.csv`
    link.click()
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Clock className="mr-2 h-6 w-6 animate-spin" />
        <span>{t("common.loading")}</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{t("confirmCheck.title")}</h1>
        <p className="text-muted-foreground">{t("confirmCheck.description")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("confirmCheck.selectCsv")}</CardTitle>
          <CardDescription>{t("confirmCheck.selectCsvDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={selectedBatches.length === batches.length && batches.length > 0}
              onCheckedChange={selectAll}
            />
            <span className="font-medium">
              {t("common.selectAll")} ({batches.length} {t("confirmCheck.files")})
            </span>
            {selectedBatches.length > 0 && (
              <Badge variant="secondary">
                {t("confirmCheck.selected")} {selectedConfirmationCodeCount} {t("confirmCheck.codes")}
              </Badge>
            )}
          </div>

          <div className="max-h-[400px] space-y-2 overflow-y-auto">
            {batches.map((batch) => (
              <div
                key={batch.id}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                  selectedBatches.includes(batch.id) ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                }`}
                onClick={() => toggleBatch(batch.id)}
              >
                <Checkbox checked={selectedBatches.includes(batch.id)} onCheckedChange={() => toggleBatch(batch.id)} />
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="font-medium">{batch.file_name}</div>
                  <div className="text-sm text-muted-foreground">
                    {batch.platform_name} - {batch.account_name} · {batch.confirmation_code_count || 0}{" "}
                    {t("confirmCheck.codesCount")}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button onClick={handleCheck} disabled={selectedBatches.length === 0 || checking} className="w-full">
            {checking ? (
              <>
                <Clock className="mr-2 h-4 w-4 animate-spin" />
                {t("confirmCheck.checking")}
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                {t("confirmCheck.startCheck")} ({selectedBatches.length} {t("confirmCheck.files")},{" "}
                {selectedConfirmationCodeCount} {t("confirmCheck.codesCount")})
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("confirmCheck.result")}</CardTitle>
            {result.notFound.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportNotFound}>
                <Download className="mr-2 h-4 w-4" />
                {t("confirmCheck.export")}
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-muted p-4 text-center">
                <div className="text-3xl font-bold">{result.total}</div>
                <div className="text-sm text-muted-foreground">{t("confirmCheck.totalCodes")}</div>
              </div>
              <div className="rounded-lg bg-green-50 p-4 text-center">
                <div className="text-3xl font-bold text-green-600">{result.matched}</div>
                <div className="text-sm text-muted-foreground">{t("confirmCheck.registered")}</div>
              </div>
              <div className="rounded-lg bg-red-50 p-4 text-center">
                <div className="text-3xl font-bold text-red-600">{result.notFound.length}</div>
                <div className="text-sm text-muted-foreground">{t("confirmCheck.notRegistered")}</div>
              </div>
            </div>

            {result.notFound.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-600">
                  <XCircle className="h-5 w-5" />
                  <span className="font-medium">
                    {t("confirmCheck.notFoundDesc")} ({result.notFound.length})
                  </span>
                </div>
                <div className="max-h-[300px] overflow-y-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th className="p-2 text-left">{t("confirmCheck.confirmCode")}</th>
                        <th className="p-2 text-left">{t("confirmCheck.date")}</th>
                        <th className="p-2 text-left">{t("confirmCheck.guest")}</th>
                        <th className="p-2 text-right">{t("confirmCheck.amount")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.notFound.map((item, index) => (
                        <tr key={index} className="border-t">
                          <td className="p-2 font-mono">{item.code}</td>
                          <td className="p-2">{item.date}</td>
                          <td className="p-2">{item.guest}</td>
                          <td className="p-2 text-right">{item.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result.notFound.length === 0 && result.total > 0 && (
              <div className="flex items-center justify-center gap-2 rounded-lg bg-green-50 p-4 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">{t("confirmCheck.allRegistered")}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
