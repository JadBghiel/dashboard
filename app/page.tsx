import { redirect } from "next/navigation";

// no landing page, the dash is the app. a visitor goes on from there to the log in page
export default function Home() {
  redirect("/dashboard");
}
