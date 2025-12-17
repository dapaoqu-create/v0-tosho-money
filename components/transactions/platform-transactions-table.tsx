"use client"

import { useState, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, ArrowUpDown, Filter } from "lucide-react"
import type { PlatformTransaction, Platform, Property } from "@/lib/types"

interface PlatformTransactionsTableProps {
  transactions: PlatformTransaction[]
  platforms: Platform[]
  properties: Property[]
}

export function PlatformTransactionsTable({ transactions, platforms, properties }: PlatformTransactionsTableProps) {
  const [search, setSearch] = useState("")
  const [platformFilter, setPlatformFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [sortField, setSortField] = useState<"date" | "amount">("date")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  const uniqueTypes = useMemo(() => {
    return [...new Set(transactions.map((t) => t.type).filter(Boolean))]
  }, [transactions])

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((t) => {
        const matchesSearch =
          t.guest_name?.toLowerCase().includes(search.toLowerCase()) ||
          t.confirmation_code?.toLowerCase().includes(search.toLowerCase())
        const matchesPlatform = platformFilter === "all" || t.platform_id === platformFilter
        const matchesType = typeFilter === "all" || t.type === typeFilter
        return matchesSearch && matchesPlatform && matchesType
      })
      .sort((a, b) => {
        if (sortField === "date") {
          return sortOrder === "asc"
            ? new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
            : new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
        }
        return sortOrder === "asc"
          ? (a.payout_amount || 0) - (b.payout_amount || 0)
          : (b.payout_amount || 0) - (a.payout_amount || 0)
      })
  }, [transactions, search, platformFilter, typeFilter, sortField, sortOrder])

  const formatCurrency = (value: number, currency = "JPY") => {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: currency,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-"
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
              placeholder="ゲスト名・確認コードで検索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="プラットフォーム" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              {platforms.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
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
              {uniqueTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => toggleSort("date")}>
                    日付
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>種類</TableHead>
                <TableHead>確認コード</TableHead>
                <TableHead>ゲスト</TableHead>
                <TableHead>宿泊日</TableHead>
                <TableHead>泊数</TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => toggleSort("amount")}>
                    入金額
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>ステータス</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    データがありません
                  </TableCell>
                </TableRow>
              ) : (
                filteredTransactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{formatDate(tx.transaction_date)}</TableCell>
                    <TableCell>
                      <Badge variant={tx.type === "Payout" ? "default" : "secondary"}>{tx.type}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{tx.confirmation_code || "-"}</TableCell>
                    <TableCell>{tx.guest_name || "-"}</TableCell>
                    <TableCell>
                      {tx.check_in_date ? `${formatDate(tx.check_in_date)} - ${formatDate(tx.check_out_date)}` : "-"}
                    </TableCell>
                    <TableCell>{tx.nights || "-"}</TableCell>
                    <TableCell className="text-success font-semibold">
                      {formatCurrency(tx.payout_amount || tx.amount || 0, tx.currency)}
                    </TableCell>
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
