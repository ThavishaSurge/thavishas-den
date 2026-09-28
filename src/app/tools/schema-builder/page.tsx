import type { Metadata } from "next";
import { SchemaBuilder } from "@/components/tools/SchemaBuilder";

export const metadata: Metadata = { title: "Schema Builder" };

export default function Page() {
  return <SchemaBuilder />;
}
