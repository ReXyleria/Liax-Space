import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { canAccessConsole } from "@/lib/permissions";

type ConsolePermissionCheck = (user: CurrentUser) => boolean;

function redirectToLogin(callbackUrl: string): never {
  redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
}

export async function requireConsoleAccess(callbackUrl = "/console") {
  const user = await getCurrentUser();

  if (!user) {
    redirectToLogin(callbackUrl);
  }

  if (!canAccessConsole(user)) {
    redirect("/");
  }

  return user;
}

export async function requireConsolePermission(
  check: ConsolePermissionCheck,
  callbackUrl = "/console"
) {
  const user = await requireConsoleAccess(callbackUrl);

  if (!check(user)) {
    redirect("/");
  }

  return user;
}
