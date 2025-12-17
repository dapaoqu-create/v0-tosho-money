import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, BarChart3, FileSpreadsheet, RefreshCcw, Shield } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

        <header className="relative z-10 border-b border-border">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <FileSpreadsheet className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">TOSHO Money</span>
            </div>
            <Link href="/login">
              <Button>登入系統</Button>
            </Link>
          </div>
        </header>

        <main className="relative z-10">
          <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
            <div className="text-center">
              <div className="mb-6 inline-flex items-center rounded-full border border-border bg-muted/50 px-4 py-1.5 text-sm">
                <span className="mr-2 h-2 w-2 rounded-full bg-green-500" />
                不動産賃貸事業向け財務管理
              </div>

              <h1 className="text-4xl font-bold tracking-tight sm:text-6xl text-balance">
                賃貸収入を
                <br />
                スマートに管理
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground text-pretty">
                Airbnb、楽天銀行などの複数プラットフォームからのCSVを統合し、
                自動対帳機能で入金確認を効率化。日本の確定申告に対応したレポート出力も可能です。
              </p>

              <div className="mt-10 flex items-center justify-center gap-4">
                <Link href="/login">
                  <Button size="lg" className="gap-2">
                    今すぐ始める
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <FileSpreadsheet className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold">CSV自動取込</h3>
                <p className="text-sm text-muted-foreground">
                  銀行・プラットフォームのCSVを自動認識し、新しい形式にも対応
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <RefreshCcw className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold">自動対帳</h3>
                <p className="text-sm text-muted-foreground">
                  銀行入金とプラットフォーム売上を自動マッチングし、未入金を検出
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold">統計・レポート</h3>
                <p className="text-sm text-muted-foreground">
                  月次・年次の収支レポートを自動生成、確定申告用フォーマットで出力
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold">ユーザー管理</h3>
                <p className="text-sm text-muted-foreground">複数ユーザーでの利用に対応、権限管理で安全に運用</p>
              </div>
            </div>
          </div>
        </main>

        <footer className="border-t border-border py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <p className="text-center text-sm text-muted-foreground">© 2025 TOSHO Money. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </div>
  )
}
