import Image from "next/image";
import { BookingFunnel } from "@/components/BookingFunnel";

export default function Home() {
  return <>
    <div className="notice">Battersea · London &nbsp; ◆ &nbsp; Specialist textured-hair care &nbsp; ◆ &nbsp; Secure online booking</div>
    <header className="header shell">
      <a className="brand" href="#top"><Image src="/prestige-logo.jpg" width={54} height={54} alt="Prestige Hair Society" /><span>Prestige Hair Society</span></a>
      <nav><a href="#book">Book</a><a href="#studio">Studio</a><a href="#visit">Visit</a></nav>
      <a className="button" href="#book">Book appointment</a>
    </header>
    <main>
      <section className="hero" id="top">
        <div className="hero-copy"><span className="eyebrow">Nekeia Griffith · Stylist & hair coach</span><h1>Hair care,<br/><em>elevated.</em></h1><p>Choose your treatment, request your time and secure it with a protected deposit authorisation. You receive email updates at every important step.</p><div className="hero-actions"><a className="button" href="#book">Start booking</a><a className="button alt" href="#studio">Explore the studio</a></div></div>
        <div className="hero-image"><Image src="/studio-wide.webp" fill priority sizes="(max-width:900px) 100vw, 50vw" alt="KOOP Studio interior in Battersea" /></div>
      </section>
      <section className="trust"><div className="shell trust-grid"><div><strong>01</strong><span>Choose a service</span></div><div><strong>02</strong><span>Select date & time</span></div><div><strong>03</strong><span>Secure your deposit</span></div><div><strong>04</strong><span>Receive email updates</span></div></div></section>
      <section className="booking-section shell" id="book"><div className="section-head"><div><span className="eyebrow">Book online</span><h2>Your appointment,<br/>beautifully simple.</h2></div><p>The deposit is authorised on your card and held until the appointment is approved. Your remaining balance is paid at the studio.</p></div><BookingFunnel /></section>
      <section className="shell" id="studio"><div className="section-head"><div><span className="eyebrow">KOOP Studio</span><h2>A calm corner<br/>of Battersea.</h2></div><p>Prestige Hair Society welcomes clients inside KOOP Studio, an intimate space designed for unhurried, one-to-one care.</p></div><div className="gallery"><Image src="/studio-entry.webp" width={900} height={650} alt="KOOP Studio reception"/><Image src="/studio-chair.webp" width={600} height={650} alt="Styling chair at KOOP Studio"/><Image src="/studio-mirror.webp" width={600} height={650} alt="Private styling station at KOOP Studio"/></div></section>
    </main>
    <footer className="footer" id="visit"><div className="shell footer-grid"><div><span className="eyebrow">Visit Prestige Hair Society</span><h2>2 Queenstown Road,<br/>London SW8 3RX</h2><p>Inside KOOP Studio · By appointment</p></div><a className="button alt" style={{color:"#fff",borderColor:"#fff"}} href="#book">Book your visit</a></div></footer>
  </>;
}
