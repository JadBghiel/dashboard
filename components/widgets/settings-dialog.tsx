"use client";

/** the settings window behind each card's gear: the refresh rate, and every option the card has no
 * control of its own for. the fields come from the widget's params in the registry (the same list
 * about.json shows), so a new option on a widget gets its field w/o any change here. "add widgets"
 * uses the same form to configure a widget before adding it */

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useInstance, type ExtraSettings, type WidgetSpec } from "./instance-context";
import { Field } from "./param-field";

// the choices offered, a widget only shows the ones at or above its minimum
const RATES = [60, 120, 300, 600, 1800, 3600, 21_600, 86_400];

function rateLabel(sec: number) {
  if (sec < 3600) return `Every ${sec / 60} min`;
  if (sec < 86_400) return `Every ${sec / 3600} h`;
  return "Once a day";
}

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const ctx = useInstance();
  if (!ctx) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{ctx.spec.name} settings</DialogTitle>
          <DialogDescription>Saved to your account, the same on every device.</DialogDescription>
        </DialogHeader>
        {/* keyed so every opening starts from what is saved, a cancelled draft doesnt linger */}
        {open && (
          <WidgetForm
            key={ctx.instance.id}
            spec={ctx.spec}
            notInSettings={ctx.notInSettings}
            ExtraSettings={ctx.ExtraSettings}
            initialParams={ctx.instance.params}
            initialRefresh={ctx.instance.refreshSec}
            submitLabel="Save"
            onSubmit={(params, refreshSec) => ctx.save({ params, refreshSec })}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** every param at its default, what a new widget's form starts from */
export const defaultParams = (spec: WidgetSpec) =>
  Object.fromEntries(
    spec.params.filter((p) => p.default !== undefined).map((p) => [p.name, p.default]),
  );

export function WidgetForm({
  spec,
  notInSettings,
  ExtraSettings,
  initialParams,
  initialRefresh,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  spec: WidgetSpec;
  notInSettings: readonly string[];
  ExtraSettings?: ExtraSettings;
  initialParams: Record<string, unknown>;
  initialRefresh: number;
  submitLabel: string;
  // resolves to an error message, or null once saved, the form then calls onCancel to close
  onSubmit: (params: Record<string, unknown>, refreshSec: number) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [params, setParams] = useState(initialParams);
  const [refreshSec, setRefreshSec] = useState(initialRefresh);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fields = spec.params.filter((p) => !notInSettings.includes(p.name));
  const rates = [...new Set([...RATES.filter((r) => r >= spec.refresh.min), refreshSec])].sort(
    (a, b) => a - b,
  );
  const set = (patch: Record<string, unknown>) => setParams((p) => ({ ...p, ...patch }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const err = await onSubmit(params, refreshSec);
    setSaving(false);
    if (err) setError(err);
    else onCancel();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="refresh-rate">Refresh rate</Label>
        <Select value={String(refreshSec)} onValueChange={(v) => setRefreshSec(Number(v))}>
          <SelectTrigger id="refresh-rate" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {rates.map((r) => (
              <SelectItem key={r} value={String(r)}>
                {rateLabel(r)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {fields.map((p) => (
        <Field
          key={p.name}
          spec={p}
          value={params[p.name]}
          onChange={(v) => set({ [p.name]: v })}
        />
      ))}

      {ExtraSettings && <ExtraSettings params={params} onChange={set} />}

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
