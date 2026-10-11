/** github through oauth2: the user links their account on the services page, the widgets read
 * github as them. the service id is better-auth's provider id, that's how the linked account is
 * found (server/linked-accounts.ts) */

import { defineService } from "@/server/registry/define";

import { notificationsWidget, reposWidget } from "./widgets";

export const github = defineService({
  id: "github",
  name: "GitHub",
  description: "Your notifications and repositories",
  category: "utility",
  auth: "oauth",
  widgets: [notificationsWidget, reposWidget],
});
