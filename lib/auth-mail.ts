/** the auth mails: sent in the background, and a failure logged w/o the api key */

import { after } from "next/server";

import { sendMail } from "./email";

//only what explains the failure. the raw error of the sendgrid client carries the request config,
//its Authorization header included, logging it as is would print the api key in the logs
function mailError(err: unknown) {
  const e = err as { code?: number | string; message?: string; response?: { body?: unknown } };
  const detail = e.response?.body ? ` ${JSON.stringify(e.response.body)}` : "";
  return `${e.code ?? ""} ${e.message ?? String(err)}${detail}`.trim();
}

//sent after the response: awaiting the mail would make the response slower for real accounts, and
//that timing difference leaks which emails exist. after() and not a bare promise bc on vercel the
//function can be frozen once the response is out, a mail still in flight would never leave. outside
//a request (the tests) there is no after(), the plain promise is enough there
export function mailInBackground(to: string, subject: string, html: string) {
  const send = () =>
    sendMail({ to, subject, html }).catch((err) => {
      console.error(`Failed to send "${subject}" mail: ${mailError(err)}`);
    });
  try {
    after(send);
  } catch {
    void send();
  }
}

//the new email is typed by the user and goes into a mail's html
export const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
