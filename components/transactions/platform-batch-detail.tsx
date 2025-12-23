"use client"

import type React from "react"
import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Upload, Trash2, Check, Edit2, ChevronLeft, ChevronRight, Filter } from "lucide-react"
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
  const searchParams = useSearchParams()
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
  const [highlightCode, setHighlightCode] = useState<string | null>(null)
  const highlightRowRef = useRef<HTMLTableRowElement>(null)

  const [editMode, setEditMode] = useState<"transactionCode" | "confirmCode" | null>(null)
  const [editConfirmCode, setEditConfirmCode] = useState("")

  const [showFilterDialog, setShowFilterDialog] = useState(false)
  const [filters, setFilters] = useState<{
    reconciliationStatus: "all" | "reconciled" | "unreconciled"
  }>({
    reconciliationStatus: "all",
  })

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
      confirmationCodes: "確認碼",
      payouts: "Payout",
      editConfirmCode: "編輯確認碼",
      editConfirmCodeDesc: "輸入訂單確認碼",
      editTransactionCode: "編輯交易編碼",
      editTransactionCodeDesc: "輸入銀行交易編碼",
      confirmCode: "確認碼",
      filter: "フィルター",
      filterDesc: "対帳状態でフィルターします",
      reconciliationStatus: "対帳状態",
      clearFilter: "フィルターをクリア",
      all: "すべて",
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
      of: "of",
      totalRecords: "筆",
      goToPage: "跳至頁面",
      confirmationCodes: "確認碼",
      payouts: "Payout",
      editConfirmCode: "編輯確認碼",
      editConfirmCodeDesc: "輸入訂單確認碼",
      editTransactionCode: "編輯交易編碼",
      editTransactionCodeDesc: "輸入銀行交易編碼",
      confirmCode: "確認碼",
      filter: "篩選",
      filterDesc: "依對賬狀態篩選",
      reconciliationStatus: "對賬狀態",
      clearFilter: "清除篩選",
      all: "全部",
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
      confirmationCodes: "Confirmations",
      payouts: "Payouts",
      editConfirmCode: "Edit Confirmation Code",
      editConfirmCodeDesc: "Enter confirmation code",
      editTransactionCode: "Edit Transaction Code",
      editTransactionCodeDesc: "Enter bank transaction code",
      confirmCode: "Confirmation Code",
      filter: "Filter",
      filterDesc: "Filter by reconciliation status",
      reconciliationStatus: "Reconciliation Status",
      clearFilter: "Clear Filter",
      all: "All",
    },
  }

  const l = labels[language] || labels.ja

  const getHeaders = (): string[] => {
    if (transactions.length > 0 && transactions[0].raw_data?._headers) {
      try {
        const parsed = JSON.parse(transactions[0].raw_data._headers)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter((h: string) => h !== "_row_index" && h !== "_headers")
        }
      } catch (e) {}
    }
    if (batch.csv_headers && Array.isArray(batch.csv_headers) && batch.csv_headers.length > 0) {
      return batch.csv_headers.filter((h) => h !== "_row_index" && h !== "_headers")
    }
    return AIRBNB_CSV_HEADERS
  }

  const csvHeaders = getHeaders()

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // 篩選對賬狀態（只看 Payout 行）
      if (filters.reconciliationStatus !== "all") {
        const isPayout = tx.raw_data?.["類型"] === "Payout" || tx.type === "Payout"
        if (isPayout) {
          const status = tx.reconciliation_status || "unreconciled"
          if (filters.reconciliationStatus === "reconciled" && status !== "reconciled") {
            return false
          }
          if (filters.reconciliationStatus === "unreconciled" && status === "reconciled") {
            return false
          }
        }
      }
      return true
    })
  }, [transactions, filters])

  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE)
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredTransactions.slice(startIndex, startIndex + ITEMS_PER_PAGE)
  }, [filteredTransactions, currentPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [filters])

  const hasActiveFilter = filters.reconciliationStatus !== "all"

  const shouldShowReconcileStatus = (tx: PlatformTransaction) => {
    const isPayout = tx.raw_data?.["類型"] === "Payout" || tx.type === "Payout"
    // 只有 Payout 行才顯示對賬狀態
    return isPayout
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
    if (!selectedTxId) return

    if (editMode === "confirmCode") {
      setIsSaving(true)
      try {
        const res = await fetch("/api/platform-transactions/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transactionId: selectedTxId,
            confirmationCode: editConfirmCode.trim() || null,
          }),
        })

        if (res.ok) {
          setShowManualDialog(false)
          setEditConfirmCode("")
          setSelectedTxId(null)
          setEditMode(null)
          router.refresh()
        }
      } catch (error) {
        console.error("Save confirmation code error:", error)
      } finally {
        setIsSaving(false)
      }
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch("/api/reconciliation/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "platform",
          transactionId: selectedTxId,
          transactionCode: manualTransactionCode.trim() || null,
        }),
      })

      if (res.ok) {
        setShowManualDialog(false)
        setManualTransactionCode("")
        setSelectedTxId(null)
        setEditMode(null)
        router.refresh()
      }
    } catch (error) {
      console.error("Manual reconcile error:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const openManualDialog = (txId: string, mode: "transactionCode" | "confirmCode" = "transactionCode") => {
    const tx = transactions.find((t) => t.id === txId)
    setSelectedTxId(txId)
    setEditMode(mode)

    if (mode === "confirmCode") {
      setEditConfirmCode(tx?.raw_data?.["確認碼"] || tx?.confirmation_code || "")
    } else {
      setManualTransactionCode(tx?.matched_bank_transaction_code || "")
    }
    setShowManualDialog(true)
  }

  const { confirmationCodeCount, payoutCount } = useMemo(() => {
    let confirmationCodes = 0
    let payouts = 0

    transactions.forEach((tx) => {
      const type = tx.raw_data?.["類型"] || tx.type
      if (type === "Payout") {
        payouts++
      } else if (type === "預訂") {
        confirmationCodes++
      }
    })

    return { confirmationCodeCount: confirmationCodes, payoutCount: payouts }
  }, [transactions])

  useEffect(() => {
    const highlight = searchParams.get("highlight")
    const rowIndexParam = searchParams.get("row")

    if (highlight) {
      setHighlightCode(highlight)

      // 根據確認碼找到在 filteredTransactions 中的位置
      let targetIndex = -1

      if (rowIndexParam) {
        // 如果有行索引參數，先嘗試用 _row_index 來匹配
        const targetRowIndex = Number.parseInt(rowIndexParam)
        targetIndex = filteredTransactions.findIndex((tx) => {
          const txRowIndex = Number.parseInt(tx.raw_data?.["_row_index"] || "0")
          return txRowIndex === targetRowIndex
        })
      }

      // 如果沒找到，用確認碼搜尋
      if (targetIndex < 0) {
        targetIndex = filteredTransactions.findIndex((tx) => {
          const confirmCode = tx.confirmation_code || tx.raw_data?.["確認碼"]
          return confirmCode === highlight
        })
      }

      if (targetIndex >= 0) {
        const targetPage = Math.ceil((targetIndex + 1) / ITEMS_PER_PAGE)
        if (targetPage > 0 && targetPage <= Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE)) {
          setCurrentPage(targetPage)
        }
      }

      const timer = setTimeout(() => {
        setHighlightCode(null)
      }, 20000)

      return () => clearTimeout(timer)
    }
  }, [searchParams, filteredTransactions])

  useEffect(() => {
    if (highlightCode && highlightRowRef.current) {
      // 延遲更長時間確保頁面已完全渲染
      const scrollTimer = setTimeout(() => {
        highlightRowRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        })
      }, 300)

      return () => clearTimeout(scrollTimer)
    }
  }, [highlightCode, currentPage, paginatedTransactions])

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
                {l.confirmationCodes}: {confirmationCodeCount} {l.totalRecords}
                {" • "}
                {l.payouts}: {payoutCount} {l.totalRecords}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant={hasActiveFilter ? "default" : "outline"} onClick={() => setShowFilterDialog(true)}>
                <Filter className="mr-2 h-4 w-4" />
                {l.filter}
                {hasActiveFilter && " (1)"}
              </Button>
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
                {l.page} {currentPage} {l.of} {totalPages} ({filteredTransactions.length} {l.totalRecords})
                {hasActiveFilter && ` / ${transactions.length} ${l.totalRecords}`}
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
                  <TableHead className="min-w-[120px]">{l.transactionCode}</TableHead>
                  {csvHeaders.map((header) => (
                    <TableHead key={header}>{header}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTransactions.map((tx, idx) => {
                  const displayIndex = (currentPage - 1) * ITEMS_PER_PAGE + idx + 1
                  const isReconciled = tx.reconciliation_status === "reconciled"
                  const txConfirmCode = tx.confirmation_code || tx.raw_data?.["確認碼"]
                  const shouldHighlight = highlightCode && txConfirmCode === highlightCode

                  return (
                    <TableRow
                      key={tx.id}
                      ref={shouldHighlight ? highlightRowRef : null}
                      className={shouldHighlight ? "bg-yellow-100 dark:bg-yellow-900/30 animate-pulse" : ""}
                    >
                      <TableCell className="sticky left-0 bg-background z-10 font-medium">{displayIndex}</TableCell>
                      <TableCell>
                        {shouldShowReconcileStatus(tx) ? (
                          tx.matched_bank_transaction_code ? (
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
                                onClick={() => openManualDialog(tx.id, "transactionCode")}
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
                        {shouldShowReconcileStatus(tx) ? (
                          tx.matched_bank_transaction_code ? (
                            <div
                              className="flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded p-1 -m-1"
                              onClick={() => openManualDialog(tx.id, "transactionCode")}
                            >
                              <Badge variant="secondary" className="font-mono text-xs">
                                {tx.matched_bank_transaction_code}
                              </Badge>
                              <Edit2 className="h-3 w-3 text-muted-foreground" />
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-muted-foreground"
                              onClick={() => openManualDialog(tx.id, "transactionCode")}
                            >
                              <Edit2 className="h-3 w-3 mr-1" />-
                            </Button>
                          )
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      {csvHeaders.map((header) => {
                        const cellValue = tx.raw_data?.[header] ?? "-"

                        // 確認碼欄位特殊處理
                        if (header === "確認碼" && !shouldShowReconcileStatus(tx)) {
                          return <TableCell key={header}>{cellValue}</TableCell>
                        }

                        return <TableCell key={header}>{cellValue}</TableCell>
                      })}
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

      <Dialog open={showManualDialog} onOpenChange={setShowManualDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editMode === "confirmCode" ? l.editConfirmCode : l.editTransactionCode}</DialogTitle>
            <DialogDescription>
              {editMode === "confirmCode" ? l.editConfirmCodeDesc : l.editTransactionCodeDesc}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {editMode === "confirmCode" ? (
              <div className="space-y-2">
                <Label>{l.confirmCode}</Label>
                <Input
                  value={editConfirmCode}
                  onChange={(e) => setEditConfirmCode(e.target.value)}
                  placeholder={l.editConfirmCodeDesc}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>{l.transactionCode}</Label>
                <Input
                  value={manualTransactionCode}
                  onChange={(e) => setManualTransactionCode(e.target.value)}
                  placeholder={l.enterTransactionCode}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualDialog(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleManualReconcile} disabled={isSaving}>
              {isSaving ? t("loading") : t("confirm")}
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

      <Dialog open={showFilterDialog} onOpenChange={setShowFilterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{l.filter}</DialogTitle>
            <DialogDescription>{l.filterDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">{l.reconciliationStatus}</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={filters.reconciliationStatus === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilters((f) => ({ ...f, reconciliationStatus: "all" }))}
                >
                  {l.all}
                </Button>
                <Button
                  variant={filters.reconciliationStatus === "unreconciled" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilters((f) => ({ ...f, reconciliationStatus: "unreconciled" }))}
                >
                  {l.unreconciled}
                </Button>
                <Button
                  variant={filters.reconciliationStatus === "reconciled" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilters((f) => ({ ...f, reconciliationStatus: "reconciled" }))}
                >
                  {l.reconciled}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setFilters({ reconciliationStatus: "all" })
              }}
            >
              {l.clearFilter}
            </Button>
            <Button onClick={() => setShowFilterDialog(false)}>{t("common.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
