"use client"

import { LanguageSelector } from "@/components/language-selector"
import { useLanguage } from "@/lib/i18n/context"

interface DashboardHeaderProps {
  titleKey: string
  subtitleKey: string
}

export function DashboardHeader({ titleKey, subtitleKey }: DashboardHeaderProps) {
  const { t } = useLanguage()

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold">{t(titleKey as any)}</h1>
        <p className="text-muted-foreground">{t(subtitleKey as any)}</p>
      </div>
      <LanguageSelector />
    </div>
  )
}
