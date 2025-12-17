"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2 } from "lucide-react"
import type { Bank, Platform, Property } from "@/lib/types"

interface SettingsViewProps {
  banks: Bank[]
  platforms: Platform[]
  properties: (Property & { platform?: { name: string } })[]
}

export function SettingsView({ banks, platforms, properties }: SettingsViewProps) {
  const router = useRouter()
  const [newBankName, setNewBankName] = useState("")
  const [newPlatform, setNewPlatform] = useState({ name: "", account_name: "" })
  const [isLoading, setIsLoading] = useState(false)

  const handleAddBank = async () => {
    if (!newBankName) return
    setIsLoading(true)
    try {
      const res = await fetch("/api/settings/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newBankName }),
      })
      if (res.ok) {
        setNewBankName("")
        router.refresh()
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteBank = async (id: string) => {
    if (!confirm("この銀行を削除しますか？関連する取引データも削除されます。")) return
    try {
      await fetch(`/api/settings/banks?id=${id}`, { method: "DELETE" })
      router.refresh()
    } catch (error) {
      console.error(error)
    }
  }

  const handleAddPlatform = async () => {
    if (!newPlatform.name) return
    setIsLoading(true)
    try {
      const res = await fetch("/api/settings/platforms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPlatform),
      })
      if (res.ok) {
        setNewPlatform({ name: "", account_name: "" })
        router.refresh()
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeletePlatform = async (id: string) => {
    if (!confirm("このプラットフォームを削除しますか？関連する取引データも削除されます。")) return
    try {
      await fetch(`/api/settings/platforms?id=${id}`, { method: "DELETE" })
      router.refresh()
    } catch (error) {
      console.error(error)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ja-JP")
  }

  return (
    <Tabs defaultValue="banks">
      <TabsList className="grid w-full max-w-md grid-cols-3">
        <TabsTrigger value="banks">銀行</TabsTrigger>
        <TabsTrigger value="platforms">プラットフォーム</TabsTrigger>
        <TabsTrigger value="properties">物件</TabsTrigger>
      </TabsList>

      <TabsContent value="banks" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>銀行一覧</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Input placeholder="銀行名を入力" value={newBankName} onChange={(e) => setNewBankName(e.target.value)} />
              <Button onClick={handleAddBank} disabled={!newBankName || isLoading}>
                <Plus className="mr-2 h-4 w-4" />
                追加
              </Button>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>銀行名</TableHead>
                    <TableHead>作成日</TableHead>
                    <TableHead className="w-[100px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {banks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        銀行が登録されていません
                      </TableCell>
                    </TableRow>
                  ) : (
                    banks.map((bank) => (
                      <TableRow key={bank.id}>
                        <TableCell className="font-medium">{bank.name}</TableCell>
                        <TableCell>{formatDate(bank.created_at)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteBank(bank.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="platforms" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>プラットフォーム一覧</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Input
                placeholder="プラットフォーム名"
                value={newPlatform.name}
                onChange={(e) => setNewPlatform({ ...newPlatform, name: e.target.value })}
              />
              <Input
                placeholder="アカウント名"
                value={newPlatform.account_name}
                onChange={(e) => setNewPlatform({ ...newPlatform, account_name: e.target.value })}
              />
              <Button onClick={handleAddPlatform} disabled={!newPlatform.name || isLoading}>
                <Plus className="mr-2 h-4 w-4" />
                追加
              </Button>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>プラットフォーム名</TableHead>
                    <TableHead>アカウント名</TableHead>
                    <TableHead>作成日</TableHead>
                    <TableHead className="w-[100px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {platforms.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        プラットフォームが登録されていません
                      </TableCell>
                    </TableRow>
                  ) : (
                    platforms.map((platform) => (
                      <TableRow key={platform.id}>
                        <TableCell className="font-medium">{platform.name}</TableCell>
                        <TableCell>{platform.account_name || "-"}</TableCell>
                        <TableCell>{formatDate(platform.created_at)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleDeletePlatform(platform.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="properties" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>物件一覧</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>物件名</TableHead>
                    <TableHead>プラットフォーム</TableHead>
                    <TableHead>作成日</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {properties.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        物件が登録されていません
                      </TableCell>
                    </TableRow>
                  ) : (
                    properties.map((property) => (
                      <TableRow key={property.id}>
                        <TableCell className="font-medium">{property.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{property.platform?.name || "-"}</Badge>
                        </TableCell>
                        <TableCell>{formatDate(property.created_at)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
