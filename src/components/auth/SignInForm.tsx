"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import {
  magicLinkAction,
  signInAction,
  signInWithProviderAction,
  type AuthResult,
} from "@/lib/auth/actions";

const ERROR_MESSAGES: Record<string, string> = {
  link_expired: "That link has expired. Request a new one below.",
  missing_code: "That sign-in link was incomplete. Please try again.",
  provider_unavailable: "That sign-in method is not available right now.",
  unsupported_provider: "That sign-in method is not supported.",
};

export function SignInForm({
  next,
  initialError,
}: {
  next: string;
  initialError?: string;
}) {
  const [mode, setMode] = useState<"password" | "link">("password");
  const [passwordState, passwordAction, passwordPending] = useActionState<
    AuthResult | null,
    FormData
  >(signInAction, null);
  const [linkState, linkFormAction, linkPending] = useActionState<AuthResult | null, FormData>(
    magicLinkAction,
    null,
  );

  const state = mode === "password" ? passwordState : linkState;
  const pending = mode === "password" ? passwordPending : linkPending;
  const bannerError = state?.error ?? (initialError ? ERROR_MESSAGES[initialError] : undefined);

  return (
    <div>
      {bannerError && (
        <p
          role="alert"
          className="mb-6 rounded-[6px] border border-[#B4483C] bg-[#B4483C]/5 px-4 py-3 text-[14px] text-[#B4483C]"
        >
          {bannerError}
        </p>
      )}

      {state?.message && (
        <p
          role="status"
          className="mb-6 rounded-[6px] border border-line bg-sand px-4 py-3 text-[14px] text-muted"
        >
          {state.message}
        </p>
      )}

      {mode === "password" ? (
        <form action={passwordAction} className="grid gap-4">
          <input type="hidden" name="next" value={next} />

          <Field label="Email address">
            {({ id }) => (
              <Input id={id} name="email" type="email" autoComplete="email" required />
            )}
          </Field>

          <Field label="Password">
            {({ id }) => (
              <Input
                id={id}
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            )}
          </Field>

          <Button type="submit" size="full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      ) : (
        <form action={linkFormAction} className="grid gap-4">
          <Field
            label="Email address"
            description="We will email you a link that signs you straight in."
          >
            {({ id, describedBy }) => (
              <Input
                id={id}
                name="email"
                type="email"
                autoComplete="email"
                aria-describedby={describedBy}
                required
              />
            )}
          </Field>

          <Button type="submit" size="full" disabled={pending}>
            {pending ? "Sending…" : "Email me a sign-in link"}
          </Button>
        </form>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[14px]">
        <button
          type="button"
          onClick={() => setMode(mode === "password" ? "link" : "password")}
          className="cursor-pointer text-moss underline underline-offset-2"
        >
          {mode === "password" ? "Email me a link instead" : "Use a password instead"}
        </button>
        <Link href="/forgot-password" className="text-muted underline underline-offset-2">
          Forgotten password?
        </Link>
      </div>

      <div className="my-8 flex items-center gap-4">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[12px] tracking-[0.14em] text-sage uppercase">or</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <div className="grid gap-3">
        <form action={signInWithProviderAction}>
          <input type="hidden" name="provider" value="google" />
          <Button type="submit" variant="outline" size="full">
            Continue with Google
          </Button>
        </form>
        <form action={signInWithProviderAction}>
          <input type="hidden" name="provider" value="apple" />
          <Button type="submit" variant="outline" size="full">
            Continue with Apple
          </Button>
        </form>
      </div>
    </div>
  );
}
