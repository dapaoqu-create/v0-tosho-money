import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()

  // 獲取所有不同的銀行名稱
  const { data: bankBatches, error: bankError } = await supabase
    .from("csv_import_batches")
    .select("source_name")
    .eq("type", "bank")
    .not("source_name", "is", null)

  // 獲取所有不同的平台名稱
  const { data: platformBatches, error: platformError } = await supabase
    .from("csv_import_batches")
    .select("platform_name")
    .eq("type", "platform")
    .not("platform_name", "is", null)

  if (bankError || platformError) {
    return NextResponse.json({ error: "Failed to fetch sources" }, { status: 500 })
  }

  // 去重
  const bankNames = [...new Set(bankBatches?.map((b) => b.source_name).filter(Boolean))]
  const platformNames = [...new Set(platformBatches?.map((b) => b.platform_name).filter(Boolean))]

  return NextResponse.json({
    bankNames,
    platformNames,
  })
}
