import { redirect } from "next/navigation";

export default async function SettingsIndex({ params }: PageProps<"/w/[ws]/settings">) {
  const { ws } = await params;
  redirect(`/w/${ws}/settings/general`);
}
