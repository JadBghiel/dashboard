import { redirect } from "next/navigation";

// no landing page yet, the dash is the app. gets an auth check in #7
export default function Home() {
  redirect("/dashboard");
}
