import { CircleAlert, PlugZap } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/client/components/ui/alert";

/** The generator's key isn't set on the Gateway. */
export function GeneratorOff({
  name,
  setup,
}: {
  name: string;
  setup: string | null;
}) {
  return (
    <Alert variant="warning" data-testid="feature-off">
      <PlugZap />
      <AlertTitle>{name} is off</AlertTitle>
      <AlertDescription>
        {setup ?? "An admin needs to add the provider key on the Gateway."}
      </AlertDescription>
    </Alert>
  );
}

export function GenerationFailed({ message }: { message: string }) {
  return (
    <Alert variant="destructive" data-testid="generation-error">
      <CircleAlert />
      <AlertTitle>Generation failed</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
