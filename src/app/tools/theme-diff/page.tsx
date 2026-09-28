import type { Metadata } from "next";
import { ThemeDiffTool } from "@/components/theme-diff/ThemeDiffTool";

export const metadata: Metadata = {
  title: "Theme Diff",
  description: "Compare two theme ZIPs and get the exact code changes.",
};

export default function Page() {
  return <ThemeDiffTool />;
}
