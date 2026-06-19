import "@/styles/globals.css";
import Providers from "./providers";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata = {
  title: "Relay AI — Opportunity Orbit",
  description: "Spatial relationship intelligence and AI-powered founder outreach platform.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("dark", "font-sans", geist.variable)}>
      <body className="antialiased text-gray-200 bg-bg-dark min-h-screen relative font-body">
        <Providers>
          <div className="starfield" aria-hidden="true" />
          {children}
        </Providers>
      </body>
    </html>
  );
}
