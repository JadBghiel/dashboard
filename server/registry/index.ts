/** the registry: every service, checked once when the server loads. a duplicate id or a param
 * about.json cant express throws right here, so it fails the build instead of a request */

import { services } from "../services";
import { describeParams, type ParamSpec, type ServiceDef, type WidgetDef } from "./define";

export type CatalogWidget = Pick<WidgetDef, "id" | "name" | "description" | "refresh"> & {
  params: ParamSpec[];
};

export type CatalogService = Pick<
  ServiceDef,
  "id" | "name" | "description" | "category" | "auth"
> & {
  // what the key is called and where to get one, never its value
  key: { label: string; helpUrl: string } | null;
  widgets: CatalogWidget[];
};

export function createRegistry(list: readonly ServiceDef[]) {
  const byId = new Map<string, ServiceDef>();

  for (const service of list) {
    if (byId.has(service.id)) throw new Error(`duplicate service id ${service.id}`);
    byId.set(service.id, service);

    const seen = new Set<string>();
    for (const widget of service.widgets) {
      if (seen.has(widget.id)) {
        throw new Error(`duplicate widget id ${widget.id} in service ${service.id}`);
      }
      seen.add(widget.id);
    }
  }

  // plain data, no schemas or functions, safe to send to the front and to about.json. built once,
  // the registry never changes while the server runs
  const catalog: CatalogService[] = list.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    category: s.category,
    auth: s.auth,
    key: s.key ? { label: s.key.label, helpUrl: s.key.helpUrl } : null,
    widgets: s.widgets.map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      refresh: w.refresh,
      params: describeParams(w.id, w.params),
    })),
  }));

  return {
    catalog,
    getService: (id: string) => byId.get(id),
    getWidget: (serviceId: string, widgetId: string) =>
      byId.get(serviceId)?.widgets.find((w) => w.id === widgetId),
  };
}

export type Registry = ReturnType<typeof createRegistry>;

export const registry = createRegistry(services);
