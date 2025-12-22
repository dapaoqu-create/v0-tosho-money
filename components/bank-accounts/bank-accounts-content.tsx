"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Building2, Plus, Trash2, Eye, CreditCard, TrendingUp, Calendar, Edit2 } from "lucide-react"
import { useLanguage } from "@/lib/i18n/context"
import Link from "next/link"
import type { Bank } from "@/lib/types"

interface BankStats {
  bankId: string
  latestBalance: number
  latestDate: string | null
  totalTransactions: number
}

interface BankAccountsContentProps {
  banks: Bank[]
  bankStats: Record<string, BankStats>
}

export function BankAccountsContent({ banks, bankStats }: BankAccountsContentProps) {
  const router = useRouter()
  const { t } = useLanguage()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingBank, setEditingBank] = useState<Bank | null>(null)
  const [newBankName, setNewBankName] = useState("")
  const [editBankName, setEditBankName] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleAddBank = async () => {
    if (!newBankName.trim()) return
    setIsLoading(true)
    try {
      const res = await fetch("/api/settings/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newBankName.trim() }),
      })
      if (res.ok) {
        setNewBankName("")
        setIsAddDialogOpen(false)
        router.refresh()
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditBank = async () => {
    if (!editingBank || !editBankName.trim()) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/settings/banks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingBank.id, name: editBankName.trim() }),
      })
      if (res.ok) {
        setEditBankName("")
        setEditingBank(null)
        setIsEditDialogOpen(false)
        router.refresh()
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteBank = async (id: string) => {
    try {
      await fetch(`/api/settings/banks?id=${id}`, { method: "DELETE" })
      router.refresh()
    } catch (error) {
      console.error(error)
    }
  }

  const openEditDialog = (bank: Bank) => {
    setEditingBank(bank)
    setEditBankName(bank.name)
    setIsEditDialogOpen(true)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-"
    return new Date(dateStr).toLocaleDateString("ja-JP")
  }

  // Calculate totals
  const totalBalance = Object.values(bankStats).reduce((sum, stat) => sum + Number(stat.latestBalance), 0)
  const totalAccounts = banks.length

  return (
    <div className="space-y-6">
      <DashboardHeader titleKey="bankAccounts.title" subtitleKey="bankAccounts.subtitle" />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">登録銀行数</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAccounts}</div>
            <p className="text-xs text-muted-foreground">連携中の銀行口座</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">合計残高</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBalance)}</div>
            <p className="text-xs text-muted-foreground">全銀行口座の合計</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">総取引件数</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.values(bankStats)
                .reduce((sum, stat) => sum + stat.totalTransactions, 0)
                .toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">全銀行の取引合計</p>
          </CardContent>
        </Card>
      </div>

      {/* Bank Accounts List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>銀行口座一覧</CardTitle>
            <CardDescription>登録されている銀行口座を管理します</CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                銀行を追加
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新しい銀行を追加</DialogTitle>
                <DialogDescription>銀行名を入力して新しい銀行口座を登録します</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="bankName">銀行名</Label>
                  <Input
                    id="bankName"
                    placeholder="例：楽天銀行"
                    value={newBankName}
                    onChange={(e) => setNewBankName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddBank()}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  キャンセル
                </Button>
                <Button onClick={handleAddBank} disabled={!newBankName.trim() || isLoading}>
                  {isLoading ? "追加中..." : "追加"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>銀行名</TableHead>
                  <TableHead className="text-right">最新残高</TableHead>
                  <TableHead>最終更新</TableHead>
                  <TableHead className="text-right">取引件数</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {banks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Building2 className="h-8 w-8" />
                        <p>銀行が登録されていません</p>
                        <p className="text-sm">「銀行を追加」ボタンから新しい銀行を登録してください</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  banks.map((bank) => {
                    const stats = bankStats[bank.id]
                    return (
                      <TableRow key={bank.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                              <Building2 className="h-4 w-4 text-primary" />
                            </div>
                            <span className="font-medium">{bank.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={
                              stats?.latestBalance >= 0 ? "font-medium text-green-600" : "font-medium text-red-600"
                            }
                          >
                            {formatCurrency(stats?.latestBalance || 0)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span className="text-sm">{formatDate(stats?.latestDate)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{stats?.totalTransactions?.toLocaleString() || 0} 件</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`/dashboard/bank-transactions?bank=${bank.id}`}>
                              <Button variant="ghost" size="icon" title="取引を表示">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button variant="ghost" size="icon" title="編集" onClick={() => openEditDialog(bank)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" title="削除">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>銀行を削除しますか？</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    「{bank.name}
                                    」を削除すると、関連するすべての取引データも削除されます。この操作は取り消せません。
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteBank(bank.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    削除する
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>銀行名を編集</DialogTitle>
            <DialogDescription>銀行名を変更します</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="editBankName">銀行名</Label>
              <Input
                id="editBankName"
                value={editBankName}
                onChange={(e) => setEditBankName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEditBank()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleEditBank} disabled={!editBankName.trim() || isLoading}>
              {isLoading ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
