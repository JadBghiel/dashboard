"use client";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

/** the "or" divider and the google btn under the log in and register forms */
export function GoogleButton() {
  return (
    <>
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background text-muted-foreground px-2">Or</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/dashboard" })}
      >
        Continue with Google
      </Button>
    </>
  );
}
