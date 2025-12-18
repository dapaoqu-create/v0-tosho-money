import { createClient } from "@/lib/supabase/server"
import { UsersContent } from "@/components/users/users-content"

async function getUsers() {
  const supabase = await createClient()
  const { data: users } = await supabase.from("users").select("*").order("created_at", { ascending: false })

  return users || []
}

export default async function UsersPage() {
  const users = await getUsers()

  return <UsersContent users={users} />
}
