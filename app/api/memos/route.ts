import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("reconciliation_memos")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ memos: data })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()

  const { source_type, bank_name, platform_name, content } = body

  if (!source_type || !content) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  if (source_type === "bank" && !bank_name) {
    return NextResponse.json({ error: "Bank name is required for bank memos" }, { status: 400 })
  }

  if (source_type === "platform" && !platform_name) {
    return NextResponse.json({ error: "Platform name is required for platform memos" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("reconciliation_memos")
    .insert({
      source_type,
      bank_name: source_type === "bank" ? bank_name : null,
      platform_name: source_type === "platform" ? platform_name : null,
      content,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ memo: data })
}
