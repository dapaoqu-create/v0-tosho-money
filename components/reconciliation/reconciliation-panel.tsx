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
import { RefreshCcw, Settings, FileText, Building2, Check, AlertCircle, Eye, History } from "lucide-react"
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
  matched_count: number
  status: string
  created_at: string
  confirmed_at?: string
}

interface ReconciliationPanelProps {
  rules: ReconciliationRule[]
  bankBatches: ImportBatch[]
  platformBatches: ImportBatch[]
  logs?: ReconciliationLog[]
}

export function ReconciliationPanel({ rules, bankBatches, platformBatches, logs = [] }: ReconciliationPanelProps) {
  const router = useRouter()
  const { t, language } = useLanguage()
  const [selectedRule, setSelectedRule] = useState<string | null>(rules[0]?.id || null)
  const [selectedBankBatches, setSelectedBankBatches] = useState<string[]>([])
  const [selectedPlatformBatches, setSelectedPlatformBatches] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [previewMatches, setPreviewMatches] = useState<ReconciliationMatch[]>([])
  const [previewLogId, setPreviewLogId] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string; matched: number } | null>(null)
  const [debugInfo, setDebugInfo] = useState<any>(null)

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(language === "ja" ? "ja-JP" : language === "zh-TW" ? "zh-TW" : "en-US")
  }

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat(language === "ja" ? "ja-JP" : language === "zh-TW" ? "zh-TW" : "en-US", {
      style: "currency",
      currency: "JPY",
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const toggleBankBatch = (id: string) => {
    setSelectedBankBatches((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]))
  }

  const togglePlatformBatch = (id: string) => {
    setSelectedPlatformBatches((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]))
  }

  const handlePreview = async () => {
    if (!selectedRule || selectedBankBatches.length === 0 || selectedPlatformBatches.length === 0) {
      return
    }

    setIsProcessing(true)
    setResult(null)
    setPreviewMatches([])
    setDebugInfo(null)

    try {
      const res = await fetch("/api/reconciliation/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ruleId: selectedRule,
          bankBatchIds: selectedBankBatches,
          platformBatchIds: selectedPlatformBatches,
        }),
      })

      const data = await res.json()

      if (data.debug) {
        setDebugInfo(data.debug)
        console.log("[v0] Debug info:", data.debug)
      }

      if (!res.ok) {
        throw new Error(data.error || "對賬預覽失敗")
      }

      setPreviewMatches(data.matches || [])
      setPreviewLogId(data.logId)
      setShowPreview(true)
      setResult({
        success: true,
        message: data.message,
        matched: data.matches?.length || 0,
      })
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "對賬預覽失敗",
        matched: 0,
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleConfirm = async () => {
    if (!previewLogId) return

    setIsProcessing(true)

    try {
      const res = await fetch("/api/reconciliation/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId: previewLogId }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "對賬確認失敗")
      }

      setResult({
        success: true,
        message: data.message,
        matched: data.confirmed || 0,
      })
      setShowPreview(false)
      setPreviewMatches([])
      setPreviewLogId(null)
      router.refresh()
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "對賬確認失敗",
        matched: 0,
      })
    } finally {
      setIsProcessing(false)
      setShowConfirmDialog(false)
    }
  }

  const canExecute = selectedRule && selectedBankBatches.length > 0 && selectedPlatformBatches.length > 0

  const labels = {
    ja: {
      selectRule: "対帳ルールを選択",
      ruleDesc: "銀行とプラットフォームのフィールドを比較するルール",
      selectBankBatch: "銀行レポートを選択",
      selectPlatformBatch: "プラットフォームレポートを選択",
      executeReconciliation: "自動対帳を実行",
      previewResults: "対帳結果プレビュー",
      confirmResults: "結果を確認して送信",
      confirmTitle: "対帳確認",
      confirmDesc: "このマッチング結果を確認して、レポートを更新しますか？",
      bankField: "銀行フィールド",
      platformField: "プラットフォームフィールド",
      selected: "選択済み",
      records: "件",
      matchedCount: "件の対帳が見つかりました",
      confirmedCount: "件の対帳が完了しました",
      index: "項次",
      confirmationCode: "確認コード",
      transactionCode: "取引コード",
      transactionDate: "取引日",
      amount: "金額",
      logs: "対帳ログ",
      logTime: "実行時間",
      logRule: "ルール",
      logMatched: "マッチ数",
      logStatus: "ステータス",
      pending: "保留中",
      confirmed: "確認済み",
      cancelled: "キャンセル",
      noMatches: "マッチングなし",
    },
    "zh-TW": {
      selectRule: "選擇對賬規則",
      ruleDesc: "比對銀行和平台欄位的規則",
      selectBankBatch: "選擇銀行報表",
      selectPlatformBatch: "選擇平台報表",
      executeReconciliation: "自動對賬實行",
      previewResults: "對賬結果預覽",
      confirmResults: "確認送出結果",
      confirmTitle: "確認對賬",
      confirmDesc: "確定要使用此配對結果更新報表嗎？",
      bankField: "銀行欄位",
      platformField: "平台欄位",
      selected: "已選擇",
      records: "筆",
      matchedCount: "筆對賬配對",
      confirmedCount: "筆對賬完成",
      index: "項次",
      confirmationCode: "確認碼",
      transactionCode: "交易編號",
      transactionDate: "取引日",
      amount: "金額",
      logs: "對賬日誌",
      logTime: "執行時間",
      logRule: "規則",
      logMatched: "配對數",
      logStatus: "狀態",
      pending: "待確認",
      confirmed: "已確認",
      cancelled: "已取消",
      noMatches: "無配對結果",
    },
    en: {
      selectRule: "Select Reconciliation Rule",
      ruleDesc: "Rules for comparing bank and platform fields",
      selectBankBatch: "Select Bank Reports",
      selectPlatformBatch: "Select Platform Reports",
      executeReconciliation: "Execute Auto Reconciliation",
      previewResults: "Reconciliation Preview",
      confirmResults: "Confirm and Submit",
      confirmTitle: "Confirm Reconciliation",
      confirmDesc: "Are you sure you want to update reports with these matches?",
      bankField: "Bank Field",
      platformField: "Platform Field",
      selected: "Selected",
      records: "records",
      matchedCount: "matches found",
      confirmedCount: "matches completed",
      index: "Index",
      confirmationCode: "Confirmation Code",
      transactionCode: "Transaction Code",
      transactionDate: "Transaction Date",
      amount: "Amount",
      logs: "Reconciliation Logs",
      logTime: "Time",
      logRule: "Rule",
      logMatched: "Matches",
      logStatus: "Status",
      pending: "Pending",
      confirmed: "Confirmed",
      cancelled: "Cancelled",
      noMatches: "No matches",
    },
  }

  const l = labels[language] || labels.ja

  return (
    <div className="space-y-6">
      {/* Step 1: Select Rule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {l.selectRule}
          </CardTitle>
          <CardDescription>{l.ruleDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedRule === rule.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                }`}
                onClick={() => setSelectedRule(rule.id)}
              >
                <div className="flex items-center gap-3">
                  <Checkbox checked={selectedRule === rule.id} onCheckedChange={() => setSelectedRule(rule.id)} />
                  <div>
                    <p className="font-medium">{rule.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {l.bankField}: <code className="bg-muted px-1 rounded">{rule.bank_field}</code>
                      {" ↔ "}
                      {l.platformField}: <code className="bg-muted px-1 rounded">{rule.platform_field}</code>
                    </p>
                  </div>
                </div>
                {selectedRule === rule.id && (
                  <Badge variant="secondary">
                    <Check className="h-3 w-3 mr-1" />
                    {l.selected}
                  </Badge>
                )}
              </div>
            ))}
            {rules.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                {language === "ja" ? "ルールがありません" : language === "zh-TW" ? "沒有規則" : "No rules available"}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Select Batches */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Bank Batches */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {l.selectBankBatch}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {bankBatches.map((batch) => (
                <div
                  key={batch.id}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedBankBatches.includes(batch.id) ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                  onClick={() => toggleBankBatch(batch.id)}
                >
                  <Checkbox
                    checked={selectedBankBatches.includes(batch.id)}
                    onCheckedChange={() => toggleBankBatch(batch.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{batch.file_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {batch.bank_code} • {batch.records_count} {l.records}
                      {batch.memo && ` • ${batch.memo}`}
                    </p>
                  </div>
                </div>
              ))}
              {bankBatches.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  {language === "ja"
                    ? "銀行レポートがありません"
                    : language === "zh-TW"
                      ? "沒有銀行報表"
                      : "No bank reports"}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Platform Batches */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {l.selectPlatformBatch}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {platformBatches.map((batch) => (
                <div
                  key={batch.id}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedPlatformBatches.includes(batch.id) ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                  onClick={() => togglePlatformBatch(batch.id)}
                >
                  <Checkbox
                    checked={selectedPlatformBatches.includes(batch.id)}
                    onCheckedChange={() => togglePlatformBatch(batch.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {batch.platform_name} - {batch.property_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {batch.account_name} • {batch.file_name} • {batch.records_count} {l.records}
                    </p>
                  </div>
                </div>
              ))}
              {platformBatches.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  {language === "ja"
                    ? "プラットフォームレポートがありません"
                    : language === "zh-TW"
                      ? "沒有平台報表"
                      : "No platform reports"}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Execute Button */}
      <div className="flex flex-col items-center gap-4">
        {result && !showPreview && (
          <div
            className={`flex items-center gap-2 rounded-lg p-4 w-full max-w-md ${
              result.success ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"
            }`}
          >
            {result.success ? <Check className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
            <span>{result.message}</span>
          </div>
        )}

        <Button size="lg" onClick={handlePreview} disabled={!canExecute || isProcessing} className="min-w-[200px]">
          {isProcessing ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
          {l.executeReconciliation}
        </Button>

        <p className="text-sm text-muted-foreground">
          {selectedBankBatches.length > 0 && selectedPlatformBatches.length > 0 ? (
            <>
              {l.selected}: {selectedBankBatches.length}{" "}
              {language === "ja" ? "銀行" : language === "zh-TW" ? "銀行" : "bank"}, {selectedPlatformBatches.length}{" "}
              {language === "ja" ? "プラットフォーム" : language === "zh-TW" ? "平台" : "platform"}
            </>
          ) : language === "ja" ? (
            "ルールとレポートを選択してください"
          ) : language === "zh-TW" ? (
            "請選擇規則和報表"
          ) : (
            "Please select a rule and reports"
          )}
        </p>
      </div>

      {/* Preview Results */}
      {showPreview && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {l.previewResults}
            </CardTitle>
            <CardDescription>
              {previewMatches.length} {l.matchedCount}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {debugInfo && (
              <div className="mb-4 p-4 bg-muted rounded-lg text-sm font-mono overflow-x-auto">
                <p className="font-bold mb-2">調試信息 Debug Info:</p>
                <p>銀行交易數: {debugInfo.bankCount}</p>
                <p>平台交易數: {debugInfo.platformCount}</p>
                <p>銀行正數金額數: {debugInfo.bankPositiveCount}</p>
                <p>Payout 數量: {debugInfo.payoutCount}</p>
                <p>配對結果數: {debugInfo.matchesCount}</p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-blue-600">查看銀行 raw_data 欄位</summary>
                  <pre className="mt-1 text-xs whitespace-pre-wrap">
                    {JSON.stringify(debugInfo.sampleBankKeys, null, 2)}
                  </pre>
                </details>
                <details className="mt-2">
                  <summary className="cursor-pointer text-blue-600">查看平台 raw_data 欄位</summary>
                  <pre className="mt-1 text-xs whitespace-pre-wrap">
                    {JSON.stringify(debugInfo.samplePlatformKeys, null, 2)}
                  </pre>
                </details>
                <details className="mt-2">
                  <summary className="cursor-pointer text-blue-600">銀行金額範例 (前20筆)</summary>
                  <pre className="mt-1 text-xs whitespace-pre-wrap">
                    {JSON.stringify(debugInfo.bankAmountsSample, null, 2)}
                  </pre>
                </details>
                <details className="mt-2">
                  <summary className="cursor-pointer text-blue-600">Payout 金額範例 (前20筆)</summary>
                  <pre className="mt-1 text-xs whitespace-pre-wrap">
                    {JSON.stringify(debugInfo.payoutAmountsSample, null, 2)}
                  </pre>
                </details>
                <details className="mt-2">
                  <summary className="cursor-pointer text-blue-600">銀行 raw_data 範例</summary>
                  <pre className="mt-1 text-xs whitespace-pre-wrap">
                    {JSON.stringify(debugInfo.sampleBankRawData, null, 2)}
                  </pre>
                </details>
                <details className="mt-2">
                  <summary className="cursor-pointer text-blue-600">平台 raw_data 範例</summary>
                  <pre className="mt-1 text-xs whitespace-pre-wrap">
                    {JSON.stringify(debugInfo.samplePlatformRawData, null, 2)}
                  </pre>
                </details>
              </div>
            )}

            {previewMatches.length > 0 ? (
              <>
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">{l.index}</TableHead>
                        <TableHead>{l.confirmationCode}</TableHead>
                        <TableHead>{l.transactionCode}</TableHead>
                        <TableHead>{l.transactionDate}</TableHead>
                        <TableHead className="text-right">{l.amount}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewMatches.map((match) => (
                        <TableRow key={match.index}>
                          <TableCell className="font-medium">{match.index}</TableCell>
                          <TableCell>
                            <code className="bg-muted px-1 rounded text-sm">{match.confirmationCode}</code>
                          </TableCell>
                          <TableCell>
                            <code className="bg-muted px-1 rounded text-sm">{match.transactionCode}</code>
                          </TableCell>
                          <TableCell>{match.transactionDate}</TableCell>
                          <TableCell className="text-right font-mono">{formatAmount(match.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-center gap-4 mt-6">
                  <Button variant="outline" onClick={() => setShowPreview(false)}>
                    {t("cancel")}
                  </Button>
                  <Button onClick={() => setShowConfirmDialog(true)} disabled={isProcessing}>
                    {isProcessing ? (
                      <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 h-4 w-4" />
                    )}
                    {l.confirmResults}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-center text-muted-foreground py-8">{l.noMatches}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Reconciliation Logs */}
      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              {l.logs}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{l.logTime}</TableHead>
                    <TableHead>{l.logRule}</TableHead>
                    <TableHead className="text-center">{l.logMatched}</TableHead>
                    <TableHead className="text-center">{l.logStatus}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{formatDate(log.created_at)}</TableCell>
                      <TableCell>{log.rule_name}</TableCell>
                      <TableCell className="text-center">{log.matched_count}</TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            log.status === "confirmed"
                              ? "default"
                              : log.status === "pending"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {log.status === "confirmed"
                            ? l.confirmed
                            : log.status === "pending"
                              ? l.pending
                              : l.cancelled}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirm Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{l.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{l.confirmDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>{t("confirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
