"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Passwordless sign-in: email a one-time code, then verify it. */
export function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [stage, setStage] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!/\S+@\S+\.\S+/.test(email)) { setError("Enter a valid email address."); return; }
    setLoading(true); setError(""); setNotice("");
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setStage("code");
    setNotice(`We’ve emailed a 6-digit code to ${email}.`);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) { setError("Enter the 6-digit code from your email."); return; }
    setLoading(true); setError("");
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: "email" });
    setLoading(false);
    if (error) { setError(error.message); return; }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="join-form" style={{ maxWidth: 460, margin: "0 auto" }}>
      <span className="eyebrow">Membership account</span>
      <h1 style={{ fontSize: 34, margin: "8px 0 4px" }}>Sign in</h1>
      <p className="prog-summary" style={{ marginBottom: 18 }}>
        Access your programme, appointments and payment plan. We’ll email you a one-time code — no password needed.
      </p>

      {stage === "email" ? (
        <form onSubmit={sendCode}>
          <div className="field">
            <label htmlFor="email">Email address</label>
            <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          {error && <p role="alert" className="error">{error}</p>}
          <button className="button" disabled={loading} style={{ width: "100%", marginTop: 16 }}>
            {loading ? "Sending…" : "Email me a code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify}>
          {notice && <p className="prog-summary" style={{ color: "#53664a" }}>{notice}</p>}
          <div className="field" style={{ marginTop: 8 }}>
            <label htmlFor="code">6-digit code</label>
            <input id="code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" maxLength={6} />
          </div>
          {error && <p role="alert" className="error">{error}</p>}
          <button className="button" disabled={loading} style={{ width: "100%", marginTop: 16 }}>
            {loading ? "Verifying…" : "Verify & sign in"}
          </button>
          <button type="button" className="button alt" onClick={() => { setStage("email"); setCode(""); setError(""); }} style={{ width: "100%", marginTop: 10 }}>
            Use a different email
          </button>
        </form>
      )}
    </div>
  );
}
