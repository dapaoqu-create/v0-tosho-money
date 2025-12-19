"use client"

import type React from "react"
import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Upload, FileSpreadsheet, Check, AlertCircle } from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"
import { useLanguage } from "@/lib/i18n/context"

interface DebugInfo {
  headers?: string[]
  firstRows?: string[][]
  rowCount?: number
}

export default function ImportPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState("bank")
  const [bankFile, setBankFile] = useState<File | null>(null)
  const [platformFile, setPlatformFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string; count?: number } | null>(null)
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null)

  const [bankName, setBankName] = useState("")
  const [bankCode, setBankCode] = useState("")
  const [bankMemo, setBankMemo] = useState("")

  const [platformName, setPlatformName] = useState("")
  const [accountName, setAccountName] = useState("")
  const [propertyName, setPropertyName] = useState("")

  const handleBankFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && selectedFile.name.endsWith(".csv")) {
      setBankFile(selectedFile)
      setResult(null)
      setDebugInfo(null)
    }
  }, [])

  const handlePlatformFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && selectedFile.name.endsWith(".csv")) {
      setPlatformFile(selectedFile)
      setResult(null)
      setDebugInfo(null)
    }
  }, [])

  const handleBankImport = async () => {
    console.log("[v0] handleBankImport called", { bankFile, bankName, bankCode })
    if (!bankFile || !bankName || !bankCode) {
      console.log("[v0] Missing required fields for bank import")
      return
    }

    setIsUploading(true)
    setResult(null)
    setDebugInfo(null)

    try {
      const formData = new FormData()
      formData.append("file", bankFile)
      formData.append("type", "bank")
      formData.append("bankName", bankName)
      formData.append("bankCode", bankCode)
      formData.append("memo", bankMemo)

      console.log("[v0] Sending bank import request")
      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      })

      const data = await res.json()
      console.log("[v0] Bank import response:", data)

      if (data.debug) {
        setDebugInfo(data.debug)
      }

      if (!res.ok) {
        throw new Error(data.error || t("import.importError"))
      }

      setResult({
        success: true,
        message: `${data.count}${t("import.importSuccess")}`,
        count: data.count,
      })

      setBankFile(null)
      setBankName("")
      setBankCode("")
      setBankMemo("")
      const fileInput = document.getElementById("bankFile") as HTMLInputElement
      if (fileInput) fileInput.value = ""
      router.refresh()
    } catch (error) {
      console.error("[v0] Bank import error:", error)
      setResult({
        success: false,
        message: error instanceof Error ? error.message : t("errorOccurred"),
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handlePlatformImport = async () => {
    console.log("[v0] handlePlatformImport called", { platformFile, platformName, accountName, propertyName })
    if (!platformFile || !platformName || !accountName || !propertyName) {
      console.log("[v0] Missing required fields for platform import")
      return
    }

    setIsUploading(true)
    setResult(null)
    setDebugInfo(null)

    try {
      const formData = new FormData()
      formData.append("file", platformFile)
      formData.append("type", "platform")
      formData.append("platformName", platformName)
      formData.append("accountName", accountName)
      formData.append("propertyName", propertyName)

      console.log("[v0] Sending platform import request")
      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      })

      const data = await res.json()
      console.log("[v0] Platform import response:", data)

      if (data.debug) {
        setDebugInfo(data.debug)
      }

      if (!res.ok) {
        throw new Error(data.error || t("import.importError"))
      }

      setResult({
        success: true,
        message: `${data.count}${t("import.importSuccess")}`,
        count: data.count,
      })

      setPlatformFile(null)
      setPlatformName("")
      setAccountName("")
      setPropertyName("")
      const fileInput = document.getElementById("platformFile") as HTMLInputElement
      if (fileInput) fileInput.value = ""
      router.refresh()
    } catch (error) {
      console.error("[v0] Platform import error:", error)
      setResult({
        success: false,
        message: error instanceof Error ? error.message : t("errorOccurred"),
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    setResult(null)
    setDebugInfo(null)
  }

  return (
    <div className="space-y-6">
      <DashboardHeader titleKey="import.title" subtitleKey="import.subtitle" />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="bank">{t("import.bankTab")}</TabsTrigger>
          <TabsTrigger value="platform">{t("import.platformTab")}</TabsTrigger>
        </TabsList>

        <TabsContent value="bank" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("import.bankImportTitle")}</CardTitle>
              <CardDescription>{t("import.bankImportDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bankName">{t("import.bankName")} *</Label>
                  <Input
                    id="bankName"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder={t("import.bankNamePlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankCode">{t("import.bankCode")} *</Label>
                  <Input
                    id="bankCode"
                    value={bankCode}
                    onChange={(e) => setBankCode(e.target.value)}
                    placeholder={t("import.bankCodePlaceholder")}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bankMemo">{t("import.memo")}</Label>
                <Input
                  id="bankMemo"
                  value={bankMemo}
                  onChange={(e) => setBankMemo(e.target.value)}
                  placeholder={t("import.memoPlaceholder")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bankFile">{t("import.csvFile")} *</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="bankFile"
                    type="file"
                    accept=".csv"
                    onChange={handleBankFileChange}
                    className="cursor-pointer"
                  />
                </div>
                {bankFile && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    {bankFile.name}
                  </p>
                )}
              </div>

              {result && (
                <div
                  className={`flex items-center gap-2 rounded-lg p-3 ${result.success ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}
                >
                  {result.success ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  {result.message}
                </div>
              )}

              {debugInfo && !result?.success && (
                <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 space-y-3">
                  <p className="font-medium text-yellow-700">CSV 解析調試信息:</p>
                  <div className="text-sm space-y-2">
                    <p>
                      <strong>行數:</strong> {debugInfo.rowCount}
                    </p>
                    <p>
                      <strong>欄位名稱:</strong>
                    </p>
                    <pre className="bg-background/50 p-2 rounded text-xs overflow-x-auto">
                      {JSON.stringify(debugInfo.headers, null, 2)}
                    </pre>
                    <p>
                      <strong>前3行資料:</strong>
                    </p>
                    <pre className="bg-background/50 p-2 rounded text-xs overflow-x-auto max-h-40">
                      {JSON.stringify(debugInfo.firstRows, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              <Button
                onClick={handleBankImport}
                disabled={!bankFile || !bankName || !bankCode || isUploading}
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                {isUploading ? t("import.importing") : t("import.importButton")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="platform" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("import.platformImportTitle")}</CardTitle>
              <CardDescription>{t("import.platformImportDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="platformName">{t("import.platformName")} *</Label>
                  <Input
                    id="platformName"
                    value={platformName}
                    onChange={(e) => setPlatformName(e.target.value)}
                    placeholder={t("import.platformNamePlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountName">{t("import.accountName")} *</Label>
                  <Input
                    id="accountName"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder={t("import.accountNamePlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="propertyName">{t("import.propertyName")} *</Label>
                  <Input
                    id="propertyName"
                    value={propertyName}
                    onChange={(e) => setPropertyName(e.target.value)}
                    placeholder={t("import.propertyNamePlaceholder")}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="platformFile">{t("import.csvFile")} *</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="platformFile"
                    type="file"
                    accept=".csv"
                    onChange={handlePlatformFileChange}
                    className="cursor-pointer"
                  />
                </div>
                {platformFile && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    {platformFile.name}
                  </p>
                )}
              </div>

              {result && (
                <div
                  className={`flex items-center gap-2 rounded-lg p-3 ${result.success ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}
                >
                  {result.success ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  {result.message}
                </div>
              )}

              {debugInfo && !result?.success && (
                <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 space-y-3">
                  <p className="font-medium text-yellow-700">CSV 解析調試信息:</p>
                  <div className="text-sm space-y-2">
                    <p>
                      <strong>行數:</strong> {debugInfo.rowCount}
                    </p>
                    <p>
                      <strong>欄位名稱:</strong>
                    </p>
                    <pre className="bg-background/50 p-2 rounded text-xs overflow-x-auto">
                      {JSON.stringify(debugInfo.headers, null, 2)}
                    </pre>
                    <p>
                      <strong>前3行資料:</strong>
                    </p>
                    <pre className="bg-background/50 p-2 rounded text-xs overflow-x-auto max-h-40">
                      {JSON.stringify(debugInfo.firstRows, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              <Button
                onClick={handlePlatformImport}
                disabled={!platformFile || !platformName || !accountName || !propertyName || isUploading}
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                {isUploading ? t("import.importing") : t("import.importButton")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
