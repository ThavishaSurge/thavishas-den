import type { Metadata } from "next";
import { FluidType } from "@/components/tools/FluidType";

export const metadata: Metadata = { title: "Fluid Type & Units" };

export default function Page() {
  return <FluidType />;
}
