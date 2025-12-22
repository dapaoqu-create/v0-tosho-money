import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params
  const { status } = await request.json()

  if (!status || !["pending", "completed"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }

  const supabase = await createClient()

  const { error } = await supabase.from("csv_import_batches").update({ completion_status: status }).eq("id", batchId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
