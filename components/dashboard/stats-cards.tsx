"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Wallet, Clock, Calendar, DollarSign } from "lucide-react"
import type { DashboardStats } from "@/lib/types"

interface StatsCardsProps {
  stats: DashboardStats
}

export function StatsCards({ stats }: StatsCardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
      maximumFractionDigits: 0,
    }).format(value)
  }

  const cards = [
    {
      title: "総収入",
      value: formatCurrency(stats.totalRevenue),
      icon: TrendingUp,
      iconColor: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "総支出",
      value: formatCurrency(stats.totalExpenses),
      icon: TrendingDown,
      iconColor: "text-destructive",
      bgColor: "bg-destructive/10",
    },
    {
      title: "純利益",
      value: formatCurrency(stats.netIncome),
      icon: Wallet,
      iconColor: stats.netIncome >= 0 ? "text-success" : "text-destructive",
      bgColor: stats.netIncome >= 0 ? "bg-success/10" : "bg-destructive/10",
    },
    {
      title: "未対帳件数",
      value: stats.pendingReconciliation.toString(),
      icon: Clock,
      iconColor: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      title: "予約件数",
      value: stats.totalBookings.toString(),
      icon: Calendar,
      iconColor: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "平均単価/泊",
      value: formatCurrency(stats.averageNightlyRate),
      icon: DollarSign,
      iconColor: "text-primary",
      bgColor: "bg-primary/10",
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
            <div className={`rounded-full p-2 ${card.bgColor}`}>
              <card.icon className={`h-4 w-4 ${card.iconColor}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
