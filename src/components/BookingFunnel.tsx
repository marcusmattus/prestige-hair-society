"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, SERVICES, TIMES, pounds } from "@/lib/services";

type Details = { firstName:string; lastName:string; email:string; phone:string; notes:string; updates:boolean; agreed:boolean };

function nextDate(days = 1) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0,10);
}

export function BookingFunnel() {
  const [step,setStep] = useState(1);
  const [serviceId,setServiceId] = useState(SERVICES.find(s=>s.name.includes("Silk Press — Medium"))?.id || SERVICES[0].id);
  const [category,setCategory] = useState("All services");
  const [query,setQuery] = useState("");
  const [date,setDate] = useState(nextDate());
  const [time,setTime] = useState("10:00");
  const [details,setDetails] = useState<Details>({firstName:"",lastName:"",email:"",phone:"",notes:"",updates:true,agreed:false});
  const [payMode,setPayMode] = useState<"deposit"|"full">("deposit");
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");
  const bookingId = useRef("");
  // Generate the client booking id after mount: crypto/Date.now are impure and
  // must not run during render. It is only read once checkout is submitted.
  useEffect(() => { if (!bookingId.current) bookingId.current = globalThis.crypto?.randomUUID?.() || `phs-${Date.now()}`; }, []);
  const service = SERVICES.find(s=>s.id===serviceId) || SERVICES[0];

  const filtered = useMemo(() => SERVICES.filter(item =>
    (category === "All services" || item.category === category) &&
    `${item.name} ${item.category}`.toLowerCase().includes(query.toLowerCase())
  ),[category,query]);

  const ready = details.firstName.trim() && details.lastName.trim() && /\S+@\S+\.\S+/.test(details.email) && details.phone.trim() && details.agreed;
  const setDetail = <K extends keyof Details>(key:K,value:Details[K]) => setDetails(current=>({...current,[key]:value}));

  async function checkout() {
    if (!ready) return;
    if (!bookingId.current) bookingId.current = globalThis.crypto?.randomUUID?.() || `phs-${Date.now()}`;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/checkout", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({bookingId:bookingId.current,serviceId,date,time,payment:payMode,...details}) });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || "Unable to open secure checkout");
      window.location.assign(data.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to continue");
      setLoading(false);
    }
  }

  return <div className="funnel">
    <ol className="steps">
      {[{n:1,t:"Service",s:"Choose your treatment"},{n:2,t:"Date & time",s:"Request your slot"},{n:3,t:"Your details",s:"Secure your deposit"}].map(item=><li key={item.n} className={`step ${step===item.n?"active":""}`}><span className="step-num">{item.n}</span><span>{item.t}<small>{item.s}</small></span></li>)}
    </ol>

    <div className="funnel-main">
      {step===1 && <>
        <h3>Choose your service</h3><p className="muted">All published prices are available. Search or filter to find your treatment.</p>
        <div className="field-grid"><div className="field"><label htmlFor="category">Category</label><select id="category" value={category} onChange={e=>setCategory(e.target.value)}><option>All services</option>{CATEGORIES.map(item=><option key={item}>{item}</option>)}</select></div><div className="field"><label htmlFor="search">Search</label><input id="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Silk press, locs, colour…"/></div></div>
        <div className="service-list" style={{marginTop:18}}>{filtered.map(item=><button className={`service ${serviceId===item.id?"active":""}`} key={item.id} onClick={()=>setServiceId(item.id)}><span><strong>{item.name}</strong><small>{item.category} · approx. {item.duration} min</small></span><strong>{pounds(item.price)}</strong></button>)}{filtered.length===0&&<p className="muted">No service matches that search.</p>}</div>
      </>}

      {step===2 && <>
        <h3>Request a date & time</h3><p className="muted">Times are shown in Europe/London. Nekeia will confirm availability after your deposit authorisation.</p>
        <div className="field-grid"><div className="field"><label htmlFor="date">Preferred date</label><input id="date" type="date" min={nextDate()} max={nextDate(120)} value={date} onChange={e=>setDate(e.target.value)}/></div><div className="field"><label htmlFor="time">Preferred time</label><select id="time" value={time} onChange={e=>setTime(e.target.value)}>{TIMES.map(item=><option key={item}>{item}</option>)}</select></div></div>
        <div className="status-box"><strong>Your requested slot is not charged immediately.</strong><br/>Stripe securely authorises the deposit. It stays on hold while the studio reviews the appointment.</div>
      </>}

      {step===3 && <>
        <h3>Your booking details</h3><p className="muted">We use these details for your receipt, confirmation and any booking changes.</p>
        <div className="field-grid"><div className="field"><label htmlFor="first">First name</label><input id="first" autoComplete="given-name" value={details.firstName} onChange={e=>setDetail("firstName",e.target.value)}/></div><div className="field"><label htmlFor="last">Last name</label><input id="last" autoComplete="family-name" value={details.lastName} onChange={e=>setDetail("lastName",e.target.value)}/></div><div className="field"><label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" value={details.email} onChange={e=>setDetail("email",e.target.value)}/></div><div className="field"><label htmlFor="phone">Mobile number</label><input id="phone" type="tel" autoComplete="tel" value={details.phone} onChange={e=>setDetail("phone",e.target.value)}/></div></div>
        <div className="field" style={{marginTop:14}}><label htmlFor="notes">Hair goals or preparation notes</label><textarea id="notes" value={details.notes} onChange={e=>setDetail("notes",e.target.value)}/></div>
        <label className="check"><input type="checkbox" checked={details.updates} onChange={e=>setDetail("updates",e.target.checked)}/><span>Email me the confirmation, payment status and important appointment updates.</span></label>
        <label className="check"><input type="checkbox" checked={details.agreed} onChange={e=>setDetail("agreed",e.target.checked)}/><span>I accept the cancellation policy and authorise the stated deposit hold.</span></label>
        {error&&<p role="alert" className="error">{error}</p>}
      </>}

      <div style={{display:"flex",justifyContent:"space-between",gap:12,marginTop:28}}>{step>1?<button className="button alt" onClick={()=>setStep(step-1)}>Back</button>:<span/>}{step<3?<button className="button" onClick={()=>setStep(step+1)}>Continue</button>:null}</div>
    </div>

    <aside className="summary"><span className="eyebrow">Booking summary</span><h3>{service.name}</h3><dl><div><dt>Service price</dt><dd>{pounds(service.price)}</dd></div><div><dt>Deposit hold</dt><dd>{pounds(service.deposit)}</dd></div><div><dt>Balance in salon</dt><dd>{payMode==="full"?pounds(0):pounds(service.price-service.deposit)}</dd></div><div><dt>Requested time</dt><dd>{date}<br/>{time}</dd></div><div className="total"><dt>Due today</dt><dd>{payMode==="full"?`${pounds(service.price)} paid`:`${pounds(service.deposit)} hold`}</dd></div></dl>
      {step===3&&<div className="pay-mode" role="radiogroup" aria-label="Payment option" style={{display:"grid",gap:8,margin:"4px 0 14px"}}>
        <button type="button" role="radio" aria-checked={payMode==="deposit"} className={`service ${payMode==="deposit"?"active":""}`} onClick={()=>setPayMode("deposit")}><span><strong>Secure a deposit</strong><small>Pay {pounds(service.deposit)} now · balance at the studio</small></span></button>
        <button type="button" role="radio" aria-checked={payMode==="full"} className={`service ${payMode==="full"?"active":""}`} onClick={()=>setPayMode("full")}><span><strong>Pay in full</strong><small>Pay {pounds(service.price)} now · nothing at the studio</small></span></button>
      </div>}
      {step===3&&<button className="button" disabled={!ready||loading} onClick={checkout}>{loading?"Opening secure checkout…":payMode==="full"?`Pay ${pounds(service.price)} now`:`Secure ${pounds(service.deposit)} deposit`}</button>}<p className="secure"><span>◆</span><span>Secure Stripe Checkout supports cards, Apple Pay and Google Pay when available. A deposit is an authorisation hold, not a legal escrow account.</span></p></aside>
  </div>;
}
