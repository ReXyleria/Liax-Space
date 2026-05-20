import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LegacyCodeInjectionPage() {
  redirect("/console/settings/code-injection");
}
