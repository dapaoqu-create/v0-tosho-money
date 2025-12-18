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
}

interface PlatformBatch {
  id: string
  file_name: string
  platform_name: string
  account_name: string
  property_name: string
  records_count: number
  created_at: string
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

export function PlatformBatchDetail({ batch, transactions }: PlatformBatchDetailProps) {
  const router = useRouter()
  const { t } = useLanguage()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showUpdateDialog, setShowUpdateDialog] = useState(false)
  const [updateMode, setUpdateMode] = useState<"merge" | "replace">("merge")
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const csvHeaders =
    transactions.length > 0 && transactions[0].raw_data ? Object.keys(transactions[0].raw_data) : AIRBNB_CSV_HEADERS

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
                {transactions.length} {t("platform.records")}
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
          <ScrollArea className="w-full whitespace-nowrap rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {csvHeaders.map((header) => (
                    <TableHead key={header} className="min-w-[100px]">
                      {header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    {csvHeaders.map((header) => (
                      <TableCell key={header}>{tx.raw_data?.[header] ?? "-"}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>

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
