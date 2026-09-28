import type { Metadata } from "next";
import { ConfigFiles } from "@/components/tools/ConfigFiles";

export const metadata: Metadata = { title: "Config File Generator" };

export default function Page() {
  return <ConfigFiles />;
}
