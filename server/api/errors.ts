/** errors leaves the api in the same shape: { code, message } */

import { z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

export const ApiErrorSchema = z.object({ code: z.string(), message: z.string() });
export type ApiError = z.infer<typeof ApiErrorSchema>;

/** openapi response entry for an error status, /api/docs lists what a route can fail with */
export const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: ApiErrorSchema } },
});

const CODES: Record<number, string> = {
  400: "invalid_request",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  422: "unprocessable_entity",
  429: "too_many_requests",
};

const errorCode = (status: number) => CODES[status] ?? (status >= 500 ? "internal_error" : "error");

export function onError(err: Error, c: Context) {
  if (err instanceof HTTPException) {
    const code = errorCode(err.status);
    return c.json<ApiError>({ code, message: err.message || code }, err.status);
  }
  console.error(err);
  return c.json<ApiError>({ code: "internal_error", message: "something went wrong" }, 500);
}

export const notFound = (c: Context) =>
  c.json<ApiError>({ code: "not_found", message: "no route matches this url" }, 404);
