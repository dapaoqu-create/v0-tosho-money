import { createClient } from "@/lib/supabase/server"
import { SettingsContent } from "@/components/settings/settings-content"

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

  return <SettingsContent banks={banks} platforms={platforms} properties={properties} />
}
