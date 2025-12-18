"use client"

import { DashboardHeader } from "@/components/dashboard-header"
import { UsersManagement } from "@/components/users/users-management"

interface UsersContentProps {
  users: any[]
}

export function UsersContent({ users }: UsersContentProps) {
  return (
    <div className="space-y-6">
      <DashboardHeader titleKey="users.title" subtitleKey="users.subtitle" />
      <UsersManagement users={users} />
    </div>
  )
}
