"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, RefreshCcw, AlertCircle } from "lucide-react"
import type { PlatformTransaction, BankTransaction } from "@/lib/types"

interface ReconciliationViewProps {
  platformPayouts: PlatformTransaction[]
  bankIncome: BankTransaction[]
}

export function ReconciliationView({ platformPayouts, bankIncome }: ReconciliationViewProps) {
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
  const [selectedBank, setSelectedBank] = useState<string | null>(null)

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

  const handleAutoReconcile = async () => {
    setIsProcessing(true)
    try {
      const res = await fetch("/api/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "auto" }),
      })

      if (res.ok) {
        router.refresh()
      }
    } catch (error) {
      console.error("Reconciliation error:", error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleManualReconcile = async () => {
    if (!selectedPlatform || !selectedBank) return

    setIsProcessing(true)
    try {
      const res = await fetch("/api/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "manual",
          platformId: selectedPlatform,
          bankId: selectedBank,
        }),
      })

      if (res.ok) {
        setSelectedPlatform(null)
        setSelectedBank(null)
        router.refresh()
      }
    } catch (error) {
      console.error("Reconciliation error:", error)
    } finally {
      setIsProcessing(false)
    }
  }

  // Find potential matches
  const findMatches = (payout: PlatformTransaction) => {
    const payoutAmount = Math.round(payout.payout_amount || 0)
    const payoutDate = new Date(payout.payout_date || payout.transaction_date)

    return bankIncome.filter((bank) => {
      const bankAmount = Math.round(bank.amount)
      const bankDate = new Date(bank.transaction_date)
      const daysDiff = Math.abs(payoutDate.getTime() - bankDate.getTime()) / (1000 * 60 * 60 * 24)

      // Match if amount is similar (within 1%) and date is within 5 days
      const amountDiff = Math.abs(payoutAmount - bankAmount)
      const amountMatch = amountDiff <= Math.max(payoutAmount * 0.01, 100)
      const dateMatch = daysDiff <= 5

      return amountMatch && dateMatch
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button onClick={handleAutoReconcile} disabled={isProcessing}>
          <RefreshCcw className={`mr-2 h-4 w-4 ${isProcessing ? "animate-spin" : ""}`} />
          自動対帳を実行
        </Button>
        <p className="text-sm text-muted-foreground">金額と日付が一致する取引を自動的にマッチングします</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Platform Payouts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>未対帳の入金（プラットフォーム）</span>
              <Badge variant="outline">{platformPayouts.length}件</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {platformPayouts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">未対帳の入金はありません</p>
              ) : (
                platformPayouts.map((payout) => {
                  const matches = findMatches(payout)
                  const isSelected = selectedPlatform === payout.id

                  return (
                    <div
                      key={payout.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedPlatform(isSelected ? null : payout.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{formatCurrency(payout.payout_amount || 0, payout.currency)}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(payout.payout_date || payout.transaction_date)}
                          </p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {payout.details || payout.platform?.name}
                          </p>
                        </div>
                        {matches.length > 0 ? (
                          <Badge variant="secondary" className="shrink-0">
                            {matches.length}件の候補
                          </Badge>
                        ) : (
                          <AlertCircle className="h-4 w-4 text-warning shrink-0" />
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bank Income */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>未対帳の入金（銀行）</span>
              <Badge variant="outline">{bankIncome.length}件</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {bankIncome.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">未対帳の入金はありません</p>
              ) : (
                bankIncome.map((bank) => {
                  const isSelected = selectedBank === bank.id

                  return (
                    <div
                      key={bank.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedBank(isSelected ? null : bank.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-success">{formatCurrency(bank.amount)}</p>
                          <p className="text-sm text-muted-foreground">{formatDate(bank.transaction_date)}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{bank.description}</p>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{bank.bank?.name}</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Manual reconciliation action */}
      {selectedPlatform && selectedBank && (
        <div className="flex items-center justify-center">
          <Button onClick={handleManualReconcile} disabled={isProcessing}>
            <Check className="mr-2 h-4 w-4" />
            選択した取引を対帳
          </Button>
        </div>
      )}
    </div>
  )
}
