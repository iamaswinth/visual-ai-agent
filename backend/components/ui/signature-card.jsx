import * as React from "react";
import { cn } from "@/lib/utils";

// Full-bleed signature surface card — the brand's "voltage moment"
// (DESIGN-airtable.md). Color-block first: no shadow, no border, 12px radius,
// 48px padding for the strong tones / 24px for cream. Never used as a small accent.
const TONES = {
  coral: "bg-coral text-white",
  forest: "bg-forest text-white",
  navy: "bg-ink text-white",
  cream: "bg-cream text-ink",
  soft: "bg-surface-soft text-ink",
  strong: "bg-surface-strong text-ink",
};

const SignatureCard = React.forwardRef(({ className, tone = "navy", ...props }, ref) => (
  <div
    ref={ref}
    className={cn("rounded-lg", tone === "cream" ? "p-6" : "p-8 md:p-10", TONES[tone] || TONES.navy, className)}
    {...props}
  />
));
SignatureCard.displayName = "SignatureCard";

export { SignatureCard };
