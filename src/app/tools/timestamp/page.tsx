import type { Metadata } from "next";
import { Timestamp } from "@/components/tools/Timestamp";

export const metadata: Metadata = { title: "Timestamp Converter" };

export default function Page() {
  return <Timestamp />;
}
