import type { Metadata } from "next";
import { ErrorLog } from "@/components/tools/ErrorLog";

export const metadata: Metadata = { title: "PHP Error Log Parser" };

export default function Page() {
  return <ErrorLog />;
}
