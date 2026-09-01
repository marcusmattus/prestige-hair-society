"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Form controls.
 *
 * Every one wires label, description and error to the input with real
 * `id`/`aria-describedby`/`aria-invalid` attributes, so an error is announced
 * rather than merely coloured red.
 */

const CONTROL =
  "w-full rounded-[4px] border border-line bg-white px-3.5 py-[13px] text-[14px] " +
  "text-ink min-h-[46px] transition-colors " +
  "focus:border-gold focus:outline-none " +
  "aria-[invalid=true]:border-[#B4483C]";

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("block text-[13px] tracking-[0.04em] text-muted", className)}
      {...props}
    />
  );
}

export function FieldError({ id, children }: { id: string; children?: string }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-[13px] text-[#B4483C]">
      {children}
    </p>
  );
}

type FieldWrapperProps = {
  label?: string;
  description?: string;
  error?: string;
  className?: string;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => React.ReactNode;
};

export function Field({ label, description, error, className, children }: FieldWrapperProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const descriptionId = `${id}-description`;
  const describedBy =
    [error ? errorId : null, description ? descriptionId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className={className}>
      {label && (
        <Label htmlFor={id} className="mb-1.5">
          {label}
        </Label>
      )}
      {children({ id, describedBy, invalid: !!error })}
      {description && (
        <p id={descriptionId} className="mt-1.5 text-[13px] leading-[1.55] text-muted">
          {description}
        </p>
      )}
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
}

export function Input({
  className,
  invalid,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input className={cn(CONTROL, className)} aria-invalid={invalid || undefined} {...props} />
  );
}

export function Textarea({
  className,
  invalid,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={cn(CONTROL, "resize-y", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Select({
  className,
  invalid,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select className={cn(CONTROL, className)} aria-invalid={invalid || undefined} {...props} />
  );
}

export function Checkbox({
  label,
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root> & { label: React.ReactNode }) {
  const id = useId();
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <CheckboxPrimitive.Root
        id={id}
        className={
          "mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[3px] " +
          "border border-line bg-white transition-colors cursor-pointer " +
          "data-[state=checked]:border-ink data-[state=checked]:bg-ink " +
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        }
        {...props}
      >
        <CheckboxPrimitive.Indicator>
          <Check className="h-3 w-3 text-sand" strokeWidth={3} />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      <label
        htmlFor={id}
        className="cursor-pointer text-[13px] leading-[1.55] text-muted"
      >
        {label}
      </label>
    </div>
  );
}
