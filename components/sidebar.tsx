"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/i18n/context"
import {
  LayoutDashboard,
  FileSpreadsheet,
  Upload,
  RefreshCcw,
  FileText,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Building2,
  CreditCard,
  CheckCircle2,
  StickyNote,
  Landmark,
} from "lucide-react"

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useLanguage()

  const navigation = [
    { name: t("nav.dashboard"), href: "/dashboard", icon: LayoutDashboard },
    { name: t("nav.bankAccounts"), href: "/dashboard/bank-accounts", icon: Landmark },
    { name: t("nav.bankTransactions"), href: "/dashboard/bank-transactions", icon: CreditCard },
    { name: t("nav.platformTransactions"), href: "/dashboard/platform-transactions", icon: Building2 },
    { name: t("nav.import"), href: "/dashboard/import", icon: Upload },
    { name: t("nav.reconciliation"), href: "/dashboard/reconciliation", icon: RefreshCcw },
    { name: t("nav.confirmationCheck"), href: "/dashboard/confirmation-check", icon: CheckCircle2 },
    { name: t("nav.memos"), href: "/dashboard/memos", icon: StickyNote },
    { name: t("nav.reports"), href: "/dashboard/reports", icon: FileText },
    { name: t("nav.statistics"), href: "/dashboard/statistics", icon: BarChart3 },
    { name: t("nav.users"), href: "/dashboard/users", icon: Users },
    { name: t("nav.settings"), href: "/dashboard/settings", icon: Settings },
  ]

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
  }

  return (
    <div className="flex h-full w-64 flex-col bg-card border-r border-border">
      <div className="flex h-16 items-center border-b border-border px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <FileSpreadsheet className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold">TOSHO Money</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-border p-3">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-5 w-5" />
          {t("nav.logout")}
        </button>
      </div>
    </div>
  )
}
