"use client";

/** the settings window behind each card's gear: the refresh rate, and every option the card has no
 * control of its own for. the fields come from the widget's params in the registry (the same list
 * about.json shows), so a new option on a widget gets its field w/o any change here */

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ParamSpec } from "@/server/registry/define";

import { useInstance } from "./instance-context";

// the choices offered, a widget only shows the ones at or above its minimum
const RATES = [60, 120, 300, 600, 1800, 3600, 21_600, 86_400];

function rateLabel(sec: number) {
  if (sec < 3600) return `Every ${sec / 60} min`;
  if (sec < 86_400) return `Every ${sec / 3600} h`;
  return "Once a day";
}

// "show_wind" -> "Show wind"
const labelOf = (name: string) => name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, " ");

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
        {open && <Form key={ctx.instance.id} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function Form({ onDone }: { onDone: () => void }) {
  const ctx = useInstance()!;
  const { instance, spec, notInSettings, ExtraSettings } = ctx;
  const [params, setParams] = useState(instance.params);
  const [refreshSec, setRefreshSec] = useState(instance.refreshSec);
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
    const err = await ctx.save({ params, refreshSec });
    setSaving(false);
    if (err) setError(err);
    else onDone();
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
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** 1 field per param kind: text, number, select or switch */
function Field({
  spec,
  value,
  onChange,
}: {
  spec: ParamSpec;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const id = `param-${spec.name}`;
  const label = labelOf(spec.name);

  if (spec.kind === "boolean") {
    return (
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor={id}>{label}</Label>
        <Switch id={id} checked={value === true} onCheckedChange={onChange} />
      </div>
    );
  }

  if (spec.kind === "enum" && spec.options) {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{label}</Label>
        <Select value={String(value ?? spec.default ?? "")} onValueChange={onChange}>
          <SelectTrigger id={id} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {spec.options.map((o) => (
              <SelectItem key={o} value={o}>
                {labelOf(o)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {spec.kind === "integer" ? (
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={spec.min}
          max={spec.max}
          value={typeof value === "number" ? value : ""}
          // empty clears it (null), the widget default applies again
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
      ) : (
        <Input
          id={id}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
