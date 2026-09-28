import type { Metadata } from "next";
import { PluginInspector } from "@/components/tools/PluginInspector";

export const metadata: Metadata = { title: "Plugin & Theme Inspector" };

export default function Page() {
  return <PluginInspector />;
}
