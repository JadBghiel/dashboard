"use client";

/** the saved widget a card is showing: its options, its refresh rate, and save() to change them. the
 * dashboard puts it around each card, the card, its header and useWidgetData read it */

import { createContext, useContext } from "react";

import type { ParamSpec } from "@/server/registry/define";

export type InstanceView = {
  id: string;
  serviceId: string;
  widgetId: string;
  params: Record<string, unknown>;
  refreshSec: number;
};

/** what the settings window needs to know about a widget, from the registry catalog */
export type WidgetSpec = {
  name: string;
  params: ParamSpec[];
  refresh: { default: number; min: number };
};

export type InstancePatch = {
  params?: Record<string, unknown>;
  refreshSec?: number;
};

/** a card's own settings section, for options a plain field cant render well (the news topics) */
export type ExtraSettings = React.ComponentType<{
  params: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}>;

type Instance = {
  instance: InstanceView;
  spec: WidgetSpec;
  // options the card already has its own control for, or that ExtraSettings renders: the settings
  // window leaves them out so nothing shows twice
  notInSettings: readonly string[];
  ExtraSettings?: ExtraSettings;
  // resolves to an error message, or null once saved
  save: (patch: InstancePatch) => Promise<string | null>;
};

const InstanceContext = createContext<Instance | null>(null);

export const InstanceProvider = InstanceContext.Provider;

/** null outside the dashboard */
export const useInstance = () => useContext(InstanceContext);
