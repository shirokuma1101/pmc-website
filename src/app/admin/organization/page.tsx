import { redirect } from "next/navigation";

export default function AdminOrganizationPage() {
  redirect("/organization?edit=1");
}
