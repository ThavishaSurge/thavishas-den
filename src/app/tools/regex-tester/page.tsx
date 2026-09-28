import type { Metadata } from "next";
import { RegexTester } from "@/components/tools/RegexTester";

export const metadata: Metadata = { title: "Regex Tester" };

export default function Page() {
  return <RegexTester />;
}
