import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

function parseCSV(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.split(/\r?\n/).filter((line) => line.trim())

  let headerIndex = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.includes(",") && !line.match(/^\d{4}\.\d{2}/)) {
      headerIndex = i
      break
    }
  }

  const headers = lines[headerIndex].split(",").map((h) => h.trim().replace(/"/g, ""))
  const rows = lines.slice(headerIndex + 1).map((line) => {
    const result: string[] = []
    let current = ""
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === "," && !inQuotes) {
        result.push(current.trim())
        current = ""
      } else {
        current += char
      }
    }
    result.push(current.trim())

    return result
  })

  return { headers, rows }
}

function parseDate(dateStr: string): string | null {
  if (!dateStr) return null

  if (/^\d{8}$/.test(dateStr)) {
    const year = dateStr.slice(0, 4)
    const month = dateStr.slice(4, 6)
    const day = dateStr.slice(6, 8)
    return `${year}-${month}-${day}`
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
    const [month, day, year] = dateStr.split("/")
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr
  }

  return null
}

function parseNumber(numStr: string): number {
  if (!numStr) return 0
  const cleaned = numStr.replace(/[¥,$,円,\s]/g, "").replace(/,/g, "")
  const num = Number.parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

function generateTransactionCode(bankCode: string, dateStr: string, amount: number): string {
  const date = dateStr.replace(/-/g, "").slice(2)
  const amountStr = Math.abs(amount).toString()
  const last4 = amountStr.slice(-4).padStart(4, "0")
  return `${bankCode}${date}${last4}`
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const batchId = formData.get("batchId") as string
    const mode = formData.get("mode") as "merge" | "replace"
    const type = formData.get("type") as "bank" | "platform"

    if (!file || !batchId || !mode || !type) {
      return NextResponse.json({ error: "必要なパラメータが不足しています" }, { status: 400 })
    }

    const content = await file.text()
    const { headers, rows } = parseCSV(content)

    const supabase = await createClient()

    // Get batch info
    const { data: batch, error: batchError } = await supabase
      .from("csv_import_batches")
      .select("*")
      .eq("id", batchId)
      .single()

    if (batchError || !batch) {
      return NextResponse.json({ error: "バッチが見つかりません" }, { status: 404 })
    }

    if (type === "bank") {
      // Delete existing transactions if replace mode
      if (mode === "replace") {
        await supabase.from("bank_transactions").delete().eq("batch_id", batchId)
      }

      const dateIndex = headers.findIndex((h) => h.includes("取引日"))
      const amountIndex = headers.findIndex((h) => h.includes("入出金"))
      const balanceIndex = headers.findIndex((h) => h.includes("残高"))
      const descIndex = headers.findIndex((h) => h.includes("入出金先"))

      let newCount = 0
      let skippedCount = 0

      for (const row of rows) {
        if (row.length < 3 || !row[dateIndex]) continue

        const amount = parseNumber(row[amountIndex] || "0")
        const transactionDate = parseDate(row[dateIndex])
        if (!transactionDate) continue

        // For merge mode, check if transaction exists (same date and amount)
        if (mode === "merge") {
          const { data: existing } = await supabase
            .from("bank_transactions")
            .select("id")
            .eq("batch_id", batchId)
            .eq("transaction_date", transactionDate)
            .eq("amount", amount)
            .single()

          if (existing) {
            skippedCount++
            continue
          }
        }

        const transactionCode = generateTransactionCode(batch.bank_code, transactionDate, amount)

        await supabase.from("bank_transactions").insert({
          bank_id: batch.bank_id,
          batch_id: batchId,
          transaction_date: transactionDate,
          amount,
          balance: parseNumber(row[balanceIndex] || "0"),
          description: row[descIndex] || "",
          is_income: amount > 0,
          transaction_code: transactionCode,
          raw_data: Object.fromEntries(headers.map((h, i) => [h, row[i]])),
        })

        newCount++
      }

      // Update batch file name and count
      const { data: countResult } = await supabase
        .from("bank_transactions")
        .select("id", { count: "exact" })
        .eq("batch_id", batchId)

      await supabase
        .from("csv_import_batches")
        .update({
          file_name: file.name,
          records_count: countResult?.length || 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", batchId)

      return NextResponse.json({
        success: true,
        message: mode === "merge" ? `${newCount}件追加、${skippedCount}件スキップ` : `${newCount}件で更新しました`,
      })
    }

    if (type === "platform") {
      // Delete existing transactions if replace mode
      if (mode === "replace") {
        await supabase.from("platform_transactions").delete().eq("batch_id", batchId)
      }

      const headerMap: Record<string, number> = {}
      headers.forEach((h, i) => {
        headerMap[h] = i
      })

      let newCount = 0
      let skippedCount = 0

      for (const row of rows) {
        const getValue = (key: string) => row[headerMap[key]] || ""
        const transactionDate = parseDate(getValue("日期"))
        if (!transactionDate) continue

        const confirmationCode = getValue("確認碼")

        // For merge mode, check if transaction exists (same confirmation code)
        if (mode === "merge" && confirmationCode) {
          const { data: existing } = await supabase
            .from("platform_transactions")
            .select("id")
            .eq("batch_id", batchId)
            .eq("confirmation_code", confirmationCode)
            .single()

          if (existing) {
            skippedCount++
            continue
          }
        }

        await supabase.from("platform_transactions").insert({
          platform_id: batch.platform_id,
          property_id: batch.property_id,
          batch_id: batchId,
          transaction_date: transactionDate,
          payout_date: parseDate(getValue("入帳日期")),
          type: getValue("類型"),
          confirmation_code: confirmationCode,
          booking_date: parseDate(getValue("預訂日期")),
          check_in_date: parseDate(getValue("開始日期")),
          check_out_date: parseDate(getValue("結束日期")),
          nights: Number.parseInt(getValue("晚")) || 0,
          guest_name: getValue("客人"),
          currency: getValue("幣別") || "JPY",
          amount: parseNumber(getValue("金額")),
          payout_amount: parseNumber(getValue("收款")),
          service_fee: parseNumber(getValue("服務費")),
          fast_pay_fee: parseNumber(getValue("快速收款手續費")),
          cleaning_fee: parseNumber(getValue("清潔費")),
          linen_fee: parseNumber(getValue("床單費用")),
          total_revenue: parseNumber(getValue("總收入")),
          accommodation_tax: parseNumber(getValue("住宿稅")),
          revenue_year: Number.parseInt(getValue("收入年份")) || new Date().getFullYear(),
          details: getValue("詳情"),
          referral_code: getValue("推薦碼"),
          raw_data: Object.fromEntries(headers.map((h, i) => [h, row[i]])),
        })

        newCount++
      }

      // Update batch file name and count
      const { data: countResult } = await supabase
        .from("platform_transactions")
        .select("id", { count: "exact" })
        .eq("batch_id", batchId)

      await supabase
        .from("csv_import_batches")
        .update({
          file_name: file.name,
          records_count: countResult?.length || 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", batchId)

      return NextResponse.json({
        success: true,
        message: mode === "merge" ? `${newCount}件追加、${skippedCount}件スキップ` : `${newCount}件で更新しました`,
      })
    }

    return NextResponse.json({ error: "無効なタイプです" }, { status: 400 })
  } catch (error) {
    console.error("Update error:", error)
    return NextResponse.json({ error: "更新処理中にエラーが発生しました" }, { status: 500 })
  }
}
