import * as React from "react";
import { cn } from "@/lib/utils";

// text-input: white, ink text, 6px radius, 44px height, hairline border.
// Focus recolors the border to info-border (#458fff).
const Input = React.forwardRef(({ className, type, ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      "flex h-11 w-full rounded-sm border border-hairline bg-canvas px-4 py-2 text-sm text-ink transition-colors placeholder:text-muted-foreground focus-visible:border-[#458fff] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
