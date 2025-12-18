"use client"

import { DashboardHeader } from "@/components/dashboard-header"
import { SettingsView } from "@/components/settings/settings-view"

interface SettingsContentProps {
  banks: any[]
  platforms: any[]
  properties: any[]
}

export function SettingsContent({ banks, platforms, properties }: SettingsContentProps) {
  return (
    <div className="space-y-6">
      <DashboardHeader titleKey="settings.title" subtitleKey="settings.subtitle" />
      <SettingsView banks={banks} platforms={platforms} properties={properties} />
    </div>
  )
}
