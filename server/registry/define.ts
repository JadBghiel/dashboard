/** a service and its widgets are declared once, here, and everything else reads that declaration:
 * about.json, the add widget form, the config validation, the cache and the fetch. so a new param
 * is 1 line in 1 file, and nothing can drift */

import { z } from "zod";

export type WidgetSize = "1x1" | "2x1" | "2x2";

/** how a service gets its data. none = open api (weather), the others need the user to link or
 * paste something first */
export type ServiceAuth = "none" | "oauth" | "api_key";

/** what a fetcher is handed to reach the upstream. null for services w/ auth none */
export type WidgetCredentials =
  { kind: "oauth"; accessToken: string } | { kind: "api_key"; apiKey: string } | null;

export type FetchContext<Params> = {
  params: Params;
  credentials: WidgetCredentials;
  // aborted when the request that asked for the data goes away, pass it to fetch()
  signal: AbortSignal;
};

export type ParamsSchema = z.ZodObject;

export type WidgetDef<P extends ParamsSchema = ParamsSchema, R extends z.ZodType = z.ZodType> = {
  // snake_case, its the name about.json shows
  id: string;
  name: string;
  description: string;
  params: P;
  sizes: readonly WidgetSize[];
  // seconds. min protects the upstream quota, a user cant set a refresh below it
  refresh: { default: number; min: number };
  // seconds a fetched payload stays fresh. the cache key is built from the params, not from the
  // instance, so 2 instances w/ the same config share 1 upstream call
  cache: { ttl: number };
  payload: R;
  // method syntax on purpose: it lets a widget w/ its own params still count as a plain WidgetDef
  // in the registry list
  fetch(ctx: FetchContext<z.infer<P>>): Promise<z.infer<R>>;
};

export type ServiceDef = {
  id: string;
  name: string;
  description: string;
  auth: ServiceAuth;
  widgets: readonly WidgetDef[];
};

/** 1 param as the rest of the app sees it. type is what about.json allows (string or integer),
 * kind is the finer one the form needs to pick a text field, a number field, a select or a switch */
export type ParamSpec = {
  name: string;
  type: "string" | "integer";
  kind: "string" | "integer" | "enum" | "boolean";
  required: boolean;
  default?: string | number | boolean;
  options?: string[];
  min?: number;
  max?: number;
};

const ID = /^[a-z][a-z0-9_]*$/;

// a bare z.number().int() reports the safe integer limits as its bounds, thats "no bound" for us
const bound = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) || Math.abs(n) >= Number.MAX_SAFE_INTEGER ? undefined : n;

/** walks the param schema and throws on anything about.json cant express. only z.string,
 * z.number().int, z.enum and z.boolean, optionally w/ .default() or .optional() */
export function describeParams(widgetId: string, schema: ParamsSchema): ParamSpec[] {
  return Object.entries(schema.shape).map(([name, field]) => {
    let inner = field as z.ZodType;
    let required = true;
    let fallback: ParamSpec["default"];

    while (inner.def.type === "default" || inner.def.type === "optional") {
      required = false;
      if (inner instanceof z.ZodDefault) fallback = inner.def.defaultValue as ParamSpec["default"];
      inner = (inner as z.ZodDefault | z.ZodOptional).def.innerType as z.ZodType;
    }

    const base = { name, required, ...(fallback !== undefined && { default: fallback }) };

    if (inner instanceof z.ZodString) {
      return { ...base, type: "string", kind: "string" };
    }
    if (inner instanceof z.ZodNumber && inner.isInt) {
      return {
        ...base,
        type: "integer",
        kind: "integer",
        min: bound(inner.minValue),
        max: bound(inner.maxValue),
      };
    }
    if (inner instanceof z.ZodEnum) {
      return { ...base, type: "string", kind: "enum", options: inner.options.map(String) };
    }
    if (inner instanceof z.ZodBoolean) {
      return { ...base, type: "string", kind: "boolean" };
    }

    const got = inner instanceof z.ZodNumber ? "a non integer number" : inner.def.type;
    throw new Error(
      `widget ${widgetId}, param ${name}: only z.string, z.number().int, z.enum and z.boolean are supported, got ${got}`,
    );
  });
}

export function defineWidget<P extends ParamsSchema, R extends z.ZodType>(
  def: WidgetDef<P, R>,
): WidgetDef<P, R> {
  if (!ID.test(def.id)) throw new Error(`widget id ${def.id} must be snake_case`);
  // the subject doesnt count a widget w/o params, so we dont let one exist
  if (Object.keys(def.params.shape).length === 0) {
    throw new Error(`widget ${def.id} has no params, the subject doesnt count those`);
  }
  if (def.sizes.length === 0) throw new Error(`widget ${def.id} needs at least 1 size`);
  if (def.refresh.min <= 0 || def.refresh.default < def.refresh.min) {
    throw new Error(`widget ${def.id}: refresh.default must be >= refresh.min > 0`);
  }
  describeParams(def.id, def.params);
  return def;
}

export function defineService(def: ServiceDef): ServiceDef {
  if (!ID.test(def.id)) throw new Error(`service id ${def.id} must be snake_case`);
  return def;
}
