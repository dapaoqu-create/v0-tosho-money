"use client"

import type React from "react"
import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ArrowLeft, Upload, Trash2, FileSpreadsheet, Check, AlertCircle } from "lucide-react"
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
  const { t } = useLanguage()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showUpdateDialog, setShowUpdateDialog] = useState(false)
  const [updateMode, setUpdateMode] = useState<"merge" | "replace">("merge")
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ja-JP")
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
    }).format(amount)
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("bank.transactionCode")}</TableHead>
                <TableHead>{t("bank.date")}</TableHead>
                <TableHead>{t("bank.description")}</TableHead>
                <TableHead className="text-right">{t("bank.amount")}</TableHead>
                <TableHead className="text-right">{t("bank.balance")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="font-mono text-xs">{tx.transaction_code || "-"}</TableCell>
                  <TableCell>{formatDate(tx.transaction_date)}</TableCell>
                  <TableCell>{tx.description}</TableCell>
                  <TableCell className={`text-right ${tx.is_income ? "text-green-600" : "text-red-600"}`}>
                    {tx.is_income ? "+" : ""}
                    {formatCurrency(tx.amount)}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(tx.balance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
