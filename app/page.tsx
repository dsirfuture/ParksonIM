import { redirect } from "next/navigation";
import { getResolvedLandingPath } from "@/lib/permissions";
import { getSession } from "@/lib/tenant";

export default async function HomePage() {
  const session = await getSession();
  redirect(session ? await getResolvedLandingPath(session) : "/login");
}
