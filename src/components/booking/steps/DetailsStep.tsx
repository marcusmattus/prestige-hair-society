"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import {
  customerDetailsSchema,
  type CustomerDetails,
  type CustomerDetailsInput,
} from "@/lib/validation";

export function DetailsStep({
  defaultValues,
  signedIn,
  onSubmit,
  formId,
}: {
  defaultValues?: Partial<CustomerDetailsInput>;
  signedIn: boolean;
  onSubmit: (details: CustomerDetails) => void;
  /** The sticky footer's button submits this form by id. */
  formId: string;
}) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CustomerDetailsInput, unknown, CustomerDetails>({
    resolver: zodResolver(customerDetailsSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      birthday: "",
      hairGoals: "",
      notes: "",
      accessibilityRequirements: "",
      marketingEmail: false,
      marketingSms: false,
      ...defaultValues,
    },
  });

  return (
    <div>
      <h2 className="mb-1 font-serif text-[30px] font-light md:text-[36px]">Your details</h2>
      <p className="mb-6 text-[15px] text-muted">
        {signedIn
          ? "Check these are still right before you pay."
          : "We will create an account so you can manage this booking later."}
      </p>

      {!signedIn && (
        <p className="mb-6 rounded-[6px] border border-line bg-sand px-5 py-4 text-[14px] leading-[1.6] text-muted">
          Been to us before?{" "}
          <Link href="/sign-in?next=/book" className="text-moss underline underline-offset-2">
            Sign in
          </Link>{" "}
          and we will fill this in for you.
        </p>
      )}

      <form id={formId} onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" error={errors.firstName?.message}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                autoComplete="given-name"
                {...register("firstName")}
              />
            )}
          </Field>
          <Field label="Last name" error={errors.lastName?.message}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                autoComplete="family-name"
                {...register("lastName")}
              />
            )}
          </Field>
        </div>

        <Field
          label="Email address"
          description="Your confirmation and reminders go here."
          error={errors.email?.message}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="email"
              aria-describedby={describedBy}
              invalid={invalid}
              autoComplete="email"
              {...register("email")}
            />
          )}
        </Field>

        <Field label="Mobile number" error={errors.phone?.message}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="tel"
              aria-describedby={describedBy}
              invalid={invalid}
              autoComplete="tel"
              {...register("phone")}
            />
          )}
        </Field>

        <Field label="Birthday (optional)" error={errors.birthday?.message}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="date"
              aria-describedby={describedBy}
              invalid={invalid}
              autoComplete="bday"
              {...register("birthday")}
            />
          )}
        </Field>

        <Field
          label="Hair goals (optional)"
          description="What you are working towards, so your stylist can plan."
          error={errors.hairGoals?.message}
        >
          {({ id, describedBy }) => (
            <Textarea id={id} rows={3} aria-describedby={describedBy} {...register("hairGoals")} />
          )}
        </Field>

        <Field
          label="Anything else we should know? (optional)"
          error={errors.notes?.message}
        >
          {({ id, describedBy }) => (
            <Textarea id={id} rows={3} aria-describedby={describedBy} {...register("notes")} />
          )}
        </Field>

        <Field
          label="Accessibility requirements (optional)"
          description="Step-free access, a quieter time of day, extra time — tell us and we will arrange it."
          error={errors.accessibilityRequirements?.message}
        >
          {({ id, describedBy }) => (
            <Textarea
              id={id}
              rows={2}
              aria-describedby={describedBy}
              {...register("accessibilityRequirements")}
            />
          )}
        </Field>

        <fieldset className="mt-2 grid gap-3 border-t border-line pt-5">
          <legend className="sr-only">Contact preferences</legend>
          <Checkbox
            checked={watch("marketingEmail")}
            onCheckedChange={(v) => setValue("marketingEmail", v === true)}
            label="Email me occasional salon news and offers."
          />
          <Checkbox
            checked={watch("marketingSms")}
            onCheckedChange={(v) => setValue("marketingSms", v === true)}
            label="Text me occasional salon news and offers."
          />
          <Checkbox
            checked={watch("acceptedPolicy") === true}
            onCheckedChange={(v) =>
              setValue("acceptedPolicy", (v === true) as true, { shouldValidate: true })
            }
            label={
              <>
                I accept the{" "}
                <Link href="/policies" className="underline underline-offset-2" target="_blank">
                  cancellation policy
                </Link>{" "}
                and understand the deposit is non-refundable within 24 hours of
                the appointment.
              </>
            }
          />
          {errors.acceptedPolicy && (
            <p role="alert" className="text-[13px] text-[#B4483C]">
              {errors.acceptedPolicy.message}
            </p>
          )}
        </fieldset>
      </form>
    </div>
  );
}
