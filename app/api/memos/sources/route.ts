import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

const BANK_CODE_NAMES: Record<string, string> = {
  RT: "楽天銀行",
  MUFG: "三菱UFJ銀行",
  SMBC: "三井住友銀行",
  MIZUHO: "みずほ銀行",
}

export async function GET() {
  const supabase = await createClient()

  // 獲取所有不同的銀行代碼
  const { data: bankBatches, error: bankError } = await supabase
    .from("csv_import_batches")
    .select("bank_code")
    .eq("source_type", "bank")
    .not("bank_code", "is", null)

  // 獲取所有不同的平台名稱
  const { data: platformBatches, error: platformError } = await supabase
    .from("csv_import_batches")
    .select("platform_name")
    .eq("source_type", "platform")
    .not("platform_name", "is", null)

  if (bankError || platformError) {
    return NextResponse.json({ error: "Failed to fetch sources" }, { status: 500 })
  }

  // 去重並轉換銀行代碼為名稱
  const bankCodes = [...new Set(bankBatches?.map((b) => b.bank_code).filter(Boolean))]
  const bankNames = bankCodes.map((code) => ({
    code,
    name: BANK_CODE_NAMES[code] || code,
  }))

  const platformNames = [...new Set(platformBatches?.map((b) => b.platform_name).filter(Boolean))]

  return NextResponse.json({
    bankNames,
    platformNames,
  })
}
