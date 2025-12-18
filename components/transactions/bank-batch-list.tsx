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
import { FileSpreadsheet, Trash2, Eye } from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"
import { useLanguage } from "@/lib/i18n/context"

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

interface BankBatchListProps {
  batches: BankBatch[]
}

export function BankBatchList({ batches }: BankBatchListProps) {
  const router = useRouter()
  const { t } = useLanguage()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="space-y-6">
      <DashboardHeader titleKey="bank.title" subtitleKey="bank.subtitle" />

      <Card>
        <CardHeader>
          <CardTitle>{t("bank.importList")}</CardTitle>
          <CardDescription>{t("bank.importListDesc")}</CardDescription>
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
                  <TableHead>{t("bank.bankName")}</TableHead>
                  <TableHead>{t("bank.bankCode")}</TableHead>
                  <TableHead>{t("bank.fileName")}</TableHead>
                  <TableHead>{t("bank.memo")}</TableHead>
                  <TableHead className="text-right">{t("bank.recordCount")}</TableHead>
                  <TableHead>{t("bank.importDate")}</TableHead>
                  <TableHead className="text-right">{t("bank.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow key={batch.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">{batch.bank?.name || "-"}</TableCell>
                    <TableCell>{batch.bank_code}</TableCell>
                    <TableCell>{batch.file_name}</TableCell>
                    <TableCell>{batch.memo || "-"}</TableCell>
                    <TableCell className="text-right">{batch.records_count}</TableCell>
                    <TableCell>{formatDate(batch.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => router.push(`/dashboard/bank-transactions/${batch.id}`)}
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
