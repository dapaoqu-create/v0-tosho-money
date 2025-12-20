import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// igohotel API 設定
const IGOHOTEL_API_BASE = "https://ical.igohotel.com"
const IGOHOTEL_API_KEY = "guest_registry_api_2024"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { batchIds } = await request.json()

    if (!batchIds || !Array.isArray(batchIds) || batchIds.length === 0) {
      return NextResponse.json({ error: "請選擇至少一個 CSV" }, { status: 400 })
    }

    // 從選定的批次獲取所有確認碼
    const { data: transactions, error } = await supabase
      .from("platform_transactions")
      .select("id, raw_data, batch_id")
      .in("batch_id", batchIds)

    if (error) {
      console.error("查詢交易失敗:", error)
      return NextResponse.json({ error: "查詢交易資料失敗" }, { status: 500 })
    }

    // 提取所有確認碼（只有預訂行有確認碼，Payout 行沒有）
    const confirmationCodes: Array<{
      code: string
      date: string
      guest: string
      amount: string
      batchId: string
      transactionId: string
    }> = []

    for (const tx of transactions || []) {
      const rawData = tx.raw_data as Record<string, string>
      const code = rawData["確認碼"] || rawData["Confirmation Code"] || rawData["confirmation_code"]
      const type = rawData["類型"] || rawData["Type"] || rawData["type"]

      // 只處理有確認碼的預訂行
      if (code && code.trim() && type !== "Payout") {
        confirmationCodes.push({
          code: code.trim(),
          date: rawData["日期"] || rawData["Date"] || "",
          guest: rawData["房客"] || rawData["Guest"] || "",
          amount: rawData["金額"] || rawData["Amount"] || "",
          batchId: tx.batch_id,
          transactionId: tx.id,
        })
      }
    }

    if (confirmationCodes.length === 0) {
      return NextResponse.json({
        total: 0,
        matched: 0,
        notFound: [],
        message: "沒有找到確認碼",
      })
    }

    // 批量調用 igohotel API 檢查確認碼
    const codes = confirmationCodes.map((c) => c.code)
    const uniqueCodes = [...new Set(codes)]

    let apiResult: Record<string, boolean> = {}

    try {
      // 使用批量檢查 API
      const response = await fetch(`${IGOHOTEL_API_BASE}/api/guest_registry.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": IGOHOTEL_API_KEY,
        },
        body: JSON.stringify({ check_codes: uniqueCodes }),
      })

      if (!response.ok) {
        throw new Error(`API 回應錯誤: ${response.status}`)
      }

      const data = await response.json()

      // 假設 API 回傳格式為 { results: { "CODE1": true, "CODE2": false, ... } }
      if (data.results) {
        apiResult = data.results
      } else if (Array.isArray(data)) {
        // 或者回傳陣列格式
        for (const item of data) {
          if (item.confirmation_code && typeof item.exists !== "undefined") {
            apiResult[item.confirmation_code] = item.exists
          }
        }
      }
    } catch (apiError) {
      console.error("igohotel API 錯誤:", apiError)
      // 如果 API 失敗，返回錯誤但不中斷
      return NextResponse.json({
        total: confirmationCodes.length,
        matched: 0,
        notFound: confirmationCodes,
        apiError: true,
        message: "無法連接旅客名簿 API，請稍後再試",
      })
    }

    // 比對結果
    const matched: typeof confirmationCodes = []
    const notFound: typeof confirmationCodes = []

    for (const item of confirmationCodes) {
      if (apiResult[item.code] === true) {
        matched.push(item)
      } else {
        notFound.push(item)
      }
    }

    return NextResponse.json({
      total: confirmationCodes.length,
      matched: matched.length,
      notFound: notFound,
      matchedList: matched,
    })
  } catch (error) {
    console.error("確認碼檢查錯誤:", error)
    return NextResponse.json({ error: "檢查過程發生錯誤" }, { status: 500 })
  }
}
