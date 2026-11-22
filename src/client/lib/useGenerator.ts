import { useState } from "react";
import type { Generation } from "@/server/generations";

type Answer =
  | { off: false; generation: Generation }
  | { off: true; setup: string | null }
  | { off: false; error: string };

/** Runs a generator's server function and keeps what the page shows. */
export function useGenerator() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Generation | null>(null);
  const [off, setOff] = useState<{ setup: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(call: () => Promise<Answer>) {
    setPending(true);
    setError(null);
    try {
      const answer = await call();
      if (answer.off) {
        setOff({ setup: answer.setup });
        setResult(null);
      } else if ("error" in answer) {
        setError(answer.error);
      } else {
        setOff(null);
        setResult(answer.generation);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That didn't work.");
    } finally {
      setPending(false);
    }
  }

  const failure =
    error ?? (result?.status === "failed" ? (result.error ?? null) : null);
  return { pending, result, setResult, off, failure, run };
}
