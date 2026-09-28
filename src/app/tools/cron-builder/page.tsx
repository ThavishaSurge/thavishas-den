import type { Metadata } from "next";
import { CronBuilder } from "@/components/tools/CronBuilder";

export const metadata: Metadata = { title: "Cron Builder" };

export default function Page() {
  return <CronBuilder />;
}
