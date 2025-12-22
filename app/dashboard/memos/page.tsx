"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Plus, Pencil, Trash2, Building2, CreditCard, StickyNote } from "lucide-react"
import { useLanguage } from "@/lib/i18n/context"
import { toast } from "sonner"

interface Memo {
  id: string
  source_type: "bank" | "platform"
  bank_name: string | null
  platform_name: string | null
  content: string
  created_at: string
  updated_at: string
}

export default function MemosPage() {
  const { t } = useLanguage()
  const [memos, setMemos] = useState<Memo[]>([])
  const [bankNames, setBankNames] = useState<string[]>([])
  const [platformNames, setPlatformNames] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  // 新增備忘狀態
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [sourceType, setSourceType] = useState<"bank" | "platform">("bank")
  const [selectedBank, setSelectedBank] = useState("")
  const [selectedPlatform, setSelectedPlatform] = useState("")
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)

  // 編輯備忘狀態
  const [editingMemo, setEditingMemo] = useState<Memo | null>(null)
  const [editContent, setEditContent] = useState("")

  // 刪除確認
  const [deletingMemo, setDeletingMemo] = useState<Memo | null>(null)

  useEffect(() => {
    fetchMemos()
    fetchSources()
  }, [])

  const fetchMemos = async () => {
    try {
      const res = await fetch("/api/memos")
      const data = await res.json()
      if (data.memos) {
        setMemos(data.memos)
      }
    } catch (error) {
      console.error("Failed to fetch memos:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSources = async () => {
    try {
      const res = await fetch("/api/memos/sources")
      const data = await res.json()
      if (data.bankNames) setBankNames(data.bankNames)
      if (data.platformNames) setPlatformNames(data.platformNames)
    } catch (error) {
      console.error("Failed to fetch sources:", error)
    }
  }

  const handleAdd = async () => {
    if (!content.trim()) {
      toast.error(t("memo.contentRequired"))
      return
    }

    if (sourceType === "bank" && !selectedBank) {
      toast.error(t("memo.bankRequired"))
      return
    }

    if (sourceType === "platform" && !selectedPlatform) {
      toast.error(t("memo.platformRequired"))
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/memos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_type: sourceType,
          bank_name: sourceType === "bank" ? selectedBank : null,
          platform_name: sourceType === "platform" ? selectedPlatform : null,
          content: content.trim(),
        }),
      })

      if (res.ok) {
        toast.success(t("memo.addSuccess"))
        setShowAddDialog(false)
        setContent("")
        setSelectedBank("")
        setSelectedPlatform("")
        fetchMemos()
      } else {
        toast.error(t("memo.addError"))
      }
    } catch (error) {
      toast.error(t("memo.addError"))
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async () => {
    if (!editingMemo || !editContent.trim()) return

    setSaving(true)
    try {
      const res = await fetch(`/api/memos/${editingMemo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent.trim() }),
      })

      if (res.ok) {
        toast.success(t("memo.editSuccess"))
        setEditingMemo(null)
        setEditContent("")
        fetchMemos()
      } else {
        toast.error(t("memo.editError"))
      }
    } catch (error) {
      toast.error(t("memo.editError"))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingMemo) return

    try {
      const res = await fetch(`/api/memos/${deletingMemo.id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        toast.success(t("memo.deleteSuccess"))
        setDeletingMemo(null)
        fetchMemos()
      } else {
        toast.error(t("memo.deleteError"))
      }
    } catch (error) {
      toast.error(t("memo.deleteError"))
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString()
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("memo.title")}</h1>
          <p className="text-muted-foreground">{t("memo.description")}</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("memo.add")}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">{t("common.loading")}</div>
        </div>
      ) : memos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <StickyNote className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t("memo.empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {memos.map((memo) => (
            <Card key={memo.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge
                    variant={memo.source_type === "bank" ? "default" : "secondary"}
                    className="flex items-center gap-1"
                  >
                    {memo.source_type === "bank" ? (
                      <>
                        <CreditCard className="h-3 w-3" />
                        {t("memo.bankCsv")}
                      </>
                    ) : (
                      <>
                        <Building2 className="h-3 w-3" />
                        {t("memo.platformCsv")}
                      </>
                    )}
                  </Badge>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditingMemo(memo)
                        setEditContent(memo.content)
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeletingMemo(memo)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardTitle className="text-base">
                  {memo.source_type === "bank" ? memo.bank_name : memo.platform_name}
                </CardTitle>
                <CardDescription className="text-xs">{formatDate(memo.updated_at)}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{memo.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 新增備忘對話框 */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t("memo.add")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("memo.sourceType")}</Label>
              <Select
                value={sourceType}
                onValueChange={(v) => {
                  setSourceType(v as "bank" | "platform")
                  setSelectedBank("")
                  setSelectedPlatform("")
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      {t("memo.bankCsv")}
                    </div>
                  </SelectItem>
                  <SelectItem value="platform">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {t("memo.platformCsv")}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {sourceType === "bank" && (
              <div className="space-y-2">
                <Label>{t("memo.selectBank")}</Label>
                <Select value={selectedBank} onValueChange={setSelectedBank}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("memo.selectBankPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {bankNames.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {sourceType === "platform" && (
              <div className="space-y-2">
                <Label>{t("memo.selectPlatform")}</Label>
                <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("memo.selectPlatformPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {platformNames.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>{t("memo.content")}</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t("memo.contentPlaceholder")}
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleAdd} disabled={saving}>
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 編輯備忘對話框 */}
      <Dialog open={!!editingMemo} onOpenChange={() => setEditingMemo(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t("memo.edit")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <Badge variant={editingMemo?.source_type === "bank" ? "default" : "secondary"}>
                {editingMemo?.source_type === "bank" ? t("memo.bankCsv") : t("memo.platformCsv")}
              </Badge>
              <span className="font-medium">
                {editingMemo?.source_type === "bank" ? editingMemo?.bank_name : editingMemo?.platform_name}
              </span>
            </div>
            <div className="space-y-2">
              <Label>{t("memo.content")}</Label>
              <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={5} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMemo(null)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 刪除確認對話框 */}
      <AlertDialog open={!!deletingMemo} onOpenChange={() => setDeletingMemo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("memo.deleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>{t("memo.deleteConfirmDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
