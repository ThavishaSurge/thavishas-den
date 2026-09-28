import type { Metadata } from "next";
import "@fontsource-variable/bricolage-grotesque/wdth.css";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { CommandPalette } from "@/components/CommandPalette";
import "./ui.css";
import "./tools.css";

export const metadata: Metadata = {
  title: { default: "Thavisha's Den", template: "%s · Thavisha's Den" },
  description: "A private workshop of web development tools.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(JSON.parse(localStorage.getItem("den.nav.collapsed")))document.documentElement.dataset.nav="collapsed"}catch(e){}`,
          }}
        />
      </head>
      <body>
        <div className="shell">
          <Sidebar />
          <main className="main">{children}</main>
        </div>
        <CommandPalette />
      </body>
    </html>
  );
}
