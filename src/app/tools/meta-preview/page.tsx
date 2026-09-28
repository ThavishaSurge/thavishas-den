import type { Metadata } from "next";
import { MetaPreview } from "@/components/tools/MetaPreview";

export const metadata: Metadata = { title: "SERP & Social Preview" };

export default function Page() {
  return <MetaPreview />;
}
