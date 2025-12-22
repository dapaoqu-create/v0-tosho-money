import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

async function decodeBankCSV(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const uint8Array = new Uint8Array(buffer)

  // 檢查 UTF-8 BOM
  let dataToProcess = uint8Array
  if (uint8Array[0] === 0xef && uint8Array[1] === 0xbb && uint8Array[2] === 0xbf) {
    dataToProcess = uint8Array.slice(3)
  }

  // 銀行 CSV 優先嘗試 Shift-JIS（日本銀行常用）
  try {
    const shiftJISContent = new TextDecoder("shift-jis").decode(dataToProcess)
    // 驗證是否包含日文銀行關鍵字
    if (
      shiftJISContent.includes("取引") ||
      shiftJISContent.includes("日付") ||
      shiftJISContent.includes("残高") ||
      shiftJISContent.includes("入出金")
    ) {
      console.log("[v0] Bank CSV: Detected Shift-JIS encoding")
      return shiftJISContent
    }
  } catch (e) {
    console.log("[v0] Shift-JIS decode failed")
  }

  // 嘗試 EUC-JP
  try {
    const eucContent = new TextDecoder("euc-jp").decode(dataToProcess)
    if (eucContent.includes("取引") || eucContent.includes("日付")) {
      console.log("[v0] Bank CSV: Detected EUC-JP encoding")
      return eucContent
    }
  } catch (e) {
    // 忽略
  }

  // 預設使用 UTF-8
  const utf8Content = new TextDecoder("utf-8").decode(dataToProcess)
  console.log("[v0] Bank CSV: Using UTF-8 encoding")
  return utf8Content.replace(/^\uFEFF/, "")
}

async function decodePlatformCSV(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const uint8Array = new Uint8Array(buffer)

  // 檢查 UTF-8 BOM
  let dataToProcess = uint8Array
  if (uint8Array[0] === 0xef && uint8Array[1] === 0xbb && uint8Array[2] === 0xbf) {
    console.log("[v0] Platform CSV: Detected UTF-8 BOM, removing it")
    dataToProcess = uint8Array.slice(3)
  }

  // 平台 CSV（Airbnb 等）直接使用 UTF-8
  const utf8Content = new TextDecoder("utf-8").decode(dataToProcess)
  console.log("[v0] Platform CSV: Using UTF-8 encoding")
  return utf8Content.replace(/^\uFEFF/, "")
}

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

  const headers = lines[headerIndex].split(",").map((h) => h.trim().replace(/^"|"$/g, ""))
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

  const cleaned = dateStr.trim().replace(/^"|"$/g, "")

  // YYYYMMDD 格式 (例如 20241202)
  if (/^\d{8}$/.test(cleaned)) {
    const year = cleaned.slice(0, 4)
    const month = cleaned.slice(4, 6)
    const day = cleaned.slice(6, 8)
    return `${year}-${month}-${day}`
  }

  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(cleaned)) {
    const [year, month, day] = cleaned.split("/")
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
  }

  // MM/DD/YYYY 格式 (例如 12/02/2024)
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleaned)) {
    const [month, day, year] = cleaned.split("/")
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
  }

  // YYYY-MM-DD 格式
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned
  }

  if (/^\d{4}\.\d{1,2}\.\d{1,2}$/.test(cleaned)) {
    const [year, month, day] = cleaned.split(".")
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleaned)) {
    const parts = cleaned.split("/")
    // 如果第一個數字 > 12，可能是日期
    if (Number.parseInt(parts[0]) > 12) {
      const [day, month, year] = parts
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
    }
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

function makeTransactionCodesUnique(transactions: Array<{ transaction_code: string; [key: string]: unknown }>): void {
  const codeCount: Record<string, number> = {}

  for (const tx of transactions) {
    const baseCode = tx.transaction_code

    if (codeCount[baseCode] === undefined) {
      // 第一次出現，記錄但不修改
      codeCount[baseCode] = 0
    } else {
      // 重複出現，添加字母後綴
      codeCount[baseCode]++
      const suffix = String.fromCharCode(64 + codeCount[baseCode]) // 65='A', 66='B', ...
      tx.transaction_code = `${baseCode}${suffix}`
    }
  }

  // 如果某個編碼有重複，第一個也需要加上 A
  const codesWithDuplicates = Object.entries(codeCount)
    .filter(([, count]) => count > 0)
    .map(([code]) => code)

  for (const tx of transactions) {
    if (codesWithDuplicates.includes(tx.transaction_code)) {
      tx.transaction_code = `${tx.transaction_code}A`
    }
  }
}

function findHeaderIndex(headers: string[], ...keywords: string[]): number {
  for (const keyword of keywords) {
    const index = headers.findIndex((h) => h.includes(keyword))
    if (index !== -1) return index
  }
  return -1
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const type = formData.get("type") as string

    if (!file) {
      return NextResponse.json({ error: "ファイルが必要です" }, { status: 400 })
    }

    const content = type === "bank" ? await decodeBankCSV(file) : await decodePlatformCSV(file)
    const { headers, rows } = parseCSV(content)

    const debugInfo = {
      headers,
      firstRows: rows.slice(0, 3),
      rowCount: rows.length,
    }

    console.log("[v0] Parsed CSV headers:", headers)
    console.log("[v0] Row count:", rows.length)
    if (rows[0]) console.log("[v0] First row:", rows[0])

    const supabase = await createClient()

    if (type === "bank") {
      const bankName = formData.get("bankName") as string
      const bankCode = formData.get("bankCode") as string
      const memo = formData.get("memo") as string

      if (!bankName || !bankCode) {
        return NextResponse.json({ error: "銀行名と銀行識別コードは必須です", debug: debugInfo }, { status: 400 })
      }

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
          return NextResponse.json({ error: "銀行の作成に失敗しました", debug: debugInfo }, { status: 500 })
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
        return NextResponse.json({ error: "インポートバッチの作成に失敗しました", debug: debugInfo }, { status: 500 })
      }

      const dateIndex = findHeaderIndex(headers, "取引日", "取引日付", "日付", "date", "Date")
      const amountIndex = findHeaderIndex(headers, "入出金", "入出金(円)", "金額", "amount", "Amount")
      const balanceIndex = findHeaderIndex(headers, "残高", "残高(円)", "balance", "Balance")
      const descIndex = findHeaderIndex(headers, "入出金先", "摘要", "内容", "description")

      console.log(
        "[v0] Bank column indices - date:",
        dateIndex,
        "amount:",
        amountIndex,
        "balance:",
        balanceIndex,
        "desc:",
        descIndex,
      )

      const transactions = rows
        .filter((row) => row.length >= 2 && row.some((cell) => cell && cell.trim()))
        .map((row, rowIndex) => {
          const dateStr = dateIndex !== -1 ? row[dateIndex] : ""
          const amountStr = amountIndex !== -1 ? row[amountIndex] : "0"
          const amount = parseNumber(amountStr)
          const transactionDate = parseDate(dateStr)
          const transactionCode = transactionDate
            ? generateTransactionCode(bankCode, transactionDate, amount)
            : `${bankCode}ROW${rowIndex}`

          const rawData: Record<string, string> = {
            _row_index: String(rowIndex),
          }
          headers.forEach((h, i) => {
            rawData[h] = row[i] || ""
          })

          return {
            bank_id: bankId,
            batch_id: batch.id,
            transaction_date: transactionDate,
            amount,
            balance: balanceIndex !== -1 ? parseNumber(row[balanceIndex] || "0") : 0,
            description: descIndex !== -1 ? row[descIndex] || "" : "",
            is_income: amount > 0,
            transaction_code: transactionCode,
            raw_data: rawData,
          }
        })
        .map((t) => ({
          ...t,
          transaction_date: t.transaction_date || new Date().toISOString().split("T")[0],
        }))

      // Ensure transaction codes are unique
      makeTransactionCodesUnique(transactions)

      console.log("[v0] Bank transactions to insert:", transactions.length)
      if (transactions.length > 0) {
        console.log("[v0] First bank transaction:", JSON.stringify(transactions[0], null, 2))
      }

      if (transactions.length === 0) {
        await supabase.from("csv_import_batches").delete().eq("id", batch.id)
        return NextResponse.json(
          {
            error: "有効なデータが見つかりませんでした",
            debug: debugInfo,
          },
          { status: 400 },
        )
      }

      const { error: insertError } = await supabase.from("bank_transactions").insert(transactions)

      if (insertError) {
        console.error("Insert error:", insertError)
        await supabase.from("csv_import_batches").delete().eq("id", batch.id)
        return NextResponse.json(
          {
            error: `データの挿入に失敗しました: ${insertError.message}`,
            debug: debugInfo,
          },
          { status: 500 },
        )
      }

      await supabase.from("csv_import_batches").update({ records_count: transactions.length }).eq("id", batch.id)

      return NextResponse.json({ success: true, count: transactions.length, batchId: batch.id, debug: debugInfo })
    }

    if (type === "platform") {
      const platformName = formData.get("platformName") as string
      const accountName = formData.get("accountName") as string
      const propertyName = formData.get("propertyName") as string

      if (!platformName || !accountName || !propertyName) {
        return NextResponse.json(
          { error: "プラットフォーム名、アカウント名、物件名は必須です", debug: debugInfo },
          { status: 400 },
        )
      }

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
          return NextResponse.json({ error: "プラットフォームの作成に失敗しました", debug: debugInfo }, { status: 500 })
        }
        platformId = newPlatform.id
      }

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
          csv_headers: headers,
        })
        .select()
        .single()

      if (batchError) {
        console.error("Batch creation error:", batchError)
        return NextResponse.json({ error: "インポートバッチの作成に失敗しました", debug: debugInfo }, { status: 500 })
      }

      const headerMap: Record<string, number> = {}
      headers.forEach((h, i) => {
        headerMap[h] = i
      })

      const getIndex = (key: string) => headerMap[key] ?? -1

      console.log("[v0] Platform CSV - headers:", headers)
      console.log("[v0] Platform CSV - headerMap:", headerMap)
      console.log("[v0] Platform CSV - first few rows:", rows.slice(0, 3))

      const transactions = rows
        .filter((row) => {
          // 只要有任何欄位有值就處理
          return row.length >= 1 && row.some((cell) => cell && cell.trim())
        })
        .map((row, rowIndex) => {
          const getValue = (key: string) => {
            const idx = getIndex(key)
            return idx !== -1 ? row[idx] || "" : ""
          }

          const getDateValue = () => {
            for (const key of ["日期", "Date", "date", "日付", "付款日期"]) {
              const val = getValue(key)
              if (val) return val
            }
            return ""
          }

          const rawData: Record<string, string> = {
            _headers: JSON.stringify(headers),
            _row_index: String(rowIndex),
          }
          headers.forEach((h, i) => {
            rawData[h] = row[i] || ""
          })

          const payoutAmount = parseNumber(
            getValue("收款") || getValue("Payout") || getValue("payout") || getValue("收入"),
          )

          return {
            platform_id: platformId,
            property_id: propertyId,
            batch_id: batch.id,
            transaction_date: parseDate(getDateValue()) || new Date().toISOString().split("T")[0],
            payout_date: parseDate(getValue("入帳日期") || getValue("Payout Date")),
            type: getValue("類型") || getValue("Type") || getValue("type") || "",
            confirmation_code:
              getValue("確認碼") || getValue("Confirmation Code") || getValue("confirmation_code") || "",
            booking_date: parseDate(getValue("預訂日期") || getValue("Booking Date")),
            check_in_date: parseDate(getValue("開始日期") || getValue("Start Date")),
            check_out_date: parseDate(getValue("結束日期") || getValue("End Date")),
            nights: Number.parseInt(getValue("晚") || getValue("Nights") || "0") || 0,
            guest_name: getValue("客人") || getValue("Guest") || getValue("guest") || "",
            currency: getValue("幣別") || getValue("Currency") || "JPY",
            amount: parseNumber(getValue("金額") || getValue("Amount") || getValue("amount")),
            payout_amount: payoutAmount,
            service_fee: parseNumber(getValue("服務費") || getValue("Service Fee")),
            fast_pay_fee: parseNumber(getValue("快速收款手續費")),
            cleaning_fee: parseNumber(getValue("清潔費") || getValue("Cleaning Fee")),
            linen_fee: parseNumber(getValue("床單費用")),
            total_revenue: parseNumber(getValue("總收入") || getValue("Total")),
            accommodation_tax: parseNumber(getValue("住宿稅")),
            revenue_year:
              Number.parseInt(getValue("收入年份") || String(new Date().getFullYear())) || new Date().getFullYear(),
            details: getValue("詳情") || getValue("Details") || "",
            referral_code: getValue("推薦碼") || "",
            raw_data: rawData,
          }
        })

      console.log("[v0] Platform transactions count:", transactions.length)
      if (transactions.length > 0) {
        console.log("[v0] First transaction:", JSON.stringify(transactions[0], null, 2))
      }

      if (transactions.length === 0) {
        await supabase.from("csv_import_batches").delete().eq("id", batch.id)
        return NextResponse.json(
          {
            error: "有効なデータが見つかりませんでした",
            debug: debugInfo,
          },
          { status: 400 },
        )
      }

      const { error: insertError } = await supabase.from("platform_transactions").insert(transactions)

      if (insertError) {
        console.error("Insert error:", insertError)
        await supabase.from("csv_import_batches").delete().eq("id", batch.id)
        return NextResponse.json(
          {
            error: `データの挿入に失敗しました: ${insertError.message}`,
            debug: debugInfo,
          },
          { status: 500 },
        )
      }

      await supabase.from("csv_import_batches").update({ records_count: transactions.length }).eq("id", batch.id)

      return NextResponse.json({ success: true, count: transactions.length, batchId: batch.id, debug: debugInfo })
    }

    return NextResponse.json({ error: "無効なインポートタイプです", debug: debugInfo }, { status: 400 })
  } catch (error) {
    console.error("Import error:", error)
    return NextResponse.json({ error: `インポート処理中にエラーが発生しました: ${error}` }, { status: 500 })
  }
}
