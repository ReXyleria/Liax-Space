import { redirect } from "next/navigation";

export default function AccountTotpRedirectPage() {
  redirect("/admin/account");
}
