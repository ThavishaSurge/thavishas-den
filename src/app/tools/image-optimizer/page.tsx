import type { Metadata } from "next";
import { ImageOptimizer } from "@/components/tools/ImageOptimizer";

export const metadata: Metadata = { title: "Image Optimizer" };

export default function Page() {
  return <ImageOptimizer />;
}
