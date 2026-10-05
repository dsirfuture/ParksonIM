import { redirect } from "next/navigation";
import { getDefaultLandingPath, hasAppPermission } from "@/lib/permissions";
import { getSession } from "@/lib/tenant";

export default async function CustomerPermissionsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (!(await hasAppPermission(session, "admin.customer_permissions.view"))) {
    redirect(getDefaultLandingPath(session));
  }

  const params = (await searchParams) || {};
  const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  redirect(userId ? `/settings?tab=perm&userId=${encodeURIComponent(userId)}` : "/settings?tab=perm");
}
