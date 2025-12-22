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
import { Checkbox } from "@/components/ui/checkbox"
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
import {
  ArrowLeft,
  Upload,
  Trash2,
  Check,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Calculator,
  X,
  Filter,
  Search,
} from "lucide-react"
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

const ITEMS_PER_PAGE = 200

export function BankBatchDetail({ batch, transactions }: BankBatchDetailProps) {
  const router = useRouter()
  const { t, language } = useLanguage()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showUpdateDialog, setShowUpdateDialog] = useState(false)
  const [showFilterDialog, setShowFilterDialog] = useState(false)
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null)
  const [manualConfirmCode, setManualConfirmCode] = useState("")
  const [updateMode, setUpdateMode] = useState<"merge" | "replace">("merge")
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")

  const [filters, setFilters] = useState({
    unreconciled: false,
    reconciled: false,
    positiveAmount: false,
    negativeAmount: false,
  })

  const [editMode, setEditMode] = useState<"confirmCode" | "transactionCode" | null>(null)
  const [editConfirmCodes, setEditConfirmCodes] = useState("")
  const [editTransactionCode, setEditTransactionCode] = useState("")

  const csvHeaders =
    transactions.length > 0 && transactions[0].raw_data
      ? Object.keys(transactions[0].raw_data).filter((h) => h !== "_headers" && h !== "_row_index")
      : []

  const amountColumnName = useMemo(() => {
    const possibleNames = ["入出金(円)", "入出金(円）", "入出金", "金額", "Amount", "amount"]
    for (const name of possibleNames) {
      if (csvHeaders.includes(name)) return name
    }
    return null
  }, [csvHeaders])

  const filteredTransactions = useMemo(() => {
    let result = transactions

    // 搜尋過濾
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter((tx) => {
        // 搜尋所有 raw_data 欄位
        if (tx.raw_data) {
          for (const value of Object.values(tx.raw_data)) {
            if (value && String(value).toLowerCase().includes(query)) {
              return true
            }
          }
        }
        // 搜尋確認碼
        if (tx.matched_confirmation_codes?.some((code) => code.toLowerCase().includes(query))) {
          return true
        }
        // 搜尋交易編碼
        if (tx.transaction_code?.toLowerCase().includes(query)) {
          return true
        }
        return false
      })
    }

    // 篩選過濾
    const hasActiveFilter = Object.values(filters).some((v) => v)
    if (!hasActiveFilter) return result

    return result.filter((tx) => {
      const matchesReconciliation =
        (!filters.unreconciled && !filters.reconciled) ||
        (filters.unreconciled && tx.reconciliation_status !== "reconciled") ||
        (filters.reconciled && tx.reconciliation_status === "reconciled")

      const matchesAmount =
        (!filters.positiveAmount && !filters.negativeAmount) ||
        (() => {
          if (!amountColumnName || !tx.raw_data?.[amountColumnName]) return false
          const amountStr = tx.raw_data[amountColumnName]
          const amount = Number.parseInt(amountStr.replace(/[,\s]/g, ""), 10)
          if (isNaN(amount)) return false
          return (filters.positiveAmount && amount > 0) || (filters.negativeAmount && amount < 0)
        })()

      return matchesReconciliation && matchesAmount
    })
  }, [transactions, filters, amountColumnName, searchQuery])

  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE)
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredTransactions.slice(startIndex, startIndex + ITEMS_PER_PAGE)
  }, [filteredTransactions, currentPage])

  const selectedTotal = useMemo(() => {
    if (selectedRows.size === 0 || !amountColumnName) return null

    let total = 0
    let count = 0

    for (const txId of selectedRows) {
      const tx = filteredTransactions.find((t) => t.id === txId)
      if (tx?.raw_data?.[amountColumnName]) {
        const amountStr = tx.raw_data[amountColumnName]
        const amount = Number.parseInt(amountStr.replace(/[,\s]/g, ""), 10)
        if (!isNaN(amount)) {
          total += amount
          count++
        }
      }
    }

    return { total, count }
  }, [selectedRows, filteredTransactions, amountColumnName])

  const toggleRowSelection = useCallback((txId: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev)
      if (next.has(txId)) {
        next.delete(txId)
      } else {
        next.add(txId)
      }
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    const currentPageIds = paginatedTransactions.map((tx) => tx.id)
    const allSelected = currentPageIds.every((id) => selectedRows.has(id))

    setSelectedRows((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        currentPageIds.forEach((id) => next.delete(id))
      } else {
        currentPageIds.forEach((id) => next.add(id))
      }
      return next
    })
  }, [paginatedTransactions, selectedRows])

  const clearSelection = useCallback(() => {
    setSelectedRows(new Set())
  }, [])

  const toggleFilter = useCallback((filterKey: keyof typeof filters) => {
    setFilters((prev) => ({
      ...prev,
      [filterKey]: !prev[filterKey],
    }))
    setCurrentPage(1)
  }, [])

  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter((v) => v).length
  }, [filters])

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
      page: "ページ",
      of: "/",
      totalRecords: "件",
      goToPage: "ページへ移動",
      selected: "選択中",
      items: "件",
      total: "合計",
      clearSelection: "選択解除",
      filter: "篩選",
      filterOptions: "篩選選項",
      positiveAmount: "入出金(円)正數",
      negativeAmount: "入出金(円)負數",
      activeFilters: "個篩選",
      editConfirmCode: "編輯確認碼",
      editConfirmCodeDesc: "輸入訂單確認碼（多個用逗號分隔）",
      editTransactionCode: "編輯交易編碼",
      editTransactionCodeDesc: "輸入銀行交易編碼",
      transactionCode: "交易編碼",
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
      page: "頁",
      of: "/",
      totalRecords: "筆",
      goToPage: "跳至頁面",
      selected: "已選擇",
      items: "筆",
      total: "合計",
      clearSelection: "清除選擇",
      filter: "篩選",
      filterOptions: "篩選選項",
      positiveAmount: "入出金(円)正數",
      negativeAmount: "入出金(円)負數",
      activeFilters: "個篩選",
      editConfirmCode: "編輯確認碼",
      editConfirmCodeDesc: "輸入訂單確認碼（多個用逗號分隔）",
      editTransactionCode: "編輯交易編碼",
      editTransactionCodeDesc: "輸入銀行交易編碼",
      transactionCode: "交易編碼",
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
      page: "Page",
      of: "of",
      totalRecords: "records",
      goToPage: "Go to page",
      selected: "Selected",
      items: "items",
      total: "Total",
      clearSelection: "Clear",
      filter: "Filter",
      filterOptions: "Filter Options",
      positiveAmount: "Positive Amount",
      negativeAmount: "Negative Amount",
      activeFilters: "filters",
      editConfirmCode: "Edit Confirmation Code",
      editConfirmCodeDesc: "Enter confirmation codes (separate multiple with comma)",
      editTransactionCode: "Edit Transaction Code",
      editTransactionCodeDesc: "Enter bank transaction code",
      transactionCode: "Transaction Code",
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
    if (!selectedTxId) return

    setIsSaving(true)
    try {
      const res = await fetch("/api/reconciliation/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "bank",
          transactionId: selectedTxId,
          confirmationCode: manualConfirmCode.trim() || null,
        }),
      })

      if (res.ok) {
        setShowFilterDialog(false)
        setManualConfirmCode("")
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

  const handleSaveTransactionCode = async () => {
    if (!selectedTxId) return

    setIsSaving(true)
    try {
      const res = await fetch("/api/bank-transactions/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: selectedTxId,
          transactionCode: editTransactionCode.trim() || null,
        }),
      })

      if (res.ok) {
        setShowFilterDialog(false)
        setEditTransactionCode("")
        setSelectedTxId(null)
        setEditMode(null)
        router.refresh()
      }
    } catch (error) {
      console.error("Save transaction code error:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const openManualDialog = (txId: string, mode: "confirmCode" | "transactionCode" = "confirmCode") => {
    const tx = transactions.find((t) => t.id === txId)
    setSelectedTxId(txId)
    setEditMode(mode)

    if (mode === "confirmCode") {
      setManualConfirmCode(tx?.matched_confirmation_codes?.join(", ") || "")
    } else {
      setEditTransactionCode(tx?.transaction_code || "")
    }
    setShowFilterDialog(true)
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
                {filteredTransactions.length} {l.totalRecords}
                {filteredTransactions.length !== transactions.length &&
                  ` (${t("common.total")} ${transactions.length})`}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={t("common.search")}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setCurrentPage(1) // 搜尋時重置頁碼
                  }}
                  className="pl-9 w-[200px]"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
                    onClick={() => setSearchQuery("")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <Button variant={activeFilterCount > 0 ? "default" : "outline"} onClick={() => setShowFilterDialog(true)}>
                <Filter className="mr-2 h-4 w-4" />
                {l.filter}
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
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
          {totalPages > 1 && (
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-muted-foreground">
                {l.page} {currentPage} {l.of} {totalPages} ({filteredTransactions.length} {l.totalRecords})
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

          {selectedTotal && selectedTotal.count > 0 && (
            <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
              <div className="bg-primary text-primary-foreground shadow-lg rounded-lg px-6 py-3 flex items-center gap-4">
                <Calculator className="h-5 w-5" />
                <div className="flex items-center gap-2">
                  <span className="text-sm opacity-90">
                    {l.selected} {selectedTotal.count} {l.items}
                  </span>
                  <span className="text-xl font-bold">
                    {l.total}: ¥{selectedTotal.total.toLocaleString()}
                  </span>
                </div>
                <Button variant="secondary" size="sm" onClick={clearSelection} className="ml-2">
                  <X className="h-4 w-4 mr-1" />
                  {l.clearSelection}
                </Button>
              </div>
            </div>
          )}

          <ScrollArea className="w-full whitespace-nowrap rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10 w-[40px]">
                    <Checkbox
                      checked={
                        paginatedTransactions.length > 0 && paginatedTransactions.every((tx) => selectedRows.has(tx.id))
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="min-w-[60px]">{l.itemNo}</TableHead>
                  <TableHead className="min-w-[100px]">{l.reconcileStatus}</TableHead>
                  <TableHead className="min-w-[200px]">{l.confirmationCode}</TableHead>
                  <TableHead className="min-w-[120px]">{l.transactionCode}</TableHead>
                  {csvHeaders.map((header) => (
                    <TableHead key={header}>{header}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTransactions.map((tx, index) => {
                  const globalIndex = (currentPage - 1) * ITEMS_PER_PAGE + index + 1
                  const isSelected = selectedRows.has(tx.id)
                  return (
                    <TableRow key={tx.id} className={isSelected ? "bg-primary/10" : undefined}>
                      <TableCell className="sticky left-0 bg-background z-10">
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleRowSelection(tx.id)} />
                      </TableCell>
                      <TableCell className="font-medium">{globalIndex}</TableCell>
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
                              onClick={() => openManualDialog(tx.id, "confirmCode")}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {tx.matched_confirmation_codes?.length ? (
                          <div
                            className="flex flex-wrap gap-1 cursor-pointer hover:bg-muted/50 rounded p-1 -m-1"
                            onClick={() => openManualDialog(tx.id, "confirmCode")}
                          >
                            {tx.matched_confirmation_codes.map((code, i) => (
                              <Badge key={i} variant="secondary" className="font-mono text-xs">
                                {code}
                              </Badge>
                            ))}
                            <Edit2 className="h-3 w-3 text-muted-foreground ml-1" />
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-muted-foreground"
                            onClick={() => openManualDialog(tx.id, "confirmCode")}
                          >
                            <Edit2 className="h-3 w-3 mr-1" />
                            {l.enterConfirmCode}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        {tx.transaction_code ? (
                          <div
                            className="flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded p-1 -m-1"
                            onClick={() => openManualDialog(tx.id, "transactionCode")}
                          >
                            <span className="font-mono text-xs">{tx.transaction_code}</span>
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
                        )}
                      </TableCell>
                      {csvHeaders.map((header) => (
                        <TableCell key={header}>{tx.raw_data?.[header] || "-"}</TableCell>
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

      <Dialog open={showFilterDialog} onOpenChange={setShowFilterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{l.filter}</DialogTitle>
            <DialogDescription>{t("bank.filterDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("bank.reconciliationStatus")}</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={filters.unreconciled ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilters((f) => ({ ...f, unreconciled: !f.unreconciled }))}
                >
                  {t("status.unreconciled")}
                </Button>
                <Button
                  variant={filters.reconciled ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilters((f) => ({ ...f, reconciled: !f.reconciled }))}
                >
                  {t("status.reconciled")}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("bank.amountFilter")}</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={filters.positiveAmount ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilters((f) => ({ ...f, positiveAmount: !f.positiveAmount }))}
                >
                  {t("bank.positiveAmount")}
                </Button>
                <Button
                  variant={filters.negativeAmount ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilters((f) => ({ ...f, negativeAmount: !f.negativeAmount }))}
                >
                  {t("bank.negativeAmount")}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setFilters({
                  unreconciled: false,
                  reconciled: false,
                  positiveAmount: false,
                  negativeAmount: false,
                })
              }}
            >
              {t("bank.clearFilter")}
            </Button>
            <Button onClick={() => setShowFilterDialog(false)}>{t("confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
