import type { Metadata } from "next";
import { Breakpoints } from "@/components/tools/Breakpoints";

export const metadata: Metadata = { title: "Breakpoint Previewer" };

export default function Page() {
  return <Breakpoints />;
}
