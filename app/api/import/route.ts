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
  const date = dateStr.replace(/-/g, "").slice(2) // YYYYMMDD -> YYMMDD
  const amountStr = Math.abs(amount).toString()
  const last4 = amountStr.slice(-4).padStart(4, "0")
  return `${bankCode}${date}${last4}`
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const type = formData.get("type") as string

    if (!file) {
      return NextResponse.json({ error: "ファイルが必要です" }, { status: 400 })
    }

    const content = await file.text()
    const { headers, rows } = parseCSV(content)

    const supabase = await createClient()

    if (type === "bank") {
      const bankName = formData.get("bankName") as string
      const bankCode = formData.get("bankCode") as string
      const memo = formData.get("memo") as string

      if (!bankName || !bankCode) {
        return NextResponse.json({ error: "銀行名と銀行識別コードは必須です" }, { status: 400 })
      }

      // Create or get bank
      let bankId: string
      const { data: existingBank } = await supabase.from("banks").select("id").eq("name", bankName).single()

      if (existingBank) {
        bankId = existingBank.id
      } else {
        const { data: newBank, error: bankError } = await supabase
          .from("banks")
          .insert({ name: bankName })
          .select()
          .single()

        if (bankError) {
          return NextResponse.json({ error: "銀行の作成に失敗しました" }, { status: 500 })
        }
        bankId = newBank.id
      }

      const { data: batch, error: batchError } = await supabase
        .from("csv_import_batches")
        .insert({
          source_type: "bank",
          file_name: file.name,
          bank_id: bankId,
          bank_code: bankCode,
          memo: memo || null,
        })
        .select()
        .single()

      if (batchError) {
        console.error("Batch creation error:", batchError)
        return NextResponse.json({ error: "インポートバッチの作成に失敗しました" }, { status: 500 })
      }

      // Map headers to fields (for 楽天銀行 format)
      const dateIndex = headers.findIndex((h) => h.includes("取引日"))
      const amountIndex = headers.findIndex((h) => h.includes("入出金"))
      const balanceIndex = headers.findIndex((h) => h.includes("残高"))
      const descIndex = headers.findIndex((h) => h.includes("入出金先"))

      const transactions = rows
        .filter((row) => row.length >= 3 && row[dateIndex])
        .map((row) => {
          const amount = parseNumber(row[amountIndex] || "0")
          const transactionDate = parseDate(row[dateIndex])

          const transactionCode = transactionDate ? generateTransactionCode(bankCode, transactionDate, amount) : null

          return {
            bank_id: bankId,
            batch_id: batch.id,
            transaction_date: transactionDate,
            amount,
            balance: parseNumber(row[balanceIndex] || "0"),
            description: row[descIndex] || "",
            is_income: amount > 0,
            transaction_code: transactionCode,
            raw_data: Object.fromEntries(headers.map((h, i) => [h, row[i]])),
          }
        })
        .filter((t) => t.transaction_date)

      if (transactions.length === 0) {
        // Delete the batch if no valid transactions
        await supabase.from("csv_import_batches").delete().eq("id", batch.id)
        return NextResponse.json({ error: "有効なデータが見つかりませんでした" }, { status: 400 })
      }

      const { error: insertError } = await supabase.from("bank_transactions").insert(transactions)

      if (insertError) {
        console.error("Insert error:", insertError)
        await supabase.from("csv_import_batches").delete().eq("id", batch.id)
        return NextResponse.json({ error: "データの挿入に失敗しました" }, { status: 500 })
      }

      // Update batch record count
      await supabase.from("csv_import_batches").update({ records_count: transactions.length }).eq("id", batch.id)

      return NextResponse.json({ success: true, count: transactions.length, batchId: batch.id })
    }

    if (type === "platform") {
      const platformName = formData.get("platformName") as string
      const accountName = formData.get("accountName") as string
      const propertyName = formData.get("propertyName") as string

      if (!platformName || !accountName || !propertyName) {
        return NextResponse.json({ error: "プラットフォーム名、アカウント名、物件名は必須です" }, { status: 400 })
      }

      // Create or get platform
      let platformId: string
      const { data: existingPlatform } = await supabase
        .from("platforms")
        .select("id")
        .eq("name", platformName)
        .eq("account_name", accountName)
        .single()

      if (existingPlatform) {
        platformId = existingPlatform.id
      } else {
        const { data: newPlatform, error: platformError } = await supabase
          .from("platforms")
          .insert({ name: platformName, account_name: accountName })
          .select()
          .single()

        if (platformError) {
          return NextResponse.json({ error: "プラットフォームの作成に失敗しました" }, { status: 500 })
        }
        platformId = newPlatform.id
      }

      // Create or get property
      let propertyId: string | null = null
      const { data: existingProperty } = await supabase
        .from("properties")
        .select("id")
        .eq("platform_id", platformId)
        .eq("name", propertyName)
        .single()

      if (existingProperty) {
        propertyId = existingProperty.id
      } else {
        const { data: newProperty, error: propertyError } = await supabase
          .from("properties")
          .insert({ platform_id: platformId, name: propertyName })
          .select()
          .single()

        if (!propertyError) {
          propertyId = newProperty.id
        }
      }

      const { data: batch, error: batchError } = await supabase
        .from("csv_import_batches")
        .insert({
          source_type: "platform",
          file_name: file.name,
          platform_id: platformId,
          property_id: propertyId,
          platform_name: platformName,
          account_name: accountName,
          property_name: propertyName,
        })
        .select()
        .single()

      if (batchError) {
        console.error("Batch creation error:", batchError)
        return NextResponse.json({ error: "インポートバッチの作成に失敗しました" }, { status: 500 })
      }

      // Map Airbnb headers
      const headerMap: Record<string, number> = {}
      headers.forEach((h, i) => {
        headerMap[h] = i
      })

      const transactions = rows
        .filter((row) => row.length >= 3 && row[headerMap["日期"]])
        .map((row) => {
          const getValue = (key: string) => row[headerMap[key]] || ""
          const payoutAmount = parseNumber(getValue("收款"))

          return {
            platform_id: platformId,
            property_id: propertyId,
            batch_id: batch.id,
            transaction_date: parseDate(getValue("日期")),
            payout_date: parseDate(getValue("入帳日期")),
            type: getValue("類型"),
            confirmation_code: getValue("確認碼"),
            booking_date: parseDate(getValue("預訂日期")),
            check_in_date: parseDate(getValue("開始日期")),
            check_out_date: parseDate(getValue("結束日期")),
            nights: Number.parseInt(getValue("晚")) || 0,
            guest_name: getValue("客人"),
            currency: getValue("幣別") || "JPY",
            amount: parseNumber(getValue("金額")),
            payout_amount: payoutAmount,
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
          }
        })
        .filter((t) => t.transaction_date)

      if (transactions.length === 0) {
        await supabase.from("csv_import_batches").delete().eq("id", batch.id)
        return NextResponse.json({ error: "有効なデータが見つかりませんでした" }, { status: 400 })
      }

      const { error: insertError } = await supabase.from("platform_transactions").insert(transactions)

      if (insertError) {
        console.error("Insert error:", insertError)
        await supabase.from("csv_import_batches").delete().eq("id", batch.id)
        return NextResponse.json({ error: "データの挿入に失敗しました" }, { status: 500 })
      }

      // Update batch record count
      await supabase.from("csv_import_batches").update({ records_count: transactions.length }).eq("id", batch.id)

      return NextResponse.json({ success: true, count: transactions.length, batchId: batch.id })
    }

    return NextResponse.json({ error: "無効なインポートタイプです" }, { status: 400 })
  } catch (error) {
    console.error("Import error:", error)
    return NextResponse.json({ error: "インポート処理中にエラーが発生しました" }, { status: 500 })
  }
}
