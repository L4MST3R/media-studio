import type { ReactNode } from "react";

/** A labelled control in a generator's settings row. */
export function Setting({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="text-sm font-medium">{label}</div>
      {children}
    </div>
  );
}
