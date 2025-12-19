"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Settings, Play, FileText, Building2, CheckCircle, Loader2, ChevronLeft, ChevronRight } from "lucide-react"
import { useLanguage } from "@/lib/i18n/context"

interface ReconciliationPanelProps {
  rules: any[]
  bankBatches: any[]
  platformBatches: any[]
  logs: any[]
}

export function ReconciliationPanel({ rules, bankBatches, platformBatches, logs }: ReconciliationPanelProps) {
  const { t } = useLanguage()
  const router = useRouter()

  const [selectedRule, setSelectedRule] = useState<string | null>(rules[0]?.id || null)
  const [selectedBankBatches, setSelectedBankBatches] = useState<string[]>(bankBatches.map((b) => b.id))
  const [selectedPlatformBatches, setSelectedPlatformBatches] = useState<string[]>(platformBatches.map((b) => b.id))
  const [isProcessing, setIsProcessing] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewMatches, setPreviewMatches] = useState<any[]>([])
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [previewPage, setPreviewPage] = useState(1)
  const previewPageSize = 100
  const [confirmResult, setConfirmResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    setSelectedBankBatches(bankBatches.map((b) => b.id))
  }, [bankBatches])

  useEffect(() => {
    setSelectedPlatformBatches(platformBatches.map((b) => b.id))
  }, [platformBatches])

  const handlePreview = async () => {
    if (!selectedRule) return

    setIsProcessing(true)
    setDebugInfo(null)
    setConfirmResult(null)

    try {
      const response = await fetch("/api/reconciliation/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ruleId: selectedRule,
          bankBatchIds: selectedBankBatches,
          platformBatchIds: selectedPlatformBatches,
        }),
      })

      const data = await response.json()
      console.log("[v0] API Response:", data)
      console.log("[v0] Matches count:", data.matches?.length || 0)
      console.log("[v0] First 3 matches:", data.matches?.slice(0, 3))
      console.log("[v0] Debug info:", data.debug)

      if (data.debug) {
        setDebugInfo(data.debug)
      }

      if (data.matches && data.matches.length > 0) {
        console.log("[v0] Setting previewMatches:", data.matches.length)
        setPreviewMatches(data.matches)
        setShowPreview(true)
        setPreviewPage(1)
      } else {
        setPreviewMatches([])
        setShowPreview(true)
      }
    } catch (error) {
      console.error("[v0] Preview error:", error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleConfirm = async () => {
    setIsProcessing(true)
    setConfirmResult(null)

    try {
      const response = await fetch("/api/reconciliation/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ruleId: selectedRule,
          matches: previewMatches,
        }),
      })

      const data = await response.json()
      console.log("[v0] Confirm response:", data)

      if (response.ok && data.success) {
        setConfirmResult({
          success: true,
          message: data.message || `已確認 ${data.confirmed} 筆對賬`,
        })
        setShowPreview(false)
        setPreviewMatches([])
        setShowConfirmDialog(false)
        router.refresh()
      } else {
        setConfirmResult({
          success: false,
          message: data.error || "確認失敗",
        })
      }
    } catch (error) {
      console.error("Confirm error:", error)
      setConfirmResult({
        success: false,
        message: "確認過程發生錯誤",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const toggleBankBatch = (id: string) => {
    setSelectedBankBatches((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]))
  }

  const togglePlatformBatch = (id: string) => {
    setSelectedPlatformBatches((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]))
  }

  const totalPreviewPages = Math.ceil(previewMatches.length / previewPageSize)
  const paginatedPreviewMatches = previewMatches.slice(
    (previewPage - 1) * previewPageSize,
    previewPage * previewPageSize,
  )

  return (
    <div className="space-y-6">
      {confirmResult && (
        <div
          className={`p-4 rounded-lg ${confirmResult.success ? "bg-green-100 border border-green-500 text-green-800" : "bg-red-100 border border-red-500 text-red-800"}`}
        >
          <div className="flex items-center gap-2">
            {confirmResult.success ? <CheckCircle className="h-5 w-5" /> : null}
            <span className="font-medium">{confirmResult.message}</span>
          </div>
        </div>
      )}

      {/* Rules Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t("reconciliation.rules")}
          </CardTitle>
          <CardDescription>{t("reconciliation.selectRule")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center space-x-2">
                <Checkbox
                  id={rule.id}
                  checked={selectedRule === rule.id}
                  onCheckedChange={() => setSelectedRule(selectedRule === rule.id ? null : rule.id)}
                />
                <label htmlFor={rule.id} className="text-sm font-medium cursor-pointer">
                  {rule.name}
                  <span className="ml-2 text-muted-foreground">
                    ({rule.bank_field} ↔ {rule.platform_field})
                  </span>
                </label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Bank Batches */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {t("reconciliation.bankData")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {bankBatches.map((batch) => (
                <div key={batch.id} className="flex items-center space-x-2 p-2 rounded hover:bg-muted">
                  <Checkbox
                    id={`bank-${batch.id}`}
                    checked={selectedBankBatches.includes(batch.id)}
                    onCheckedChange={() => toggleBankBatch(batch.id)}
                  />
                  <label htmlFor={`bank-${batch.id}`} className="flex-1 cursor-pointer">
                    <div className="font-medium text-sm">{batch.bank_code || batch.file_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {batch.records_count} {t("common.records")}
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Platform Batches */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t("reconciliation.platformData")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {platformBatches.map((batch) => (
                <div key={batch.id} className="flex items-center space-x-2 p-2 rounded hover:bg-muted">
                  <Checkbox
                    id={`platform-${batch.id}`}
                    checked={selectedPlatformBatches.includes(batch.id)}
                    onCheckedChange={() => togglePlatformBatch(batch.id)}
                  />
                  <label htmlFor={`platform-${batch.id}`} className="flex-1 cursor-pointer">
                    <div className="font-medium text-sm">
                      {batch.platform_name} - {batch.property_name || batch.file_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {batch.records_count} {t("common.records")}
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Execute Button */}
      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={handlePreview}
          disabled={
            !selectedRule || selectedBankBatches.length === 0 || selectedPlatformBatches.length === 0 || isProcessing
          }
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t("common.processing")}
            </>
          ) : (
            <>
              <Play className="mr-2 h-5 w-5" />
              {t("reconciliation.execute")}
            </>
          )}
        </Button>
      </div>

      {/* Debug Info */}
      {debugInfo && (
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-sm">調試信息 Debug Info:</CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1">
            <p>銀行交易數: {debugInfo.bankCount}</p>
            <p>平台交易數: {debugInfo.platformCount}</p>
            <p>銀行正數金額數: {debugInfo.bankPositiveCount}</p>
            <p>Payout 數量: {debugInfo.payoutCount}</p>
            <p className="text-lg font-bold text-green-600">金額交集數: {debugInfo.intersectionCount}</p>
            <p className="text-lg font-bold text-blue-600">配對結果數: {debugInfo.matchesCount}</p>
            {debugInfo.intersectionAmounts && debugInfo.intersectionAmounts.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-blue-600 hover:underline">交集金額 (前50筆)</summary>
                <p className="mt-1 p-2 bg-background rounded text-xs break-all">
                  {debugInfo.intersectionAmounts.join(", ")}
                </p>
              </details>
            )}
            {debugInfo.bankAmountExamples && (
              <details className="mt-2">
                <summary className="cursor-pointer text-blue-600 hover:underline">銀行金額解析範例</summary>
                <pre className="mt-1 p-2 bg-background rounded text-xs overflow-auto max-h-40">
                  {debugInfo.bankAmountExamples.join("\n")}
                </pre>
              </details>
            )}
            {debugInfo.payoutAmountExamples && (
              <details className="mt-2">
                <summary className="cursor-pointer text-blue-600 hover:underline">Payout 金額解析範例</summary>
                <pre className="mt-1 p-2 bg-background rounded text-xs overflow-auto max-h-40">
                  {debugInfo.payoutAmountExamples.join("\n")}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preview Results */}
      {showPreview && (
        <Card className="border-2 border-green-500 bg-green-50">
          <CardHeader className="bg-green-100">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                {t("reconciliation.previewTitle")}
              </span>
              <Badge variant="default" className="text-lg px-4 py-1 bg-green-600">
                {previewMatches.length} 件
              </Badge>
            </CardTitle>
            <CardDescription>
              {previewMatches.length > 0
                ? `${previewMatches.length} ${t("reconciliation.matchesFound")}`
                : t("reconciliation.noMatches")}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {previewMatches.length > 0 ? (
              <>
                {/* Pagination Top */}
                {totalPreviewPages > 1 && (
                  <div className="flex items-center justify-between p-4 border-b bg-white">
                    <div className="text-sm text-muted-foreground">
                      顯示 {(previewPage - 1) * previewPageSize + 1} -{" "}
                      {Math.min(previewPage * previewPageSize, previewMatches.length)} / {previewMatches.length} 筆
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                        disabled={previewPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">
                        {previewPage} / {totalPreviewPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewPage((p) => Math.min(totalPreviewPages, p + 1))}
                        disabled={previewPage === totalPreviewPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-green-100">
                        <TableHead className="w-16">{t("common.index")}</TableHead>
                        <TableHead>{t("reconciliation.confirmationCode")}</TableHead>
                        <TableHead>{t("reconciliation.transactionCode")}</TableHead>
                        <TableHead>{t("reconciliation.transactionDate")}</TableHead>
                        <TableHead className="text-right">{t("common.amount")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedPreviewMatches.map((match, idx) => (
                        <TableRow key={idx} className="bg-white hover:bg-green-50">
                          <TableCell>{(previewPage - 1) * previewPageSize + idx + 1}</TableCell>
                          <TableCell className="font-mono text-xs max-w-xs truncate">
                            {match.confirmationCode}
                          </TableCell>
                          <TableCell className="font-mono">{match.transactionCode}</TableCell>
                          <TableCell>{match.transactionDate}</TableCell>
                          <TableCell className="text-right font-mono">¥{match.amount?.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Confirm Button */}
                <div className="p-4 bg-green-100 flex justify-center">
                  <Button
                    size="lg"
                    onClick={() => setShowConfirmDialog(true)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="mr-2 h-5 w-5" />
                    {t("reconciliation.confirmResults")} ({previewMatches.length} 件)
                  </Button>
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-muted-foreground">{t("reconciliation.noMatches")}</div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("reconciliation.logs")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.date")}</TableHead>
                  <TableHead>{t("reconciliation.matchCount")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.slice(0, 10).map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
                    <TableCell>{log.matches_count}</TableCell>
                    <TableCell>
                      <Badge variant={log.status === "confirmed" ? "default" : "secondary"}>
                        {log.status === "confirmed" ? t("reconciliation.confirmed") : t("reconciliation.pending")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Confirm Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("reconciliation.confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("reconciliation.confirmDescription", { count: previewMatches.length })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("common.processing")}
                </>
              ) : (
                t("common.confirm")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
