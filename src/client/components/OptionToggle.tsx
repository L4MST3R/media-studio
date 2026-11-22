import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/client/components/ui/toggle-group";

/** A single choice among a few text options, as a segmented control. */
export function OptionToggle<T extends string | number>({
  items,
  value,
  onChange,
  label,
}: {
  items: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <ToggleGroup
      aria-label={label}
      size="sm"
      spacing={0.5}
      value={[String(value)]}
      onValueChange={(next) => {
        // A press on the active item empties the group. Keep one item on.
        const picked = items.find((item) => String(item.value) === next[0]);
        if (picked) onChange(picked.value);
      }}
      className="flex-wrap rounded-lg border border-border bg-muted p-0.5 data-[size=sm]:rounded-lg"
    >
      {items.map((item) => (
        <ToggleGroupItem
          key={String(item.value)}
          value={String(item.value)}
          className="h-7 px-2.5 text-muted-foreground aria-pressed:bg-primary/15 aria-pressed:text-primary"
        >
          {item.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
