"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
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
import { RefreshCcw, Play, Settings, FileText, Building2, Check, AlertCircle } from "lucide-react"
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

interface ReconciliationPanelProps {
  rules: ReconciliationRule[]
  bankBatches: ImportBatch[]
  platformBatches: ImportBatch[]
}

export function ReconciliationPanel({ rules, bankBatches, platformBatches }: ReconciliationPanelProps) {
  const router = useRouter()
  const { t, language } = useLanguage()
  const [selectedRule, setSelectedRule] = useState<string | null>(rules[0]?.id || null)
  const [selectedBankBatches, setSelectedBankBatches] = useState<string[]>([])
  const [selectedPlatformBatches, setSelectedPlatformBatches] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string; matched: number } | null>(null)

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(language === "ja" ? "ja-JP" : language === "zh-TW" ? "zh-TW" : "en-US")
  }

  const toggleBankBatch = (id: string) => {
    setSelectedBankBatches((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]))
  }

  const togglePlatformBatch = (id: string) => {
    setSelectedPlatformBatches((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]))
  }

  const handleExecuteReconciliation = async () => {
    if (!selectedRule || selectedBankBatches.length === 0 || selectedPlatformBatches.length === 0) {
      return
    }

    setIsProcessing(true)
    setResult(null)

    try {
      const res = await fetch("/api/reconciliation/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ruleId: selectedRule,
          bankBatchIds: selectedBankBatches,
          platformBatchIds: selectedPlatformBatches,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "對賬執行失敗")
      }

      setResult({
        success: true,
        message: data.message,
        matched: data.matched || 0,
      })

      router.refresh()
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "對賬執行失敗",
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
      confirmTitle: "対帳実行の確認",
      confirmDesc: "選択したルールとレポートで自動対帳を実行しますか？",
      bankField: "銀行フィールド",
      platformField: "プラットフォームフィールド",
      selected: "選択済み",
      records: "件",
      matchedCount: "件の対帳が完了しました",
    },
    "zh-TW": {
      selectRule: "選擇對賬規則",
      ruleDesc: "比對銀行和平台欄位的規則",
      selectBankBatch: "選擇銀行報表",
      selectPlatformBatch: "選擇平台報表",
      executeReconciliation: "自動對賬實行",
      confirmTitle: "確認執行對賬",
      confirmDesc: "確定要使用選定的規則和報表執行自動對賬嗎？",
      bankField: "銀行欄位",
      platformField: "平台欄位",
      selected: "已選擇",
      records: "筆",
      matchedCount: "筆對賬完成",
    },
    en: {
      selectRule: "Select Reconciliation Rule",
      ruleDesc: "Rules for comparing bank and platform fields",
      selectBankBatch: "Select Bank Reports",
      selectPlatformBatch: "Select Platform Reports",
      executeReconciliation: "Execute Auto Reconciliation",
      confirmTitle: "Confirm Reconciliation",
      confirmDesc: "Are you sure you want to execute auto reconciliation with the selected rule and reports?",
      bankField: "Bank Field",
      platformField: "Platform Field",
      selected: "Selected",
      records: "records",
      matchedCount: "matches completed",
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
        {result && (
          <div
            className={`flex items-center gap-2 rounded-lg p-4 w-full max-w-md ${
              result.success ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"
            }`}
          >
            {result.success ? <Check className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
            <span>{result.message}</span>
            {result.success && result.matched > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {result.matched} {l.matchedCount}
              </Badge>
            )}
          </div>
        )}

        <Button
          size="lg"
          onClick={() => setShowConfirmDialog(true)}
          disabled={!canExecute || isProcessing}
          className="min-w-[200px]"
        >
          {isProcessing ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
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

      {/* Confirm Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{l.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{l.confirmDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleExecuteReconciliation}>{t("confirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
