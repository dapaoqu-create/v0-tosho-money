"use client"

import type React from "react"
import { useState, useCallback } from "react"
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
import { ArrowLeft, Upload, Trash2, FileSpreadsheet, Check, AlertCircle, Edit2 } from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"
import { useLanguage } from "@/lib/i18n/context"

interface BankTransaction {
  id: string
  transaction_date: string
  amount: number
  balance: number
  description: string
  is_income: boolean
  transaction_code: string | null
  raw_data: Record<string, string> | null
  reconciliation_status?: string
  matched_confirmation_codes?: string[]
}

interface BankBatch {
  id: string
  file_name: string
  bank_code: string
  memo: string | null
  records_count: number
  created_at: string
  bank: {
    id: string
    name: string
  } | null
}

interface BankBatchDetailProps {
  batch: BankBatch
  transactions: BankTransaction[]
}

export function BankBatchDetail({ batch, transactions }: BankBatchDetailProps) {
  const router = useRouter()
  const { t, language } = useLanguage()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showUpdateDialog, setShowUpdateDialog] = useState(false)
  const [showManualDialog, setShowManualDialog] = useState(false)
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null)
  const [manualConfirmCode, setManualConfirmCode] = useState("")
  const [updateMode, setUpdateMode] = useState<"merge" | "replace">("merge")
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const csvHeaders =
    transactions.length > 0 && transactions[0].raw_data
      ? Object.keys(transactions[0].raw_data).filter((h) => h !== "_headers")
      : []

  const labels = {
    ja: {
      itemNo: "項次",
      reconcileStatus: "対帳別",
      confirmationCode: "訂單確認碼",
      reconciled: "対帳完成",
      unreconciled: "未対帳",
      manualReconcile: "手動対帳",
      enterConfirmCode: "確認碼を入力",
      manualReconcileDesc: "手動で確認碼を入力して対帳を完了します",
    },
    "zh-TW": {
      itemNo: "項次",
      reconcileStatus: "對賬別",
      confirmationCode: "訂單確認碼",
      reconciled: "對賬完成",
      unreconciled: "未對賬",
      manualReconcile: "手動對賬",
      enterConfirmCode: "輸入確認碼",
      manualReconcileDesc: "手動輸入確認碼完成對賬",
    },
    en: {
      itemNo: "No.",
      reconcileStatus: "Status",
      confirmationCode: "Confirmation Code",
      reconciled: "Reconciled",
      unreconciled: "Unreconciled",
      manualReconcile: "Manual Reconcile",
      enterConfirmCode: "Enter confirmation code",
      manualReconcileDesc: "Manually enter confirmation code to complete reconciliation",
    },
  }

  const l = labels[language] || labels.ja

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
      formData.append("type", "bank")

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
        router.push("/dashboard/bank-transactions")
        router.refresh()
      }
    } catch (error) {
      console.error("Delete error:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleManualReconcile = async () => {
    if (!selectedTxId || !manualConfirmCode.trim()) return

    setIsSaving(true)
    try {
      const res = await fetch("/api/reconciliation/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "bank",
          transactionId: selectedTxId,
          confirmationCode: manualConfirmCode.trim(),
        }),
      })

      if (res.ok) {
        setShowManualDialog(false)
        setManualConfirmCode("")
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
    setManualConfirmCode("")
    setShowManualDialog(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <DashboardHeader titleKey="bank.batchDetail" subtitleKey="bank.batchDetailDesc" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{batch.bank?.name || "-"}</CardTitle>
              <CardDescription>
                {batch.file_name} • {t("bank.bankCode")}: {batch.bank_code}
                {batch.memo && ` • ${t("bank.memo")}: ${batch.memo}`}
                {" • "}
                {transactions.length} {t("bank.records")}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowUpdateDialog(true)}>
                <Upload className="mr-2 h-4 w-4" />
                {t("bank.updateCsv")}
              </Button>
              <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                {t("delete")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full whitespace-nowrap rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10 min-w-[60px]">{l.itemNo}</TableHead>
                  <TableHead className="min-w-[100px]">{l.reconcileStatus}</TableHead>
                  <TableHead className="min-w-[200px]">{l.confirmationCode}</TableHead>
                  <TableHead className="min-w-[120px]">{t("bank.transactionCode")}</TableHead>
                  {csvHeaders.map((header) => (
                    <TableHead key={header}>{header}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx, index) => (
                  <TableRow key={tx.id}>
                    {/* 項次 */}
                    <TableCell className="sticky left-0 bg-background z-10 font-medium">{index + 1}</TableCell>
                    {/* 對賬別 */}
                    <TableCell>
                      {tx.reconciliation_status === "reconciled" ? (
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
                      )}
                    </TableCell>
                    {/* 訂單確認碼 */}
                    <TableCell>
                      {tx.matched_confirmation_codes?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {tx.matched_confirmation_codes.map((code, i) => (
                            <Badge key={i} variant="secondary" className="font-mono text-xs">
                              {code}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    {/* 交易編碼 */}
                    <TableCell className="font-mono text-xs">{tx.transaction_code || "-"}</TableCell>
                    {/* CSV 原始欄位 */}
                    {csvHeaders.map((header) => (
                      <TableCell key={header}>{tx.raw_data?.[header] || "-"}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
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
              <Label>{l.confirmationCode}</Label>
              <Input
                value={manualConfirmCode}
                onChange={(e) => setManualConfirmCode(e.target.value)}
                placeholder={l.enterConfirmCode}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualDialog(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleManualReconcile} disabled={!manualConfirmCode.trim() || isSaving}>
              {isSaving ? t("loading") : t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Dialog */}
      <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("bank.updateCsvTitle")}</DialogTitle>
            <DialogDescription>{t("bank.updateCsvDesc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <RadioGroup value={updateMode} onValueChange={(v) => setUpdateMode(v as "merge" | "replace")}>
              <div className="flex items-start space-x-3 p-3 border rounded-lg">
                <RadioGroupItem value="merge" id="merge" className="mt-1" />
                <div>
                  <Label htmlFor="merge" className="font-medium">
                    {t("bank.mergeMode")}
                  </Label>
                  <p className="text-sm text-muted-foreground">{t("bank.mergeModeDesc")}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 border rounded-lg">
                <RadioGroupItem value="replace" id="replace" className="mt-1" />
                <div>
                  <Label htmlFor="replace" className="font-medium">
                    {t("bank.replaceMode")}
                  </Label>
                  <p className="text-sm text-muted-foreground">{t("bank.replaceModeDesc")}</p>
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
            <AlertDialogTitle>{t("bank.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("bank.deleteConfirmDesc")}</AlertDialogDescription>
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
