import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { hashPassword } from "@/lib/auth"

export async function POST(request: Request) {
  try {
    const { username, password, display_name, role } = await request.json()

    if (!username || !password) {
      return NextResponse.json({ error: "ユーザー名とパスワードは必須です" }, { status: 400 })
    }

    const supabase = await createClient()

    // Check if username exists
    const { data: existing } = await supabase.from("users").select("id").eq("username", username).single()

    if (existing) {
      return NextResponse.json({ error: "このユーザー名は既に使用されています" }, { status: 400 })
    }

    const passwordHash = await hashPassword(password)

    const { data: newUser, error } = await supabase
      .from("users")
      .insert({
        username,
        password_hash: passwordHash,
        display_name: display_name || username,
        role: role || "user",
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, user: newUser })
  } catch (error) {
    console.error("Create user error:", error)
    return NextResponse.json({ error: "ユーザーの作成に失敗しました" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("id")

    if (!userId) {
      return NextResponse.json({ error: "ユーザーIDが必要です" }, { status: 400 })
    }

    const supabase = await createClient()

    // Prevent deleting the default admin
    const { data: user } = await supabase.from("users").select("username").eq("id", userId).single()

    if (user?.username === "superjimmy") {
      return NextResponse.json({ error: "デフォルト管理者は削除できません" }, { status: 400 })
    }

    const { error } = await supabase.from("users").delete().eq("id", userId)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete user error:", error)
    return NextResponse.json({ error: "ユーザーの削除に失敗しました" }, { status: 500 })
  }
}
