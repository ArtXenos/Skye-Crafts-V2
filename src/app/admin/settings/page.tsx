import { SettingsForm } from "@/components/admin/small-forms";
import { createClient } from "@/lib/supabase/server";
import { settingsSchema, type SettingsInput } from "@/lib/validation";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("shop_settings").select("key, value");
  if (error) throw new Error(error.message);
  const stored = Object.fromEntries(data.map(({ key, value }) => [key, value]));
  const initial = Object.fromEntries(
    Object.keys(settingsSchema.shape).map((key) => [key, stored[key] ?? ""]),
  ) as SettingsInput;

  return (
    <div className="grid max-w-3xl gap-6">
      <h1 className="text-3xl">Settings</h1>
      <p className="text-ink-soft">These words appear on the shop&apos;s pages, at checkout and on customers&apos; orders.</p>
      <SettingsForm initial={initial} />
    </div>
  );
}
