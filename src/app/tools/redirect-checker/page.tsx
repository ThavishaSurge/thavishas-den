import type { Metadata } from "next";
import { RedirectChecker } from "@/components/tools/RedirectChecker";

export const metadata: Metadata = { title: "Redirect Chain Checker" };

export default function Page() {
  return <RedirectChecker />;
}
