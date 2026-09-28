import type { Metadata } from "next";
import { Colors } from "@/components/tools/Colors";

export const metadata: Metadata = { title: "Contrast & Palette" };

export default function Page() {
  return <Colors />;
}
