import type { Metadata } from "next";
import { SnippetLibrary } from "@/components/tools/SnippetLibrary";

export const metadata: Metadata = { title: "Snippet Library" };

export default function Page() {
  return <SnippetLibrary />;
}
