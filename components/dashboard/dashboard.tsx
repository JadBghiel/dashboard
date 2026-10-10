"use client";

/** the dashboard: the user's saved widgets, grouped in sections. holds the list, saves every change
 * through /api/instances (options, refresh rate, hidden, order) and puts each card in its instance
 * context so its gear and its own controls save to the right widget. w/ nobody signed in it shows
 * the default widgets read only, nothing to save to */

import { useState } from "react";

import {
  InstanceProvider,
  type InstancePatch,
  type InstanceView,
  type WidgetSpec,
} from "@/components/widgets/instance-context";
import { GitHubPlaceholderCard } from "@/components/widgets/github/github-placeholder-card";
import { CARDS, cardKey, SECTIONS, type SectionId } from "@/components/widgets/registry";
import { api } from "@/lib/api";

import { AddWidgetsDialog } from "./add-widgets-dialog";
import { SortableSection } from "./layout-editor";
import { Toolbar } from "./toolbar";

export type Spec = WidgetSpec & { description: string };

const key = (i: InstanceView) => cardKey(i.serviceId, i.widgetId);

export function Dashboard({
  heading,
  notice,
  initial,
  specs,
  signedIn,
  locationKey,
  defaultOrder,
}: {
  // the page title, the toolbar sits on its right
  heading: React.ReactNode;
  // under the header, the location consent question when there is one
  notice?: React.ReactNode;
  initial: InstanceView[];
  specs: Record<string, Spec>;
  signedIn: boolean;
  locationKey: string;
  // the widget keys in the default order, what reset puts back
  defaultOrder: string[];
}) {
  const [instances, setInstances] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(id: string, patch: InstancePatch): Promise<string | null> {
    const res = await api.instances[":id"].$patch({ param: { id }, json: patch });
    const body = await res.json();
    if (!("id" in body)) return body.message;
    setInstances((list) => list.map((i) => (i.id === id ? body : i)));
    return null;
  }

  // a card's own control (a heart, a currency): saved quietly, the card already shows it
  const quiet = (id: string, params: Record<string, unknown>) =>
    update(id, { params }).then((msg) => msg && setError(msg));

  function reorder(ids: string[]) {
    const previous = instances;
    const byId = new Map(instances.map((i) => [i.id, i]));
    setInstances(ids.map((id) => byId.get(id)!));
    setError(null);
    api.instances.order
      .$put({ json: { ids } })
      .then((res) => {
        if (!res.ok) throw new Error();
      })
      .catch(() => {
        setInstances(previous);
        setError("Could not save the new order.");
      });
  }

  // the section's visible cards in their new order, slotted back where that section's cards were
  function reorderSection(section: SectionId, next: string[]) {
    const queue = [...next];
    const inSection = (i: InstanceView) => CARDS[key(i)]?.section === section && !i.hidden;
    reorder(instances.map((i) => (inSection(i) ? queue.shift()! : i.id)));
  }

  function reset() {
    const rank = (i: InstanceView) => defaultOrder.indexOf(key(i));
    reorder([...instances].sort((a, b) => rank(a) - rank(b)).map((i) => i.id));
  }

  async function setShown(widgetKey: string, shown: boolean) {
    setError(null);
    const existing = instances.find((i) => key(i) === widgetKey);
    if (existing) {
      const msg = await update(existing.id, { hidden: !shown });
      return msg && setError(msg);
    }
    const [serviceId, widgetId] = widgetKey.split("/");
    const res = await api.instances.$post({ json: { serviceId, widgetId } });
    const body = await res.json();
    if ("id" in body) setInstances((list) => [...list, body]);
    else setError(body.message);
  }

  return (
    <>
      <Toolbar
        heading={heading}
        signedIn={signedIn}
        editing={editing}
        onToggleEditing={() => setEditing(!editing)}
        onAdd={() => setAdding(true)}
        onReset={reset}
        error={error}
      />
      {notice}

      <AddWidgetsDialog
        open={adding}
        onOpenChange={setAdding}
        specs={specs}
        shown={new Set(instances.filter((i) => !i.hidden).map(key))}
        onToggle={setShown}
      />

      {SECTIONS.map((section) => {
        const visible = instances.filter(
          (i) => !i.hidden && CARDS[key(i)]?.section === section.id && specs[key(i)],
        );
        return (
          <section key={section.id} aria-labelledby={section.id} className="space-y-3">
            <div>
              <h2 id={section.id} className="font-heading text-lg font-semibold tracking-tight">
                {section.title}
              </h2>
              <p className="text-muted-foreground text-sm">{section.description}</p>
            </div>
            {visible.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Nothing here. Add a widget to fill this section.
              </p>
            ) : (
              <SortableSection
                grid={section.grid}
                editing={editing}
                onReorder={(ids) => reorderSection(section.id, ids)}
                onHide={(id) => update(id, { hidden: true }).then((msg) => msg && setError(msg))}
                items={[
                  ...visible.map((instance) => {
                    const card = CARDS[key(instance)];
                    const spec = specs[key(instance)];
                    const onChange = (p: Record<string, unknown>) => quiet(instance.id, p);
                    return {
                      id: instance.id,
                      label: spec.name,
                      className: card.className,
                      node: (
                        <InstanceProvider
                          value={
                            signedIn
                              ? {
                                  instance,
                                  spec,
                                  notInSettings: card.notInSettings ?? [],
                                  ExtraSettings: card.ExtraSettings,
                                  save: (patch) => update(instance.id, patch),
                                }
                              : null
                          }
                        >
                          {card.render(instance.params, {
                            locationKey,
                            onChange: signedIn ? onChange : () => {},
                          })}
                        </InstanceProvider>
                      ),
                    };
                  }),
                  // the github widget waits for oauth2 (#19, #26), shown as a fixed placeholder
                  ...(section.id === "utility"
                    ? [
                        {
                          id: "github-placeholder",
                          label: "GitHub",
                          fixed: true,
                          // 4th, in the 1st row next to weather, stocks and crypto
                          at: 3,
                          node: <GitHubPlaceholderCard />,
                        },
                      ]
                    : []),
                ]}
              />
            )}
          </section>
        );
      })}
    </>
  );
}
