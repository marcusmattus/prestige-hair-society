import { BookingProvider } from "@/components/booking/BookingProvider";
import { FinalCta } from "@/components/sections/FinalCta";
import { Gallery } from "@/components/sections/Gallery";
import { Hero } from "@/components/sections/Hero";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Marquee } from "@/components/sections/Marquee";
import { Salon } from "@/components/sections/Salon";
import { Services } from "@/components/sections/Services";
import { SiteFooter } from "@/components/sections/SiteFooter";
import { SiteHeader } from "@/components/sections/SiteHeader";
import { Stylists } from "@/components/sections/Stylists";
import { Testimonials } from "@/components/sections/Testimonials";
import { Visit } from "@/components/sections/Visit";

export default function Home() {
  return (
    <BookingProvider>
      <div className="min-h-screen bg-cream">
        <SiteHeader />
        <main>
          <Hero />
          <Marquee />
          <Services />
          <Salon />
          <HowItWorks />
          <Stylists />
          <Gallery />
          <Testimonials />
          <Visit />
          <FinalCta />
        </main>
        <SiteFooter />
      </div>
    </BookingProvider>
  );
}
