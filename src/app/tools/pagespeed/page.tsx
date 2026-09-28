import type { Metadata } from "next";
import { PageSpeed } from "@/components/tools/PageSpeed";

export const metadata: Metadata = { title: "PageSpeed Tracker" };

export default function Page() {
  return <PageSpeed />;
}
