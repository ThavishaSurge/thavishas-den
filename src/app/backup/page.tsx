import type { Metadata } from "next";
import { BackupView } from "@/components/BackupView";

export const metadata: Metadata = { title: "Backup & restore" };

export default function Page() {
  return <BackupView />;
}
