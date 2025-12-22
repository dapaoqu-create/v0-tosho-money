"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
import { FileSpreadsheet, Trash2, Eye, CheckCircle, Clock, ChevronDown } from "lucide-react"
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
          <CardTitle>{t("platform.importList")}</CardTitle>
          <CardDescription>{t("platform.importListDesc")}</CardDescription>
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
