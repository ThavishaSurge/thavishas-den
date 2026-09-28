import type { Metadata } from "next";
import { HeadingOutline } from "@/components/tools/HeadingOutline";

export const metadata: Metadata = { title: "Heading Outline" };

export default function Page() {
  return <HeadingOutline />;
}
