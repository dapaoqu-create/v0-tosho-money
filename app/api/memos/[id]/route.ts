import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params
  const body = await request.json()

  const { content } = body

  if (!content) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("reconciliation_memos")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ memo: data })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params

  const { error } = await supabase.from("reconciliation_memos").delete().eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
