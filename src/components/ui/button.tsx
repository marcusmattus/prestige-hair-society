import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Buttons, in the shapes the design uses.
 *
 * Sizes carry the design's exact padding rather than a generic scale, and
 * every variant clears a 44px minimum touch target (WCAG 2.2 AA, 2.5.8).
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[4px] tracking-[0.03em] " +
    "transition-colors cursor-pointer whitespace-nowrap " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold " +
    "disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-ink text-sand hover:bg-ink-hover disabled:hover:bg-ink",
        outline: "border border-line text-ink hover:border-gold",
        ghost: "text-muted hover:text-ink",
        quiet: "text-moss hover:text-gold",
        danger: "border border-line text-ink hover:border-[#B4483C] hover:text-[#B4483C]",
      },
      size: {
        sm: "min-h-[44px] px-[26px] py-[13px] text-[14px]",
        md: "min-h-[48px] px-[34px] py-[17px] text-[15px]",
        lg: "min-h-[48px] px-8 py-[18px] text-[15px] sm:px-[42px]",
        full: "min-h-[50px] w-full p-4 text-[15px]",
        icon: "h-11 w-11 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  type = "button",
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      {...(asChild ? {} : { type })}
      {...props}
    />
  );
}

export { buttonVariants };
