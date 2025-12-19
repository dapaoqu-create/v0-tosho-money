"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
import { RefreshCcw, Settings, FileText, Building2, Check, AlertCircle, Eye, History, CheckCircle } from "lucide-react"
import { useLanguage } from "@/lib/i18n/context"

interface ReconciliationRule {
  id: string
  name: string
  bank_field: string
  platform_field: string
}

interface ImportBatch {
  id: string
  file_name: string
  source_type: string
  platform_name?: string
  account_name?: string
  property_name?: string
  bank_code?: string
  memo?: string
  records_count: number
  created_at: string
}

interface ReconciliationMatch {
  index: number
  confirmationCode: string
  transactionCode: string
  transactionDate: string
  amount: number
  bankTransactionId: string
  platformTransactionId: string
}

interface ReconciliationLog {
  id: string
  rule_name: string
  matches_count: number
  status: string
  created_at: string
}

interface ReconciliationPanelProps {
  rules: ReconciliationRule[]
  bankBatches: ImportBatch[]
  platformBatches: ImportBatch[]
  logs: ReconciliationLog[]
}

export function ReconciliationPanel({ rules, bankBatches, platformBatches, logs }: ReconciliationPanelProps) {
  const { t } = useLanguage()
  const router = useRouter()
  const [selectedRule, setSelectedRule] = useState<string | null>(null)
  const [selectedBankBatches, setSelectedBankBatches] = useState<string[]>([])
  const [selectedPlatformBatches, setSelectedPlatformBatches] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewMatches, setPreviewMatches] = useState<ReconciliationMatch[]>([])
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [previewPage, setPreviewPage] = useState(1)
  const previewPageSize = 100

  const handlePreview = async () => {
    if (!selectedRule || selectedBankBatches.length === 0 || selectedPlatformBatches.length === 0) {
      return
    }

    setIsProcessing(true)
    setShowPreview(false)
    setPreviewMatches([])
    setDebugInfo(null)

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

    try {
      const response = await fetch("/api/reconciliation/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ruleId: selectedRule,
          matches: previewMatches,
        }),
      })

      if (response.ok) {
        setShowPreview(false)
        setPreviewMatches([])
        setShowConfirmDialog(false)
        router.refresh()
      }
    } catch (error) {
      console.error("Confirm error:", error)
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
            isProcessing || !selectedRule || selectedBankBatches.length === 0 || selectedPlatformBatches.length === 0
          }
        >
          {isProcessing ? <RefreshCcw className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
          {t("reconciliation.execute")}
        </Button>
      </div>

      {/* Debug Info */}
      {debugInfo && (
        <Card className="border-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              調試信息 Debug Info:
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1">
            <p>銀行交易數: {debugInfo.bankCount}</p>
            <p>平台交易數: {debugInfo.platformCount}</p>
            <p>銀行正數金額數: {debugInfo.positiveAmountCount}</p>
            <p>Payout 數量: {debugInfo.payoutCount}</p>
            <p className={debugInfo.intersectionCount > 0 ? "text-green-600 font-bold" : ""}>
              金額交集數: {debugInfo.intersectionCount}
            </p>
            <p className={debugInfo.matchesCount > 0 ? "text-green-600 font-bold text-lg" : ""}>
              配對結果數: {debugInfo.matchesCount}
            </p>
            {debugInfo.intersectionAmounts && debugInfo.intersectionAmounts.length > 0 && (
              <div className="mt-2">
                <p className="font-medium">交集金額 (前30筆):</p>
                <p className="text-muted-foreground break-all">
                  {debugInfo.intersectionAmounts.slice(0, 30).join(", ")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {showPreview && (
        <Card className="border-2 border-green-500 bg-green-50 dark:bg-green-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
              <CheckCircle className="h-5 w-5" />
              {t("reconciliation.previewTitle")}
              <Badge variant="secondary" className="ml-2 text-lg px-3 py-1">
                {previewMatches.length} 件
              </Badge>
            </CardTitle>
            <CardDescription>
              {previewMatches.length > 0
                ? `找到 ${previewMatches.length} 筆配對結果，請確認後送出`
                : t("reconciliation.noMatches")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {previewMatches.length > 0 ? (
              <>
                {/* 分頁控制 - 頂部 */}
                {totalPreviewPages > 1 && (
                  <div className="flex items-center justify-between mb-4 p-2 bg-white dark:bg-gray-800 rounded">
                    <span className="text-sm text-muted-foreground">
                      顯示 {(previewPage - 1) * previewPageSize + 1} -{" "}
                      {Math.min(previewPage * previewPageSize, previewMatches.length)} / {previewMatches.length} 筆
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                        disabled={previewPage === 1}
                      >
                        上一頁
                      </Button>
                      <span className="px-3 py-1 text-sm">
                        {previewPage} / {totalPreviewPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewPage((p) => Math.min(totalPreviewPages, p + 1))}
                        disabled={previewPage === totalPreviewPages}
                      >
                        下一頁
                      </Button>
                    </div>
                  </div>
                )}

                {/* 表格 */}
                <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-900">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-100 dark:bg-gray-800">
                        <TableHead className="w-16">項次</TableHead>
                        <TableHead>確認碼</TableHead>
                        <TableHead>交易編碼</TableHead>
                        <TableHead>取引日</TableHead>
                        <TableHead className="text-right">金額</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedPreviewMatches.map((match, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{(previewPage - 1) * previewPageSize + idx + 1}</TableCell>
                          <TableCell className="font-mono text-xs">{match.confirmationCode || "-"}</TableCell>
                          <TableCell className="font-mono text-xs">{match.transactionCode || "-"}</TableCell>
                          <TableCell>{match.transactionDate}</TableCell>
                          <TableCell className="text-right">¥{match.amount?.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* 確認按鈕 */}
                <div className="flex justify-center mt-6">
                  <Button
                    size="lg"
                    onClick={() => setShowConfirmDialog(true)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    {t("reconciliation.confirmSubmit")} ({previewMatches.length} 件)
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">{t("reconciliation.noMatches")}</div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Reconciliation Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            {t("reconciliation.logs")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.date")}</TableHead>
                  <TableHead>{t("reconciliation.ruleName")}</TableHead>
                  <TableHead>{t("reconciliation.matchCount")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
                    <TableCell>{log.rule_name}</TableCell>
                    <TableCell>{log.matches_count}</TableCell>
                    <TableCell>
                      <Badge variant={log.status === "completed" ? "default" : "secondary"}>{log.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-4 text-muted-foreground">{t("reconciliation.noLogs")}</div>
          )}
        </CardContent>
      </Card>

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
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isProcessing}>
              {isProcessing ? <RefreshCcw className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              {t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
