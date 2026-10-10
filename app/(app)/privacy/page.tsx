import { redirect } from "next/navigation";

// privacy lives at the bottom of settings & privacy now, old links land there
export default function PrivacyPage() {
  redirect("/settings#privacy");
}
