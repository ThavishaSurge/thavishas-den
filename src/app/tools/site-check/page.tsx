import type { Metadata } from "next";
import { SiteCheck } from "@/components/tools/SiteCheck";

export const metadata: Metadata = { title: "Headers, SSL & DNS" };

export default function Page() {
  return <SiteCheck />;
}
