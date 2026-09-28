import type { Metadata } from "next";
import { ChildTheme } from "@/components/tools/ChildTheme";

export const metadata: Metadata = { title: "Child Theme Generator" };

export default function Page() {
  return <ChildTheme />;
}
