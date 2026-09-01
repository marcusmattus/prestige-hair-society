"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { appUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  magicLinkSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation";

/**
 * Auth server actions.
 *
 * All of them return a plain `{ error }` rather than throwing, so the forms can
 * show a message inline. Error text is deliberately vague about whether an
 * account exists: "those details did not match" rather than "no such user",
 * which would turn the sign-in form into an account-enumeration oracle.
 */

export type AuthResult = { error?: string; message?: string };

export async function signInAction(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) return { error: "Enter your email address and password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    await audit({
      action: "auth.sign_in_failed",
      entityType: "auth",
      metadata: { email: parsed.data.email },
    });
    return { error: "Those details did not match an account. Please try again." };
  }

  const next = String(formData.get("next") ?? "/account");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/account");
}

export async function signUpAction(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const parsed = signUpSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details you entered." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${appUrl}/auth/callback`,
      data: {
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
        phone: parsed.data.phone,
      },
    },
  });

  if (error) {
    // Supabase already avoids confirming whether an address is registered;
    // keep it that way.
    return {
      message:
        "Check your inbox — if that address can be used, a confirmation link is on its way.",
    };
  }

  return {
    message: "Check your inbox to confirm your email address, then sign in.",
  };
}

export async function magicLinkAction(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const parsed = magicLinkSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "Enter a valid email address." };

  const supabase = await createClient();
  await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${appUrl}/auth/callback` },
  });

  // Always the same reply, whether or not the address is registered.
  return { message: "If that address has an account, a sign-in link is on its way." };
}

export async function resetPasswordAction(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const parsed = resetPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "Enter a valid email address." };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${appUrl}/auth/callback?next=/account/profile`,
  });

  return { message: "If that address has an account, a reset link is on its way." };
}

export async function signInWithProviderAction(formData: FormData) {
  const provider = String(formData.get("provider"));
  if (provider !== "google" && provider !== "apple") {
    redirect("/sign-in?error=unsupported_provider");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${appUrl}/auth/callback` },
  });

  if (error || !data.url) redirect("/sign-in?error=provider_unavailable");
  redirect(data.url);
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
