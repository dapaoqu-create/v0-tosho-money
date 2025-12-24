"use client"

import { useChat } from "ai/react"
import { useRef, useEffect } from "react"
import { X, Send, Bot, User, Loader2, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/context"
import Link from "next/link"

interface AiChatDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AiChatDialog({ open, onOpenChange }: AiChatDialogProps) {
  const { t } = useI18n()
  const scrollRef = useRef<HTMLDivElement>(null)

  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages } = useChat({
    api: "/api/ai/chat",
  })

  // 自動滾動到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // 清空對話
  const handleClear = () => {
    setMessages([])
  }

  if (!open) return null

  return (
    <div className="fixed bottom-24 right-6 z-50 w-[400px] max-w-[calc(100vw-48px)] rounded-xl border border-border bg-background shadow-2xl">
      {/* 標題欄 */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
            <Bot className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-semibold">{t("ai.assistant")}</h3>
            <p className="text-xs text-muted-foreground">{t("ai.description")}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={handleClear} className="text-xs">
            {t("ai.clear")}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 對話區域 */}
      <ScrollArea className="h-[400px] p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
            <Bot className="mb-4 h-12 w-12 opacity-50" />
            <p className="text-sm">{t("ai.welcome")}</p>
            <div className="mt-4 space-y-2 text-xs">
              <p className="font-medium">{t("ai.suggestions")}</p>
              <div className="flex flex-wrap justify-center gap-2">
                {[t("ai.suggestion1"), t("ai.suggestion2"), t("ai.suggestion3"), t("ai.suggestion4")].map(
                  (suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        handleInputChange({ target: { value: suggestion } } as any)
                      }}
                      className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted"
                    >
                      {suggestion}
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn("flex gap-3", message.role === "user" ? "flex-row-reverse" : "flex-row")}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    message.role === "user" ? "bg-primary" : "bg-muted",
                  )}
                >
                  {message.role === "user" ? (
                    <User className="h-4 w-4 text-primary-foreground" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                <div
                  className={cn(
                    "max-w-[280px] rounded-xl px-4 py-2 text-sm",
                    message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  <MessageContent content={message.content} toolInvocations={message.toolInvocations} />
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-muted px-4 py-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("ai.thinking")}
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* 輸入區域 */}
      <form onSubmit={handleSubmit} className="border-t border-border p-4">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder={t("ai.placeholder")}
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  )
}

// 訊息內容組件 - 處理工具調用結果
function MessageContent({ content, toolInvocations }: { content: string; toolInvocations?: any[] }) {
  // 渲染工具調用結果
  const renderToolResult = (invocation: any) => {
    if (invocation.state !== "result") return null

    const result = invocation.result

    // 導航連結
    if (invocation.toolName === "navigateTo" && result.url) {
      return (
        <Link
          href={result.url}
          target="_blank"
          className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          {result.description}
        </Link>
      )
    }

    // 搜尋結果
    if (invocation.toolName === "searchTransactions" && result.results) {
      if (result.results.length === 0) {
        return <p className="mt-2 text-xs text-muted-foreground">沒有找到相關交易</p>
      }
      return (
        <div className="mt-2 space-y-1">
          {result.results.slice(0, 5).map((r: any, i: number) => (
            <div key={i} className="rounded border border-border bg-background p-2 text-xs">
              <div className="flex justify-between">
                <span className="font-medium">{r.confirmationCode}</span>
                <span className={r.status === "已對賬" ? "text-green-600" : "text-yellow-600"}>{r.status}</span>
              </div>
              <div className="text-muted-foreground">
                收款: {r.payoutAmount} | {r.fileName}
              </div>
              {r.batchId && r.rowIndex && (
                <Link
                  href={`/dashboard/transactions/platform/${r.batchId}?highlight=${r.confirmationCode}&row=${r.rowIndex}`}
                  target="_blank"
                  className="mt-1 flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  查看詳情
                </Link>
              )}
            </div>
          ))}
        </div>
      )
    }

    // 統計資料
    if (invocation.toolName === "getStatistics") {
      return (
        <div className="mt-2 space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded border border-border bg-background p-2">
              <div className="text-muted-foreground">銀行 CSV</div>
              <div className="text-lg font-bold">{result.bankCsvCount}</div>
            </div>
            <div className="rounded border border-border bg-background p-2">
              <div className="text-muted-foreground">平台 CSV</div>
              <div className="text-lg font-bold">{result.platformCsvCount}</div>
            </div>
          </div>
          <div className="rounded border border-border bg-background p-2">
            <div className="text-muted-foreground">平台對賬率</div>
            <div className="text-lg font-bold">{result.platformTransactions?.rate || 0}%</div>
            <div className="text-muted-foreground">
              {result.platformTransactions?.reconciled || 0} / {result.platformTransactions?.total || 0}
            </div>
          </div>
          <div className="rounded border border-border bg-background p-2">
            <div className="text-muted-foreground">銀行對賬率</div>
            <div className="text-lg font-bold">{result.bankTransactions?.rate || 0}%</div>
            <div className="text-muted-foreground">
              {result.bankTransactions?.reconciled || 0} / {result.bankTransactions?.totalIncome || 0}
            </div>
          </div>
        </div>
      )
    }

    // CSV 清單
    if (invocation.toolName === "getCsvList" && result.files) {
      return (
        <div className="mt-2 space-y-1">
          {result.files.slice(0, 5).map((f: any, i: number) => (
            <div key={i} className="rounded border border-border bg-background p-2 text-xs">
              <div className="flex justify-between">
                <span className="font-medium truncate max-w-[180px]">{f.fileName}</span>
                <span className={f.status === "對賬完成" ? "text-green-600" : "text-yellow-600"}>{f.status}</span>
              </div>
              <div className="text-muted-foreground">
                {f.type} | {f.source} | {f.recordsCount} 筆
              </div>
            </div>
          ))}
        </div>
      )
    }

    // 未對賬交易
    if (invocation.toolName === "getUnreconciledTransactions" && result.transactions) {
      return (
        <div className="mt-2 space-y-1">
          <p className="text-xs text-muted-foreground">
            {result.type}: {result.count} 筆未對賬
          </p>
          {result.transactions.slice(0, 5).map((t: any, i: number) => (
            <div key={i} className="rounded border border-border bg-background p-2 text-xs">
              <div className="font-medium truncate">{t.fileName}</div>
              <div className="text-muted-foreground">
                {t.amount} | {t.date}
              </div>
            </div>
          ))}
        </div>
      )
    }

    return null
  }

  return (
    <div>
      {/* 渲染文字內容 */}
      {content && <div className="whitespace-pre-wrap">{content}</div>}

      {/* 渲染工具調用結果 */}
      {toolInvocations?.map((invocation, i) => (
        <div key={i}>{renderToolResult(invocation)}</div>
      ))}
    </div>
  )
}
