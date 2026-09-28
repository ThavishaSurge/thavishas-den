import type { Metadata } from "next";
import { Beautifier } from "@/components/tools/Beautifier";

export const metadata: Metadata = { title: "Beautify & Minify" };

export default function Page() {
  return <Beautifier />;
}
