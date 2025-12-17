import { createClient } from "@/lib/supabase/server"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { DailyChart } from "@/components/dashboard/daily-chart"
import { RecentTransactions } from "@/components/dashboard/recent-transactions"
import type { DashboardStats, MonthlyData, DailyData } from "@/lib/types"

async function getDashboardData() {
  const supabase = await createClient()

  // Get bank transactions
  const { data: bankTransactions } = await supabase
    .from("bank_transactions")
    .select("*, bank:banks(*)")
    .order("transaction_date", { ascending: false })
    .limit(100)

  // Get platform transactions
  const { data: platformTransactions } = await supabase
    .from("platform_transactions")
    .select("*, platform:platforms(*), property:properties(*)")
    .order("transaction_date", { ascending: false })
    .limit(100)

  // Calculate stats
  const totalRevenue = (bankTransactions || [])
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const totalExpenses = Math.abs(
    (bankTransactions || []).filter((t) => t.amount < 0).reduce((sum, t) => sum + Number(t.amount), 0),
  )

  const pendingReconciliation = (platformTransactions || []).filter((t) => !t.reconciled && t.type === "Payout").length

  const bookings = (platformTransactions || []).filter((t) => t.type === "預訂")
  const totalBookings = bookings.length

  const totalNights = bookings.reduce((sum, t) => sum + (t.nights || 0), 0)
  const totalBookingRevenue = bookings.reduce((sum, t) => sum + (Number(t.total_revenue) || 0), 0)
  const averageNightlyRate = totalNights > 0 ? totalBookingRevenue / totalNights : 0

  const stats: DashboardStats = {
    totalRevenue,
    totalExpenses,
    netIncome: totalRevenue - totalExpenses,
    pendingReconciliation,
    totalBookings,
    averageNightlyRate,
  }

  // Generate monthly data
  const monthlyMap = new Map<string, { revenue: number; expenses: number }>()
  const months = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]

  months.forEach((month) => {
    monthlyMap.set(month, { revenue: 0, expenses: 0 })
  })
  ;(bankTransactions || []).forEach((t) => {
    const date = new Date(t.transaction_date)
    const monthKey = `${date.getMonth() + 1}月`
    const current = monthlyMap.get(monthKey) || { revenue: 0, expenses: 0 }

    if (t.amount > 0) {
      current.revenue += Number(t.amount)
    } else {
      current.expenses += Math.abs(Number(t.amount))
    }

    monthlyMap.set(monthKey, current)
  })

  const monthlyData: MonthlyData[] = months.map((month) => ({
    month,
    ...monthlyMap.get(month)!,
  }))

  // Generate daily data (last 30 days)
  const dailyMap = new Map<string, number>()
  const today = new Date()

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateKey = `${date.getMonth() + 1}/${date.getDate()}`
    dailyMap.set(dateKey, 0)
  }
  ;(bankTransactions || []).forEach((t) => {
    if (t.amount > 0) {
      const date = new Date(t.transaction_date)
      const dateKey = `${date.getMonth() + 1}/${date.getDate()}`
      if (dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + Number(t.amount))
      }
    }
  })

  const dailyData: DailyData[] = Array.from(dailyMap.entries()).map(([date, revenue]) => ({
    date,
    revenue,
  }))

  return {
    stats,
    monthlyData,
    dailyData,
    bankTransactions: bankTransactions || [],
    platformTransactions: platformTransactions || [],
  }
}

export default async function DashboardPage() {
  const { stats, monthlyData, dailyData, bankTransactions, platformTransactions } = await getDashboardData()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">ダッシュボード</h1>
        <p className="text-muted-foreground">財務状況の概要</p>
      </div>

      <StatsCards stats={stats} />

      <div className="grid gap-6 lg:grid-cols-2">
        <RevenueChart data={monthlyData} title="月次収支推移" />
        <DailyChart data={dailyData} title="日次収入（直近30日）" />
      </div>

      <RecentTransactions bankTransactions={bankTransactions} platformTransactions={platformTransactions} />
    </div>
  )
}
