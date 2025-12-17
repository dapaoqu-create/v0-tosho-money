import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const { name, account_name } = await request.json()

    if (!name) {
      return NextResponse.json({ error: "プラットフォーム名は必須です" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase.from("platforms").insert({ name, account_name }).select().single()

    if (error) throw error

    return NextResponse.json({ success: true, platform: data })
  } catch (error) {
    console.error("Create platform error:", error)
    return NextResponse.json({ error: "プラットフォームの作成に失敗しました" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "IDは必須です" }, { status: 400 })
    }

    const supabase = await createClient()
    const { error } = await supabase.from("platforms").delete().eq("id", id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete platform error:", error)
    return NextResponse.json({ error: "プラットフォームの削除に失敗しました" }, { status: 500 })
  }
}
