import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/permissions";

type AdminPermissionCheck = (user: CurrentUser) => boolean;

function redirectToLogin(callbackUrl: string): never {
  redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
}

export async function requireAdminAccess(callbackUrl = "/admin") {
  const user = await getCurrentUser();

  if (!user) {
    redirectToLogin(callbackUrl);
  }

  if (!canAccessAdmin(user)) {
    redirect("/");
  }

  return user;
}

export async function requireAdminPermission(
  check: AdminPermissionCheck,
  callbackUrl = "/admin"
) {
  const user = await requireAdminAccess(callbackUrl);

  if (!check(user)) {
    redirect("/");
  }

  return user;
}
