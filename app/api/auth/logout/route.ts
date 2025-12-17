import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(request: Request) {
  const cookieStore = await cookies()
  cookieStore.delete("session")

  const url = new URL(request.url)
  const baseUrl = `${url.protocol}//${url.host}`

  return NextResponse.redirect(new URL("/login", baseUrl))
}
