import { redirect } from "next/navigation";

export default function DropshippingQuickSetupRedirectPage() {
  redirect("/dropshipping?tab=quick_setup");
}
