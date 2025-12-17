"use client"

import { useState, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, ArrowUpDown, Filter } from "lucide-react"
import type { BankTransaction, Bank } from "@/lib/types"

interface BankTransactionsTableProps {
  transactions: BankTransaction[]
  banks: Bank[]
}

export function BankTransactionsTable({ transactions, banks }: BankTransactionsTableProps) {
  const [search, setSearch] = useState("")
  const [bankFilter, setBankFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [sortField, setSortField] = useState<"date" | "amount">("date")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((t) => {
        const matchesSearch = t.description?.toLowerCase().includes(search.toLowerCase())
        const matchesBank = bankFilter === "all" || t.bank_id === bankFilter
        const matchesType =
          typeFilter === "all" ||
          (typeFilter === "income" && t.amount > 0) ||
          (typeFilter === "expense" && t.amount < 0)
        return matchesSearch && matchesBank && matchesType
      })
      .sort((a, b) => {
        if (sortField === "date") {
          return sortOrder === "asc"
            ? new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
            : new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
        }
        return sortOrder === "asc" ? a.amount - b.amount : b.amount - a.amount
      })
  }, [transactions, search, bankFilter, typeFilter, sortField, sortOrder])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ja-JP")
  }

  const toggleSort = (field: "date" | "amount") => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortOrder("desc")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>取引一覧</span>
          <span className="text-sm font-normal text-muted-foreground">{filteredTransactions.length}件</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="説明で検索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={bankFilter} onValueChange={setBankFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="銀行" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべての銀行</SelectItem>
              {banks.map((bank) => (
                <SelectItem key={bank.id} value={bank.id}>
                  {bank.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="種類" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="income">入金のみ</SelectItem>
              <SelectItem value="expense">出金のみ</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => toggleSort("date")}>
                    日付
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>説明</TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => toggleSort("amount")}>
                    金額
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>残高</TableHead>
                <TableHead>銀行</TableHead>
                <TableHead>ステータス</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    データがありません
                  </TableCell>
                </TableRow>
              ) : (
                filteredTransactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{formatDate(tx.transaction_date)}</TableCell>
                    <TableCell className="max-w-[300px] truncate">{tx.description}</TableCell>
                    <TableCell className={tx.amount >= 0 ? "text-success" : "text-destructive"}>
                      {formatCurrency(tx.amount)}
                    </TableCell>
                    <TableCell>{formatCurrency(tx.balance)}</TableCell>
                    <TableCell>{tx.bank?.name || "-"}</TableCell>
                    <TableCell>
                      {tx.reconciled ? (
                        <Badge variant="secondary">対帳済</Badge>
                      ) : (
                        <Badge variant="outline">未対帳</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
