"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { BankTransaction, PlatformTransaction } from "@/lib/types"

interface RecentTransactionsProps {
  bankTransactions: BankTransaction[]
  platformTransactions: PlatformTransaction[]
}

export function RecentTransactions({ bankTransactions, platformTransactions }: RecentTransactionsProps) {
  const formatCurrency = (value: number, currency = "JPY") => {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: currency,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ja-JP")
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">最近の銀行取引</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {bankTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">取引データがありません</p>
            ) : (
              bankTransactions.slice(0, 5).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between border-b border-border pb-2 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tx.description || "不明"}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(tx.transaction_date)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${tx.amount >= 0 ? "text-success" : "text-destructive"}`}>
                      {formatCurrency(tx.amount)}
                    </span>
                    {tx.reconciled ? (
                      <Badge variant="secondary" className="text-xs">
                        対帳済
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        未対帳
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">最近のプラットフォーム取引</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {platformTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">取引データがありません</p>
            ) : (
              platformTransactions.slice(0, 5).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between border-b border-border pb-2 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tx.guest_name || tx.confirmation_code || "予約"}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(tx.transaction_date)} · {tx.type}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-success">
                      {formatCurrency(tx.payout_amount || tx.amount || 0, tx.currency)}
                    </span>
                    {tx.reconciled ? (
                      <Badge variant="secondary" className="text-xs">
                        対帳済
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        未対帳
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
