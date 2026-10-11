/** better-auth's codes when linking an account is refused, it sends the browser back w/ ?error= */

const MESSAGES: Record<string, (name: string) => string> = {
  access_denied: (name) => `${name} connection was cancelled.`,
  unable_to_link_account: (name) =>
    `${name} didn't confirm your email. Verify it on ${name}, then try again.`,
  account_already_linked_to_different_user: (name) =>
    `This ${name} account is already connected to another user.`,
};

export const linkErrorMessage = (name: string, code: string | undefined) =>
  (code && MESSAGES[code]?.(name)) ?? `${name} couldn't be connected, try again.`;
