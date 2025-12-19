"use client"

import type React from "react"
import { useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  ArrowLeft,
  Upload,
  Trash2,
  FileSpreadsheet,
  Check,
  AlertCircle,
  Edit2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"
import { useLanguage } from "@/lib/i18n/context"

interface PlatformTransaction {
  id: string
  transaction_date: string
  type: string
  confirmation_code: string
  guest_name: string
  nights: number
  payout_amount: number
  reconciled: boolean
  raw_data: Record<string, string> | null
  reconciliation_status?: string
  matched_bank_transaction_code?: string
}

interface PlatformBatch {
  id: string
  file_name: string
  platform_name: string
  account_name: string
  property_name: string
  records_count: number
  created_at: string
  csv_headers?: string[]
}

interface PlatformBatchDetailProps {
  batch: PlatformBatch
  transactions: PlatformTransaction[]
}

const AIRBNB_CSV_HEADERS = [
  "日期",
  "入帳日期",
  "類型",
  "確認碼",
  "預訂日期",
  "開始日期",
  "結束日期",
  "晚",
  "客人",
  "房源",
  "詳情",
  "推薦碼",
  "幣別",
  "金額",
  "收款",
  "服務費",
  "快速收款手續費",
  "清潔費",
  "床單費用",
  "總收入",
  "住宿稅",
  "收入年份",
]

const ITEMS_PER_PAGE = 200

export function PlatformBatchDetail({ batch, transactions }: PlatformBatchDetailProps) {
  const router = useRouter()
  const { t, language } = useLanguage()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showUpdateDialog, setShowUpdateDialog] = useState(false)
  const [showManualDialog, setShowManualDialog] = useState(false)
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null)
  const [manualTransactionCode, setManualTransactionCode] = useState("")
  const [updateMode, setUpdateMode] = useState<"merge" | "replace">("merge")
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const [currentPage, setCurrentPage] = useState(1)

  const labels = {
    ja: {
      itemNo: "項次",
      reconcileStatus: "対帳別",
      transactionCode: "交易編碼",
      reconciled: "対帳完成",
      unreconciled: "未対帳",
      manualReconcile: "手動対帳",
      enterTransactionCode: "交易編碼を入力",
      manualReconcileDesc: "手動で交易編碼を入力して対帳を完了します",
      page: "ページ",
      of: "/",
      totalRecords: "件",
      goToPage: "ページへ移動",
    },
    "zh-TW": {
      itemNo: "項次",
      reconcileStatus: "對賬別",
      transactionCode: "交易編碼",
      reconciled: "對賬完成",
      unreconciled: "未對賬",
      manualReconcile: "手動對賬",
      enterTransactionCode: "輸入交易編碼",
      manualReconcileDesc: "手動輸入交易編碼完成對賬",
      page: "頁",
      of: "/",
      totalRecords: "筆",
      goToPage: "跳至頁面",
    },
    en: {
      itemNo: "No.",
      reconcileStatus: "Status",
      transactionCode: "Transaction Code",
      reconciled: "Reconciled",
      unreconciled: "Unreconciled",
      manualReconcile: "Manual Reconcile",
      enterTransactionCode: "Enter transaction code",
      manualReconcileDesc: "Manually enter transaction code to complete reconciliation",
      page: "Page",
      of: "of",
      totalRecords: "records",
      goToPage: "Go to page",
    },
  }

  const l = labels[language] || labels.ja

  const getHeaders = (): string[] => {
    if (transactions.length > 0 && transactions[0].raw_data?._headers) {
      try {
        const parsed = JSON.parse(transactions[0].raw_data._headers)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
        }
      } catch (e) {}
    }
    if (batch.csv_headers && Array.isArray(batch.csv_headers) && batch.csv_headers.length > 0) {
      return batch.csv_headers
    }
    return AIRBNB_CSV_HEADERS
  }

  const csvHeaders = getHeaders()

  const totalPages = Math.ceil(transactions.length / ITEMS_PER_PAGE)
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    return transactions.slice(startIndex, startIndex + ITEMS_PER_PAGE)
  }, [transactions, currentPage])

  // 檢查該行是否有確認碼（對賬狀態只顯示在有確認碼的行）
  const hasConfirmationCode = (tx: PlatformTransaction) => {
    const confirmCode = tx.raw_data?.["確認碼"] || tx.confirmation_code
    return confirmCode && confirmCode.trim() !== ""
  }

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && selectedFile.name.endsWith(".csv")) {
      setFile(selectedFile)
      setResult(null)
    }
  }, [])

  const handleUpdate = async () => {
    if (!file) return

    setIsUploading(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("batchId", batch.id)
      formData.append("mode", updateMode)
      formData.append("type", "platform")

      const res = await fetch("/api/batches/update", {
        method: "POST",
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || t("errorOccurred"))
      }

      setResult({
        success: true,
        message: data.message,
      })

      setTimeout(() => {
        setShowUpdateDialog(false)
        setFile(null)
        setResult(null)
        router.refresh()
      }, 1500)
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : t("errorOccurred"),
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/batches/${batch.id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        router.push("/dashboard/platform-transactions")
        router.refresh()
      }
    } catch (error) {
      console.error("Delete error:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleManualReconcile = async () => {
    if (!selectedTxId || !manualTransactionCode.trim()) return

    setIsSaving(true)
    try {
      const res = await fetch("/api/reconciliation/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "platform",
          transactionId: selectedTxId,
          transactionCode: manualTransactionCode.trim(),
        }),
      })

      if (res.ok) {
        setShowManualDialog(false)
        setManualTransactionCode("")
        setSelectedTxId(null)
        router.refresh()
      }
    } catch (error) {
      console.error("Manual reconcile error:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const openManualDialog = (txId: string) => {
    setSelectedTxId(txId)
    setManualTransactionCode("")
    setShowManualDialog(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <DashboardHeader titleKey="platform.batchDetail" subtitleKey="platform.batchDetailDesc" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {batch.platform_name} - {batch.property_name}
              </CardTitle>
              <CardDescription>
                {t("platform.accountName")}: {batch.account_name} • {batch.file_name}
                {" • "}
                {transactions.length} {l.totalRecords}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowUpdateDialog(true)}>
                <Upload className="mr-2 h-4 w-4" />
                {t("platform.updateCsv")}
              </Button>
              <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                {t("delete")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-muted-foreground">
                {l.page} {currentPage} {l.of} {totalPages} ({transactions.length} {l.totalRecords})
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Select value={String(currentPage)} onValueChange={(v) => setCurrentPage(Number(v))}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: totalPages }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        {l.page} {i + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <ScrollArea className="w-full whitespace-nowrap rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10 min-w-[60px]">{l.itemNo}</TableHead>
                  <TableHead className="min-w-[100px]">{l.reconcileStatus}</TableHead>
                  <TableHead className="min-w-[150px]">{l.transactionCode}</TableHead>
                  {csvHeaders.map((header) => (
                    <TableHead key={header} className="min-w-[100px]">
                      {header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTransactions.map((tx, index) => {
                  const showReconcileStatus = hasConfirmationCode(tx)
                  const globalIndex = (currentPage - 1) * ITEMS_PER_PAGE + index + 1
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="sticky left-0 bg-background z-10 font-medium">{globalIndex}</TableCell>
                      <TableCell>
                        {showReconcileStatus ? (
                          tx.reconciliation_status === "reconciled" ? (
                            <Badge variant="default" className="bg-green-500">
                              <Check className="h-3 w-3 mr-1" />
                              {l.reconciled}
                            </Badge>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{l.unreconciled}</Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => openManualDialog(tx.id)}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {tx.matched_bank_transaction_code ? (
                          <Badge variant="secondary" className="font-mono text-xs">
                            {tx.matched_bank_transaction_code}
                          </Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      {csvHeaders.map((header) => (
                        <TableCell key={header}>{tx.raw_data?.[header] ?? "-"}</TableCell>
                      ))}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                {l.page} {currentPage} {l.of} {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Reconcile Dialog */}
      <Dialog open={showManualDialog} onOpenChange={setShowManualDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{l.manualReconcile}</DialogTitle>
            <DialogDescription>{l.manualReconcileDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{l.transactionCode}</Label>
              <Input
                value={manualTransactionCode}
                onChange={(e) => setManualTransactionCode(e.target.value)}
                placeholder={l.enterTransactionCode}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualDialog(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleManualReconcile} disabled={!manualTransactionCode.trim() || isSaving}>
              {isSaving ? t("loading") : t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Dialog */}
      <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("platform.updateCsvTitle")}</DialogTitle>
            <DialogDescription>{t("platform.updateCsvDesc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <RadioGroup value={updateMode} onValueChange={(v) => setUpdateMode(v as "merge" | "replace")}>
              <div className="flex items-start space-x-3 p-3 border rounded-lg">
                <RadioGroupItem value="merge" id="merge" className="mt-1" />
                <div>
                  <Label htmlFor="merge" className="font-medium">
                    {t("platform.mergeMode")}
                  </Label>
                  <p className="text-sm text-muted-foreground">{t("platform.mergeModeDesc")}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 border rounded-lg">
                <RadioGroupItem value="replace" id="replace" className="mt-1" />
                <div>
                  <Label htmlFor="replace" className="font-medium">
                    {t("platform.replaceMode")}
                  </Label>
                  <p className="text-sm text-muted-foreground">{t("platform.replaceModeDesc")}</p>
                </div>
              </div>
            </RadioGroup>

            <div className="space-y-2">
              <Label>{t("import.csvFile")}</Label>
              <Input type="file" accept=".csv" onChange={handleFileChange} />
              {file && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  {file.name}
                </p>
              )}
            </div>

            {result && (
              <div
                className={`flex items-center gap-2 rounded-lg p-3 ${result.success ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}
              >
                {result.success ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                {result.message}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpdateDialog(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleUpdate} disabled={!file || isUploading}>
              {isUploading ? t("loading") : t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("platform.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("platform.deleteConfirmDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? t("loading") : t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
