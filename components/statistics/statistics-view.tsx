"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts"
import type { PlatformTransaction, BankTransaction, Property } from "@/lib/types"

interface StatisticsViewProps {
  platformTransactions: PlatformTransaction[]
  bankTransactions: BankTransaction[]
  properties: Property[]
}

const COLORS = ["#18181b", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"]

export function StatisticsView({ platformTransactions, bankTransactions, properties }: StatisticsViewProps) {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear.toString())
  const [viewMode, setViewMode] = useState<"monthly" | "yearly">("monthly")

  const years = useMemo(() => {
    const yearsSet = new Set<number>()
    platformTransactions.forEach((t) => {
      if (t.transaction_date) yearsSet.add(new Date(t.transaction_date).getFullYear())
    })
    bankTransactions.forEach((t) => {
      if (t.transaction_date) yearsSet.add(new Date(t.transaction_date).getFullYear())
    })
    return Array.from(yearsSet).sort((a, b) => b - a)
  }, [platformTransactions, bankTransactions])

  const monthlyData = useMemo(() => {
    const year = Number.parseInt(selectedYear)
    const data = []

    for (let month = 1; month <= 12; month++) {
      const monthPlatform = platformTransactions.filter((t) => {
        const date = new Date(t.transaction_date)
        return date.getFullYear() === year && date.getMonth() + 1 === month
      })

      const monthBank = bankTransactions.filter((t) => {
        const date = new Date(t.transaction_date)
        return date.getFullYear() === year && date.getMonth() + 1 === month
      })

      const bookings = monthPlatform.filter((t) => t.type === "預訂")
      const revenue = bookings.reduce((sum, t) => sum + (t.total_revenue || 0), 0)
      const expenses = monthBank.filter((t) => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0)

      data.push({
        month: `${month}月`,
        revenue,
        expenses,
        profit: revenue - expenses,
        bookings: bookings.length,
      })
    }

    return data
  }, [platformTransactions, bankTransactions, selectedYear])

  const expenseBreakdown = useMemo(() => {
    const year = Number.parseInt(selectedYear)
    const expenses: Record<string, number> = {}

    bankTransactions
      .filter((t) => {
        const date = new Date(t.transaction_date)
        return date.getFullYear() === year && t.amount < 0
      })
      .forEach((t) => {
        let category = "その他"
        const desc = t.description?.toLowerCase() || ""

        if (desc.includes("デビット") || desc.includes("jcb")) {
          category = "カード決済"
        } else if (desc.includes("振込")) {
          category = "振込"
        } else if (desc.includes("手数料")) {
          category = "手数料"
        } else if (desc.includes("ペイオニア") || desc.includes("payoneer")) {
          // Skip - this is income
          return
        }

        expenses[category] = (expenses[category] || 0) + Math.abs(t.amount)
      })

    return Object.entries(expenses).map(([name, value]) => ({ name, value }))
  }, [bankTransactions, selectedYear])

  const revenueByProperty = useMemo(() => {
    const year = Number.parseInt(selectedYear)
    const revenueMap: Record<string, number> = {}

    platformTransactions
      .filter((t) => {
        const date = new Date(t.transaction_date)
        return date.getFullYear() === year && t.type === "預訂"
      })
      .forEach((t) => {
        const propertyName = (t.raw_data?.["房源"] as string) || "その他"
        revenueMap[propertyName] = (revenueMap[propertyName] || 0) + (t.total_revenue || 0)
      })

    return Object.entries(revenueMap)
      .map(([name, value]) => ({ name: name.substring(0, 20), value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
  }, [platformTransactions, selectedYear])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
      maximumFractionDigits: 0,
      notation: "compact",
    }).format(value)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
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

        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "monthly" | "yearly")}>
          <TabsList>
            <TabsTrigger value="monthly">月別</TabsTrigger>
            <TabsTrigger value="yearly">年別</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue vs Expenses */}
        <Card>
          <CardHeader>
            <CardTitle>月別収支推移</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fill: "currentColor" }} className="text-xs" />
                  <YAxis tick={{ fill: "currentColor" }} tickFormatter={formatCurrency} className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                  <Bar dataKey="revenue" fill="#22c55e" name="収入" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" fill="#ef4444" name="支出" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Profit Trend */}
        <Card>
          <CardHeader>
            <CardTitle>利益推移</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fill: "currentColor" }} className="text-xs" />
                  <YAxis tick={{ fill: "currentColor" }} tickFormatter={formatCurrency} className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    stroke="#18181b"
                    strokeWidth={2}
                    dot={{ fill: "#18181b" }}
                    name="利益"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Expense Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>支出内訳</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {expenseBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Revenue by Property */}
        <Card>
          <CardHeader>
            <CardTitle>物件別収入</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByProperty} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    type="number"
                    tick={{ fill: "currentColor" }}
                    tickFormatter={formatCurrency}
                    className="text-xs"
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: "currentColor" }}
                    className="text-xs"
                    width={150}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Bar dataKey="value" fill="#18181b" radius={[0, 4, 4, 0]} name="収入" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Booking Stats */}
      <Card>
        <CardHeader>
          <CardTitle>予約数推移</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fill: "currentColor" }} className="text-xs" />
                <YAxis tick={{ fill: "currentColor" }} className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="bookings" fill="#3b82f6" radius={[4, 4, 0, 0]} name="予約数" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
