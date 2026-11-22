import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";

/** A dropdown of fixed options with plain labels. */
export function ChoiceSelect<T extends string>({
  items,
  value,
  onChange,
  label,
  testId,
  className,
}: {
  items: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  testId?: string;
  className?: string;
}) {
  return (
    <Select
      items={items.map((item) => ({ value: item.value, label: item.label }))}
      value={value}
      onValueChange={(next) => {
        if (next !== null) onChange(next as T);
      }}
    >
      <SelectTrigger
        aria-label={label}
        data-testid={testId}
        className={className ?? "w-full"}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
