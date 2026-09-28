import type { Metadata } from "next";
import { Favicons } from "@/components/tools/Favicons";

export const metadata: Metadata = { title: "Favicon Generator" };

export default function Page() {
  return <Favicons />;
}
