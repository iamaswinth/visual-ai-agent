import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Small labels. 6px radius (pill is reserved for the pricing sub-system).
// Signature-color variants carry categorical voltage.
const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-hairline bg-surface-soft text-ink",
        muted: "border-hairline bg-transparent text-muted-foreground",
        outline: "border-hairline bg-transparent text-body",
        coral: "border-transparent bg-coral text-white",
        forest: "border-transparent bg-forest text-white",
        navy: "border-transparent bg-ink text-white",
        cream: "border-transparent bg-cream text-ink",
        mint: "border-transparent bg-mint text-ink",
        mustard: "border-transparent bg-mustard text-ink",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
