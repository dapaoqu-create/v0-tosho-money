import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function DELETE(request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  try {
    const { batchId } = await params
    const supabase = await createClient()

    // Delete the batch (cascade will delete related transactions)
    const { error } = await supabase.from("csv_import_batches").delete().eq("id", batchId)

    if (error) {
      console.error("Delete error:", error)
      return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete error:", error)
    return NextResponse.json({ error: "削除処理中にエラーが発生しました" }, { status: 500 })
  }
}
