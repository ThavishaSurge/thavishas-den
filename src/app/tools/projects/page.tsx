import type { Metadata } from "next";
import { Projects } from "@/components/tools/Projects";

export const metadata: Metadata = { title: "Project Dashboard" };

export default function Page() {
  return <Projects />;
}
