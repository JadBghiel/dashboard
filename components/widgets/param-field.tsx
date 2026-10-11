"use client";

/** 1 widget option as a form field, picked from its kind in the registry: text, number, select or
 * switch */

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

// "show_wind" -> "Show wind"
const labelOf = (name: string) => name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, " ");

/** 1 field per param kind: text, number, select or switch */
export function Field({
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
          placeholder={spec.hint}
          // empty clears it (null), the widget default applies again
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
      ) : (
        <Input
          id={id}
          value={typeof value === "string" ? value : ""}
          placeholder={spec.hint}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
