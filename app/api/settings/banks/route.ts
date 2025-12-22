import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const { name } = await request.json()

    if (!name) {
      return NextResponse.json({ error: "銀行名は必須です" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase.from("banks").insert({ name }).select().single()

    if (error) throw error

    return NextResponse.json({ success: true, bank: data })
  } catch (error) {
    console.error("Create bank error:", error)
    return NextResponse.json({ error: "銀行の作成に失敗しました" }, { status: 500 })
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
    const { error } = await supabase.from("banks").delete().eq("id", id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete bank error:", error)
    return NextResponse.json({ error: "銀行の削除に失敗しました" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, name } = await request.json()

    if (!id || !name) {
      return NextResponse.json({ error: "IDと銀行名は必須です" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase.from("banks").update({ name }).eq("id", id).select().single()

    if (error) throw error

    return NextResponse.json({ success: true, bank: data })
  } catch (error) {
    console.error("Update bank error:", error)
    return NextResponse.json({ error: "銀行の更新に失敗しました" }, { status: 500 })
  }
}
