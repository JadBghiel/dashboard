/** what the settings window and "add widget" need about each widget, from the same declarations
 * as about.json. the default refresh rates also go to the timer */

import type { Spec } from "@/components/dashboard/dashboard";
import { cardKey } from "@/components/widgets/registry";
import { DEFAULT_WIDGETS } from "@/server/instances";
import { registry } from "@/server/registry";

export const SPECS: Record<string, Spec> = Object.fromEntries(
  registry.catalog.flatMap((s) =>
    s.widgets.map((w) => [
      cardKey(s.id, w.id),
      { name: w.name, description: w.description, params: w.params, refresh: w.refresh },
    ]),
  ),
);
export const RATES = Object.fromEntries(
  Object.entries(SPECS).map(([k, s]) => [k, s.refresh.default]),
);
export const DEFAULT_ORDER = DEFAULT_WIDGETS.map(([s, w]) => cardKey(s, w));
