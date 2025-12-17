import { createClient } from "@/lib/supabase/server"
import { SettingsView } from "@/components/settings/settings-view"

async function getSettings() {
  const supabase = await createClient()

  const { data: banks } = await supabase.from("banks").select("*").order("name")
  const { data: platforms } = await supabase.from("platforms").select("*").order("name")
  const { data: properties } = await supabase.from("properties").select("*, platform:platforms(name)").order("name")

  return {
    banks: banks || [],
    platforms: platforms || [],
    properties: properties || [],
  }
}

export default async function SettingsPage() {
  const { banks, platforms, properties } = await getSettings()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">設定</h1>
        <p className="text-muted-foreground">銀行・プラットフォーム・物件の管理</p>
      </div>

      <SettingsView banks={banks} platforms={platforms} properties={properties} />
    </div>
  )
}
