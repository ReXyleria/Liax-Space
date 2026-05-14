import { redirect } from "next/navigation";

export default function AccountDevicesRedirectPage() {
  redirect("/admin/account");
}
