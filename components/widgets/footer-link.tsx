/** the "open x →" link at the bottom of a widget, always to the full service in a new tab */

import { ArrowRight } from "lucide-react";

export function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
    >
      {children}
      <ArrowRight className="size-3.5" aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
