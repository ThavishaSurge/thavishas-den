import type { Metadata } from "next";
import { ShopifyToWoo } from "@/components/tools/ShopifyToWoo";

export const metadata: Metadata = { title: "Shopify → WooCommerce CSV" };

export default function Page() {
  return <ShopifyToWoo />;
}
