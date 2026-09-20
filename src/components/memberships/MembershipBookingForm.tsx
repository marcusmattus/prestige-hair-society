"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TIMES } from "@/lib/services";

function nextDate(days = 1) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function MembershipBookingForm({
  membershipId,
  reschedule,
}: {
  membershipId: string;
  reschedule: boolean;
}) {
  const router = useRouter();
  const [date, setDate] = useState(nextDate());
  const [time, setTime] = useState("10:00");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/membership/visit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ membershipId, date, time, notes, reschedule }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Unable to book your visit");
      router.push("/account?booked=1");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to continue");
      setLoading(false);
    }
  }

  return (
    <div className="join-form" style={{ maxWidth: 520 }}>
      <div className="field-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="field">
          <label htmlFor="date">Preferred date</label>
          <input id="date" type="date" min={nextDate()} max={nextDate(180)} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="time">Preferred time</label>
          <select id="time" value={time} onChange={(e) => setTime(e.target.value)}>
            {TIMES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label htmlFor="notes">Anything we should know</label>
        <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="status-box" style={{ marginTop: 16 }}>
        <strong>£0 due today.</strong> This visit is prepaid as part of your membership — you won’t be charged again. Nekeia will confirm the exact time.
      </div>
      {error && <p role="alert" className="error">{error}</p>}
      <button className="button" disabled={loading} onClick={confirm} style={{ width: "100%", marginTop: 16 }}>
        {loading ? "Booking…" : reschedule ? "Reschedule my visit" : "Confirm prepaid visit"}
      </button>
    </div>
  );
}
