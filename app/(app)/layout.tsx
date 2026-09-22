import { cookies, headers } from "next/headers";

import { AppSidebar } from "@/components/app-sidebar";
import { LocationPicker } from "@/components/location-picker";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { LOCATION_COOKIE, resolveLocation } from "@/server/location";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // resolved on the server, location shown at the top
  const location = resolveLocation((await cookies()).get(LOCATION_COOKIE)?.value, await headers());

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="bg-background/80 sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b backdrop-blur">
          <div className="flex w-full items-center gap-2 px-4">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <div className="ml-auto flex items-center gap-1">
              <LocationPicker location={location} />
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 md:p-6">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
