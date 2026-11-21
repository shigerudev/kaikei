import { redirect } from "next/navigation";

/**
 * Platform entry. Login and onboarding land here; it opens the user's workspace.
 * TODO(Antonio): read the workspace from the session once groups are created through the engine.
 */
export default function AppEntry() {
  redirect(`/g/${process.env.KAIKEI_DEFAULT_GROUP ?? "demo"}`);
}
