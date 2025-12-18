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

export default function ImportPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState("bank")
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string; count?: number } | null>(null)

  const [bankName, setBankName] = useState("")
  const [bankCode, setBankCode] = useState("")
  const [bankMemo, setBankMemo] = useState("")

  const [platformName, setPlatformName] = useState("")
  const [accountName, setAccountName] = useState("")
  const [propertyName, setPropertyName] = useState("")

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && selectedFile.name.endsWith(".csv")) {
      setFile(selectedFile)
      setResult(null)
    }
  }, [])

  const handleBankImport = async () => {
    if (!file || !bankName || !bankCode) return

    setIsUploading(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", "bank")
      formData.append("bankName", bankName)
      formData.append("bankCode", bankCode)
      formData.append("memo", bankMemo)

      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || t("import.importError"))
      }

      setResult({
        success: true,
        message: `${data.count}${t("import.importSuccess")}`,
        count: data.count,
      })

      setFile(null)
      setBankName("")
      setBankCode("")
      setBankMemo("")
      router.refresh()
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : t("errorOccurred"),
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handlePlatformImport = async () => {
    if (!file || !platformName || !accountName || !propertyName) return

    setIsUploading(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", "platform")
      formData.append("platformName", platformName)
      formData.append("accountName", accountName)
      formData.append("propertyName", propertyName)

      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || t("import.importError"))
      }

      setResult({
        success: true,
        message: `${data.count}${t("import.importSuccess")}`,
        count: data.count,
      })

      setFile(null)
      setPlatformName("")
      setAccountName("")
      setPropertyName("")
      router.refresh()
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : t("errorOccurred"),
      })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <DashboardHeader titleKey="import.title" subtitleKey="import.subtitle" />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
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
                    onChange={handleFileChange}
                    className="cursor-pointer"
                  />
                </div>
                {file && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    {file.name}
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

              <Button
                onClick={handleBankImport}
                disabled={!file || !bankName || !bankCode || isUploading}
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
                    onChange={handleFileChange}
                    className="cursor-pointer"
                  />
                </div>
                {file && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    {file.name}
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

              <Button
                onClick={handlePlatformImport}
                disabled={!file || !platformName || !accountName || !propertyName || isUploading}
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
