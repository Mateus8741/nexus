import type { Metadata } from "next";

import { DownloadsCta } from "@/components/landing/downloads-cta";
import { Features } from "@/components/landing/features";
import { FinalCta } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Integrations } from "@/components/landing/integrations";
import { LandingNav } from "@/components/landing/landing-nav";
import { ScenesDemo } from "@/components/landing/scenes-demo";

const DESCRIPTION =
  "Controle luzes, tomadas, clima e computadores de todos os ambientes num lugar só. Dashboard web, cenas, automações e widget para Windows e macOS.";

export const metadata: Metadata = {
  title: "Nexus — controle todos os seus ambientes num só lugar",
  description: DESCRIPTION,
  openGraph: {
    title: "Nexus — controle todos os seus ambientes num só lugar",
    description: DESCRIPTION,
    type: "website",
    locale: "pt_BR",
    siteName: "Nexus",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nexus — controle todos os seus ambientes num só lugar",
    description: DESCRIPTION,
  },
};

export default function WelcomePage() {
  return (
    <div className="relative flex-1 overflow-x-clip">
      <LandingNav />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <ScenesDemo />
        <Integrations />
        <DownloadsCta />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
