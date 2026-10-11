/** the 1st problem zod found, as 1 line a user can read: "days: Too big: expected number to be <=7" */

import type { z } from "zod";

export function firstIssue(error: z.ZodError, fallbackPath = "") {
  const issue = error.issues[0];
  const path = issue.path.join(".") || fallbackPath;
  return path ? `${path}: ${issue.message}` : issue.message;
}
