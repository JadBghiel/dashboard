"use client";

/** the dashboard: the user's saved widgets, grouped in sections. holds the list, saves every change
 * through useInstances (add, options, refresh rate, order, remove) and puts each card in its
 * instance context so its gear and its own controls save to the right widget. w/ nobody signed in
 * it shows the default widgets read only, nothing to save to */

import { useState } from "react";

import {
  InstanceProvider,
  type InstanceView,
  type WidgetSpec,
} from "@/components/widgets/instance-context";
import { GitHubPlaceholderCard } from "@/components/widgets/github/github-placeholder-card";
import { CARDS, SECTIONS } from "@/components/widgets/registry";

import { AddWidgetsDialog } from "./add-widgets-dialog";
import { SortableSection } from "./layout-editor";
import { Toolbar } from "./toolbar";
import { UndoBar } from "./undo-bar";
import { key, useInstances } from "./use-instances";

export type Spec = WidgetSpec & { description: string };

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
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const {
    instances,
    error,
    removed,
    closeUndo,
    update,
    quiet,
    reorderSection,
    reset,
    add,
    remove,
    undo,
  } = useInstances(initial, defaultOrder);

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
        counts={instances.reduce(
          (m, i) => m.set(key(i), (m.get(key(i)) ?? 0) + 1),
          new Map<string, number>(),
        )}
        onAdd={add}
      />

      {removed && (
        <UndoBar
          key={removed.instance.id}
          label={specs[key(removed.instance)]?.name ?? "Widget"}
          onUndo={undo}
          onClose={closeUndo}
        />
      )}

      {SECTIONS.map((section) => {
        const visible = instances.filter(
          (i) => CARDS[key(i)]?.section === section.id && specs[key(i)],
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
                onRemove={remove}
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
