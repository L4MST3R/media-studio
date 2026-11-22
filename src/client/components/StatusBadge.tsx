import { Badge } from "@/client/components/ui/badge";
import type { Status } from "@/shared/options";

export const STATUS_LABELS: Record<Status, string> = {
  pending: "Generating",
  queued: "Queued",
  processing: "Processing",
  succeeded: "Ready",
  failed: "Failed",
};

export function StatusBadge({
  status,
  testId,
}: {
  status: Status;
  testId?: string;
}) {
  const variant =
    status === "failed"
      ? "destructive"
      : status === "succeeded"
        ? "secondary"
        : "soft";
  return (
    <Badge variant={variant} data-testid={testId}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
