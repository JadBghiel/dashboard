/** log in, register and the mail landing pages: the app's name and what it does above a card, the
 * 1st thing a visitor sees since the app needs an account */

import { AppMark } from "@/components/app-mark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <AppMark className="size-12 rounded-xl" />
          <div className="space-y-1">
            <p className="font-heading text-2xl font-semibold tracking-tight">Dashboard</p>
            <p className="text-muted-foreground text-sm">
              Weather, markets, news and games, live on 1 page you arrange.
            </p>
          </div>
        </div>
        <div className="bg-card shadow-soft rounded-xl border p-6">{children}</div>
      </div>
    </div>
  );
}
