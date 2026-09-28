import type { Metadata } from "next";
import { EncodeDecode } from "@/components/tools/EncodeDecode";

export const metadata: Metadata = { title: "Encode & Decode" };

export default function Page() {
  return <EncodeDecode />;
}
