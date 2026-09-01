import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/SignInForm";
import { SiteFooter } from "@/components/sections/SiteFooter";
import { SiteHeader } from "@/components/sections/SiteHeader";
import { getSessionUser } from "@/lib/auth/roles";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to manage your appointments at Prestige Hair Society.",
  robots: { index: false, follow: true },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const user = await getSessionUser();

  // Already signed in: go where they were headed.
  if (user) redirect(safeNext(next));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[440px] px-5 py-16 md:px-10 lg:py-24">
        <h1 className="mb-2 font-serif text-[36px] leading-[1.1] font-light">
          Welcome back.
        </h1>
        <p className="mb-8 text-[15px] leading-[1.7] text-muted">
          Sign in to see your appointments, rebook a favourite service or update
          your preferences.
        </p>

        <SignInForm next={safeNext(next)} initialError={error} />

        <p className="mt-8 text-[14px] text-muted">
          New here?{" "}
          <Link href="/sign-up" className="text-moss underline underline-offset-2">
            Create an account
          </Link>{" "}
          — or just{" "}
          <Link href="/book" className="text-moss underline underline-offset-2">
            book an appointment
          </Link>{" "}
          and we will set one up for you.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}

/**
 * Only ever redirect to a path on this site. An open redirect here would let a
 * phishing link bounce a freshly authenticated user to an attacker's page.
 */
function safeNext(next: string | undefined): string {
  if (!next) return "/account";
  if (!next.startsWith("/") || next.startsWith("//")) return "/account";
  return next;
}
