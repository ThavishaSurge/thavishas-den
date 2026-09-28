import os, re
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
PAGES = {
  "beautifier": ("Beautifier", "Beautifier"),
  "regex-tester": ("RegexTester", "RegexTester"),
  "encode-decode": ("EncodeDecode", "EncodeDecode"),
  "snippets": ("SnippetLibrary", "SnippetLibrary"),
  "plugin-inspector": ("PluginInspector", "PluginInspector"),
  "child-theme": ("ChildTheme", "ChildTheme"),
  "shopify-to-woo": ("ShopifyToWoo", "ShopifyToWoo"),
  "config-files": ("ConfigFiles", "ConfigFiles"),
  "breakpoints": ("Breakpoints", "Breakpoints"),
  "fluid-type": ("FluidType", "FluidType"),
  "colors": ("Colors", "Colors"),
  "image-optimizer": ("ImageOptimizer", "ImageOptimizer"),
  "favicons": ("Favicons", "Favicons"),
  "meta-preview": ("MetaPreview", "MetaPreview"),
  "schema-builder": ("SchemaBuilder", "SchemaBuilder"),
  "pagespeed": ("PageSpeed", "PageSpeed"),
  "redirect-checker": ("RedirectChecker", "RedirectChecker"),
  "broken-links": ("BrokenLinks", "BrokenLinks"),
  "heading-outline": ("HeadingOutline", "HeadingOutline"),
  "error-log": ("ErrorLog", "ErrorLog"),
  "site-check": ("SiteCheck", "SiteCheck"),
  "cron-builder": ("CronBuilder", "CronBuilder"),
  "timestamp": ("Timestamp", "Timestamp"),
  "maintenance-report": ("MaintenanceReport", "MaintenanceReport"),
  "delivery-notes": ("DeliveryNotes", "DeliveryNotes"),
  "projects": ("Projects", "Projects"),
}
names = {}
src = open("src/lib/tools.ts").read()
for m in re.finditer(r'slug: "([^"]+)", name: "([^"]+)"', src):
    names[m.group(1)] = m.group(2)
made = []
for slug, (file, comp) in PAGES.items():
    if not os.path.exists(f"src/components/tools/{file}.tsx"):
        continue
    d = f"src/app/tools/{slug}"
    os.makedirs(d, exist_ok=True)
    title = names[slug].replace('"', '\\"')
    open(f"{d}/page.tsx", "w").write(f'''import type {{ Metadata }} from "next";
import {{ {comp} }} from "@/components/tools/{file}";

export const metadata: Metadata = {{ title: "{title}" }};

export default function Page() {{
  return <{comp} />;
}}
''')
    made.append(slug)
print("pages:", " ".join(made))
