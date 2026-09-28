import type { Metadata } from "next";
import { MaintenanceReport } from "@/components/tools/MaintenanceReport";

export const metadata: Metadata = { title: "Maintenance Reports" };

export default function Page() {
  return <MaintenanceReport />;
}
