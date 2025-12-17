import { createClient } from "@/lib/supabase/server"
import { UsersManagement } from "@/components/users/users-management"

async function getUsers() {
  const supabase = await createClient()
  const { data: users } = await supabase.from("users").select("*").order("created_at", { ascending: false })

  return users || []
}

export default async function UsersPage() {
  const users = await getUsers()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">ユーザー管理</h1>
        <p className="text-muted-foreground">システムユーザーの管理</p>
      </div>

      <UsersManagement users={users} />
    </div>
  )
}
