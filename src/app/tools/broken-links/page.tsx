import type { Metadata } from "next";
import { BrokenLinks } from "@/components/tools/BrokenLinks";

export const metadata: Metadata = { title: "Broken Link Crawler" };

export default function Page() {
  return <BrokenLinks />;
}
