import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Airtable button family: near-black primary + white hairline secondary, 12px
// radius, medium (500) weight — never bold. Active darkens to #0d1218.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-[#0d1218] active:bg-[#0d1218]",
        destructive: "bg-destructive text-destructive-foreground hover:brightness-110",
        outline: "border border-hairline bg-canvas text-ink hover:bg-surface-soft",
        secondary: "bg-surface-soft text-ink border border-hairline hover:bg-surface-strong",
        "on-dark": "bg-canvas text-ink hover:bg-surface-soft",
        ghost: "text-ink hover:bg-surface-soft",
        link: "text-link underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 text-[15px]",
        sm: "h-9 px-3.5 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = "Button";

export { Button, buttonVariants };
