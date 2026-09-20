import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SignInForm } from "@/components/auth/SignInForm";

export const metadata: Metadata = {
  title: "Sign in · Prestige Hair Society",
  robots: { index: false },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // Only allow same-site relative redirects.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/account";

  return (
    <>
      <div className="notice">Prestige Hair Society &nbsp; ◆ &nbsp; Membership account</div>
      <SiteHeader />
      <main className="shell" style={{ padding: "60px 0 110px" }}>
        <SignInForm next={safeNext} />
      </main>
    </>
  );
}
