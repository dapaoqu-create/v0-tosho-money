import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"

export interface User {
  id: string
  username: string
  display_name: string
  role: string
}

export async function getSession(): Promise<User | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get("session")

  if (!sessionCookie) return null

  try {
    const session = JSON.parse(sessionCookie.value)
    return session.user
  } catch {
    return null
  }
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Simple verification for demo - in production use bcrypt
  const encoder = new TextEncoder()
  const data = encoder.encode(password + "tosho_salt_2025")
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
  return hash === hashHex
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + "tosho_salt_2025")
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

export async function login(
  username: string,
  password: string,
): Promise<{ success: boolean; user?: User; error?: string }> {
  const supabase = await createClient()

  const { data: user, error } = await supabase.from("users").select("*").eq("username", username).single()

  if (error || !user) {
    return { success: false, error: "ユーザー名またはパスワードが間違っています" }
  }

  const isValid = await verifyPassword(password, user.password_hash)

  if (!isValid) {
    return { success: false, error: "ユーザー名またはパスワードが間違っています" }
  }

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      role: user.role,
    },
  }
}
