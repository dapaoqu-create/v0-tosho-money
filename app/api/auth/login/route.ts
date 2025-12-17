import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { hashPassword } from "@/lib/auth"

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json({ error: "ユーザー名とパスワードを入力してください" }, { status: 400 })
    }

    const supabase = await createClient()

    // Check if user exists
    const { data: user, error } = await supabase.from("users").select("*").eq("username", username).single()

    if (error || !user) {
      return NextResponse.json({ error: "ユーザー名またはパスワードが間違っています" }, { status: 401 })
    }

    // Verify password
    const hashedInput = await hashPassword(password)

    // For the default admin user, check the default password
    const isDefaultAdmin = username === "superjimmy" && password === "good2025"
    const isValidPassword = user.password_hash === hashedInput || isDefaultAdmin

    if (!isValidPassword) {
      return NextResponse.json({ error: "ユーザー名またはパスワードが間違っています" }, { status: 401 })
    }

    // Create session
    const session = {
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
      },
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }

    const cookieStore = await cookies()
    cookieStore.set("session", JSON.stringify(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ error: "ログイン処理中にエラーが発生しました" }, { status: 500 })
  }
}
