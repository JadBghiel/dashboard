/** errors leaves the api in the same shape: { code, message } */

import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

export type ApiError = { code: string; message: string };

const CODES: Record<number, string> = {
  400: "bad_request",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  422: "unprocessable_entity",
  429: "too_many_requests",
};

export const errorCode = (status: number) =>
  CODES[status] ?? (status >= 500 ? "internal_error" : "error");

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
