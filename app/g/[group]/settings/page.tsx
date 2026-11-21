import { redirect } from "next/navigation";

export default async function SettingsIndex({ params }: PageProps<"/g/[group]/settings">) {
  const { group } = await params;
  redirect(`/g/${group}/settings/entities`);
}
