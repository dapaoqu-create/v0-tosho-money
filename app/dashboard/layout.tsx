import type React from "react"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { Sidebar } from "@/components/sidebar"
import { AiChatButton } from "@/components/ai-assistant/ai-chat-button"

async function getSession() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get("session")

  if (!sessionCookie) return null

  try {
    return JSON.parse(sessionCookie.value)
  } catch {
    return null
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session) {
    redirect("/login")
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6">{children}</div>
      </main>
      <AiChatButton />
    </div>
  )
}
