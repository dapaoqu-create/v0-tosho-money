"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import {
  FileSpreadsheet,
  Trash2,
  Eye,
  CheckCircle,
  Clock,
  ChevronDown,
  Search,
  X,
  ExternalLink,
  Loader2,
} from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"
import { useLanguage } from "@/lib/i18n/context"

interface PlatformBatch {
  id: string
  file_name: string
  platform_name: string
  account_name: string
  property_name: string
  records_count: number
  created_at: string
  completion_status?: string
  platform: {
    id: string
    name: string
  } | null
  property: {
    id: string
    name: string
  } | null
}

interface SearchResult {
  id: string
  type: string
  confirmationCode: string
  payoutAmount: string
  reconciliationStatus: string
  matchedBankTransactionCode: string | null
  rowIndex: number
  batchId: string
  fileName: string
  platformName: string
}

interface PlatformBatchListProps {
  batches: PlatformBatch[]
}

export function PlatformBatchList({ batches: initialBatches }: PlatformBatchListProps) {
  const router = useRouter()
  const { t } = useLanguage()
  const [batches, setBatches] = useState(initialBatches)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSearchResults, setShowSearchResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (searchQuery.length < 2) {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await fetch(`/api/platform-transactions/search?q=${encodeURIComponent(searchQuery)}`)
        if (res.ok) {
          const data = await res.json()
          setSearchResults(data.results || [])
          setShowSearchResults(true)
        }
      } catch (error) {
        console.error("搜尋錯誤:", error)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery])

  const handleSearchResultClick = (result: SearchResult) => {
    const url = `/dashboard/platform-transactions/${result.batchId}?highlight=${encodeURIComponent(result.confirmationCode)}&row=${result.rowIndex}`
    window.open(url, "_blank")
    setShowSearchResults(false)
    setSearchQuery("")
  }

  const handleDelete = async () => {
    if (!deleteId) return

    setIsDeleting(true)
    try {
      const res = await fetch(`/api/batches/${deleteId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        router.refresh()
      }
    } catch (error) {
      console.error("Delete error:", error)
    } finally {
      setIsDeleting(false)
      setDeleteId(null)
    }
  }

  const handleStatusChange = async (batchId: string, newStatus: string) => {
    setUpdatingId(batchId)
    try {
      const res = await fetch(`/api/batches/${batchId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })

      if (res.ok) {
        setBatches(batches.map((batch) => (batch.id === batchId ? { ...batch, completion_status: newStatus } : batch)))
      }
    } catch (error) {
      console.error("Status update error:", error)
    } finally {
      setUpdatingId(null)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const StatusBadge = ({ batch }: { batch: PlatformBatch }) => {
    const status = batch.completion_status || "pending"
    const isCompleted = status === "completed"
    const isUpdating = updatingId === batch.id

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-auto p-0 hover:bg-transparent" disabled={isUpdating}>
            <Badge
              variant="outline"
              className={`cursor-pointer flex items-center gap-1 ${
                isCompleted
                  ? "bg-green-100 text-green-700 border-green-300 hover:bg-green-200"
                  : "bg-red-100 text-red-700 border-red-300 hover:bg-red-200"
              }`}
            >
              {isCompleted ? (
                <>
                  <CheckCircle className="h-3 w-3" />
                  {t("status.completed")}
                </>
              ) : (
                <>
                  <Clock className="h-3 w-3" />
                  {t("status.pending")}
                </>
              )}
              <ChevronDown className="h-3 w-3 ml-1" />
            </Badge>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            onClick={() => handleStatusChange(batch.id, "completed")}
            className="flex items-center gap-2"
          >
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span>{t("status.completed")}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleStatusChange(batch.id, "pending")} className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-red-600" />
            <span>{t("status.pending")}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <div className="space-y-6">
      <DashboardHeader titleKey="platform.title" subtitleKey="platform.subtitle" />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("platform.importList")}</CardTitle>
              <CardDescription>{t("platform.importListDesc")}</CardDescription>
            </div>
            <div ref={searchRef} className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("platform.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => searchQuery.length >= 2 && setShowSearchResults(true)}
                  className="pl-9 pr-9 w-64"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                    onClick={() => {
                      setSearchQuery("")
                      setSearchResults([])
                      setShowSearchResults(false)
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* 搜尋結果浮動視窗 */}
              {showSearchResults && (
                <div className="absolute right-0 top-full mt-2 w-[500px] max-h-[400px] overflow-auto bg-background border rounded-lg shadow-lg z-50">
                  {isSearching ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">{t("platform.noSearchResults")}</div>
                  ) : (
                    <div className="divide-y">
                      {searchResults.map((result) => (
                        <div
                          key={result.id}
                          className="p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => handleSearchResultClick(result)}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {result.type}
                              </Badge>
                              {result.confirmationCode && (
                                <span className="font-mono font-medium text-sm">{result.confirmationCode}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={
                                  result.reconciliationStatus === "reconciled"
                                    ? "bg-green-100 text-green-700 border-green-300"
                                    : "bg-yellow-100 text-yellow-700 border-yellow-300"
                                }
                              >
                                {result.reconciliationStatus === "reconciled"
                                  ? t("status.reconciled")
                                  : t("status.unreconciled")}
                              </Badge>
                              <ExternalLink className="h-3 w-3 text-muted-foreground" />
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{result.fileName}</span>
                            {result.payoutAmount && (
                              <span className="font-medium">
                                {t("platform.payout")}: ¥{Number(result.payoutAmount).toLocaleString()}
                              </span>
                            )}
                          </div>
                          {result.matchedBankTransactionCode && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {t("bank.transactionCode")}: {result.matchedBankTransactionCode}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileSpreadsheet className="h-12 w-12 mb-4" />
              <p>{t("noData")}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("status.label")}</TableHead>
                  <TableHead>{t("platform.platformName")}</TableHead>
                  <TableHead>{t("platform.accountName")}</TableHead>
                  <TableHead>{t("platform.propertyName")}</TableHead>
                  <TableHead>{t("platform.fileName")}</TableHead>
                  <TableHead className="text-right">{t("platform.recordCount")}</TableHead>
                  <TableHead>{t("platform.importDate")}</TableHead>
                  <TableHead className="text-right">{t("platform.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow key={batch.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <StatusBadge batch={batch} />
                    </TableCell>
                    <TableCell className="font-medium">{batch.platform_name}</TableCell>
                    <TableCell>{batch.account_name}</TableCell>
                    <TableCell>{batch.property_name}</TableCell>
                    <TableCell>{batch.file_name}</TableCell>
                    <TableCell className="text-right">{batch.records_count}</TableCell>
                    <TableCell>{formatDate(batch.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => router.push(`/dashboard/platform-transactions/${batch.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(batch.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
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
