import { createAuthClient } from "better-auth/react";
import { adminClient, usernameClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [usernameClient(), adminClient()],
});

export const { useSession, signOut } = authClient; //Other files will be able to keep importing it by name
