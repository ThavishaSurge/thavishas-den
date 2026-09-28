import type { Metadata } from "next";
import { DeliveryNotes } from "@/components/tools/DeliveryNotes";

export const metadata: Metadata = { title: "Delivery Notes" };

export default function Page() {
  return <DeliveryNotes />;
}
