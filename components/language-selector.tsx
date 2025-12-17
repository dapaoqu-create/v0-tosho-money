"use client"

import { useI18n } from "@/lib/i18n/context"
import type { Locale } from "@/lib/i18n/translations"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

const languages: { code: Locale; flag: string; name: string }[] = [
  { code: "ja", flag: "🇯🇵", name: "日本語" },
  { code: "zh-TW", flag: "🇹🇼", name: "繁體中文" },
  { code: "en", flag: "🇺🇸", name: "English" },
]

export function LanguageSelector() {
  const { locale, setLocale } = useI18n()

  const currentLang = languages.find((l) => l.code === locale) || languages[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-base">
          <span className="text-xl">{currentLang.flag}</span>
          <span className="hidden sm:inline">{currentLang.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLocale(lang.code)}
            className={`gap-2 ${locale === lang.code ? "bg-muted" : ""}`}
          >
            <span className="text-xl">{lang.flag}</span>
            <span>{lang.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
