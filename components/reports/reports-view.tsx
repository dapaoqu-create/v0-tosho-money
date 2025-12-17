"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileSpreadsheet } from "lucide-react"
import type { PlatformTransaction, BankTransaction } from "@/lib/types"

interface ReportsViewProps {
  platformTransactions: PlatformTransaction[]
  bankTransactions: BankTransaction[]
}

interface MonthlyReport {
  month: string
  revenue: number
  expenses: number
  serviceFees: number
  cleaningFees: number
  accommodationTax: number
  netIncome: number
  bookings: number
}

export function ReportsView({ platformTransactions, bankTransactions }: ReportsViewProps) {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear.toString())
  const [reportType, setReportType] = useState<"monthly" | "annual">("monthly")

  const years = useMemo(() => {
    const yearsSet = new Set<number>()
    platformTransactions.forEach((t) => {
      if (t.revenue_year) yearsSet.add(t.revenue_year)
      if (t.transaction_date) yearsSet.add(new Date(t.transaction_date).getFullYear())
    })
    bankTransactions.forEach((t) => {
      if (t.transaction_date) yearsSet.add(new Date(t.transaction_date).getFullYear())
    })
    return Array.from(yearsSet).sort((a, b) => b - a)
  }, [platformTransactions, bankTransactions])

  const monthlyReports = useMemo(() => {
    const reports: MonthlyReport[] = []
    const year = Number.parseInt(selectedYear)

    for (let month = 1; month <= 12; month++) {
      const monthStr = `${year}年${month}月`

      // Filter platform transactions for this month
      const monthPlatform = platformTransactions.filter((t) => {
        const date = new Date(t.transaction_date)
        return date.getFullYear() === year && date.getMonth() + 1 === month
      })

      // Filter bank transactions for this month
      const monthBank = bankTransactions.filter((t) => {
        const date = new Date(t.transaction_date)
        return date.getFullYear() === year && date.getMonth() + 1 === month
      })

      // Calculate revenue from bookings
      const bookings = monthPlatform.filter((t) => t.type === "預訂")
      const revenue = bookings.reduce((sum, t) => sum + (t.total_revenue || 0), 0)
      const serviceFees = bookings.reduce((sum, t) => sum + (t.service_fee || 0), 0)
      const cleaningFees = bookings.reduce((sum, t) => sum + (t.cleaning_fee || 0), 0)
      const accommodationTax = bookings.reduce((sum, t) => sum + (t.accommodation_tax || 0), 0)

      // Calculate expenses from bank
      const expenses = monthBank.filter((t) => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0)

      reports.push({
        month: monthStr,
        revenue,
        expenses,
        serviceFees,
        cleaningFees,
        accommodationTax,
        netIncome: revenue - expenses - serviceFees,
        bookings: bookings.length,
      })
    }

    return reports
  }, [platformTransactions, bankTransactions, selectedYear])

  const annualSummary = useMemo(() => {
    return monthlyReports.reduce(
      (acc, report) => ({
        revenue: acc.revenue + report.revenue,
        expenses: acc.expenses + report.expenses,
        serviceFees: acc.serviceFees + report.serviceFees,
        cleaningFees: acc.cleaningFees + report.cleaningFees,
        accommodationTax: acc.accommodationTax + report.accommodationTax,
        netIncome: acc.netIncome + report.netIncome,
        bookings: acc.bookings + report.bookings,
      }),
      { revenue: 0, expenses: 0, serviceFees: 0, cleaningFees: 0, accommodationTax: 0, netIncome: 0, bookings: 0 },
    )
  }, [monthlyReports])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
      maximumFractionDigits: 0,
    }).format(value)
  }

  const handleExportCSV = () => {
    const headers = ["月", "売上高", "経費", "サービス料", "清掃費", "宿泊税", "純利益", "予約数"]
    const rows = monthlyReports.map((r) => [
      r.month,
      r.revenue,
      r.expenses,
      r.serviceFees,
      r.cleaningFees,
      r.accommodationTax,
      r.netIncome,
      r.bookings,
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
      "",
      `年間合計,${annualSummary.revenue},${annualSummary.expenses},${annualSummary.serviceFees},${annualSummary.cleaningFees},${annualSummary.accommodationTax},${annualSummary.netIncome},${annualSummary.bookings}`,
    ].join("\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `確定申告用レポート_${selectedYear}年.csv`
    link.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="年度を選択" />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}年
              </SelectItem>
            ))}
            {years.length === 0 && <SelectItem value={currentYear.toString()}>{currentYear}年</SelectItem>}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Button variant="outline" onClick={handleExportCSV}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          CSV出力
        </Button>
      </div>

      {/* Annual Summary */}
      <Card>
        <CardHeader>
          <CardTitle>{selectedYear}年 年間サマリー</CardTitle>
          <CardDescription>確定申告用の年間収支概要</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">総売上高</p>
              <p className="text-2xl font-bold">{formatCurrency(annualSummary.revenue)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">総経費</p>
              <p className="text-2xl font-bold text-destructive">{formatCurrency(annualSummary.expenses)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">サービス料合計</p>
              <p className="text-2xl font-bold">{formatCurrency(annualSummary.serviceFees)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">純利益</p>
              <p className={`text-2xl font-bold ${annualSummary.netIncome >= 0 ? "text-success" : "text-destructive"}`}>
                {formatCurrency(annualSummary.netIncome)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>月別収支明細</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>月</TableHead>
                  <TableHead className="text-right">売上高</TableHead>
                  <TableHead className="text-right">経費</TableHead>
                  <TableHead className="text-right">サービス料</TableHead>
                  <TableHead className="text-right">清掃費</TableHead>
                  <TableHead className="text-right">純利益</TableHead>
                  <TableHead className="text-right">予約数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyReports.map((report) => (
                  <TableRow key={report.month}>
                    <TableCell className="font-medium">{report.month}</TableCell>
                    <TableCell className="text-right">{formatCurrency(report.revenue)}</TableCell>
                    <TableCell className="text-right text-destructive">{formatCurrency(report.expenses)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(report.serviceFees)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(report.cleaningFees)}</TableCell>
                    <TableCell
                      className={`text-right font-semibold ${report.netIncome >= 0 ? "text-success" : "text-destructive"}`}
                    >
                      {formatCurrency(report.netIncome)}
                    </TableCell>
                    <TableCell className="text-right">{report.bookings}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>年間合計</TableCell>
                  <TableCell className="text-right">{formatCurrency(annualSummary.revenue)}</TableCell>
                  <TableCell className="text-right text-destructive">
                    {formatCurrency(annualSummary.expenses)}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(annualSummary.serviceFees)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(annualSummary.cleaningFees)}</TableCell>
                  <TableCell
                    className={`text-right ${annualSummary.netIncome >= 0 ? "text-success" : "text-destructive"}`}
                  >
                    {formatCurrency(annualSummary.netIncome)}
                  </TableCell>
                  <TableCell className="text-right">{annualSummary.bookings}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
