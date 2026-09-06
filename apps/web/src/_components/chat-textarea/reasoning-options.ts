import type { ReasoningEffort } from "@/lib/types";

export const REASONING_OPTIONS = {
  none: { label: "None" },
  minimal: { label: "Minimal" },
  low: { label: "Low" },
  medium: { label: "Medium" },
  high: { label: "High" },
  xhigh: { label: "Extra High" },
  max: { label: "Max" },
} satisfies Record<ReasoningEffort, { label: string }>;
