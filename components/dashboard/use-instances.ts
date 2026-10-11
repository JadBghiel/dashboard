"use client";

/** the dashboard's widget list and every change to it, each saved through /api/instances: add,
 * options and refresh rate, order, remove, and undo of the last remove. a change shows at once and
 * goes back if the server says no */

import { useCallback, useState } from "react";

import type { InstancePatch, InstanceView } from "@/components/widgets/instance-context";
import { CARDS, cardKey } from "@/components/widgets/registry";
import type { SectionId } from "@/lib/sections";
import { api } from "@/lib/api";

export const key = (i: InstanceView) => cardKey(i.serviceId, i.widgetId);

export function useInstances(initial: InstanceView[], defaultOrder: string[]) {
  const [instances, setInstances] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  // the last widget removed and where it was, while its undo is offered
  const [removed, setRemoved] = useState<{ instance: InstanceView; index: number } | null>(null);
  const closeUndo = useCallback(() => setRemoved(null), []);

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

  // list: the widgets the ids point at, when one was just added and isnt in the state yet
  function reorder(ids: string[], list = instances) {
    const previous = list;
    const byId = new Map(list.map((i) => [i.id, i]));
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
    const inSection = (i: InstanceView) => CARDS[key(i)]?.section === section;
    reorder(instances.map((i) => (inSection(i) ? queue.shift()! : i.id)));
  }

  function reset() {
    const rank = (i: InstanceView) => defaultOrder.indexOf(key(i));
    reorder([...instances].sort((a, b) => rank(a) - rank(b)).map((i) => i.id));
  }

  // a new widget, at the end of its section
  async function add(widgetKey: string, params: Record<string, unknown>, refreshSec: number) {
    const [serviceId, widgetId] = widgetKey.split("/");
    const res = await api.instances.$post({ json: { serviceId, widgetId, params, refreshSec } });
    const body = await res.json();
    if (!("id" in body)) return body.message;
    setInstances((list) => [...list, body]);
    return null;
  }

  // gone from the screen at once, back in its place if the server says no
  async function remove(id: string) {
    setError(null);
    const index = instances.findIndex((i) => i.id === id);
    const instance = instances[index];
    setInstances((list) => list.filter((i) => i.id !== id));
    const res = await api.instances[":id"].$delete({ param: { id } });
    if (res.ok) return setRemoved({ instance, index });
    setInstances((list) => [...list.slice(0, index), instance, ...list.slice(index)]);
    setError("Could not remove the widget.");
  }

  // the removed widget added again w/ the same settings, then moved back to where it was
  async function undo() {
    if (!removed) return;
    const { instance, index } = removed;
    setRemoved(null);
    const { serviceId, widgetId, params, refreshSec } = instance;
    const res = await api.instances.$post({ json: { serviceId, widgetId, params, refreshSec } });
    const body = await res.json();
    if (!("id" in body)) return setError(body.message);
    const ids = instances.map((i) => i.id);
    ids.splice(index, 0, body.id);
    reorder(ids, [...instances, body]);
  }

  return {
    instances,
    error,
    setError,
    removed,
    closeUndo,
    update,
    quiet,
    reorderSection,
    reset,
    add,
    remove,
    undo,
  };
}
