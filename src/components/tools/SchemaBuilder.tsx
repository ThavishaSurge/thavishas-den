"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { ToolFrame } from "../ToolFrame";
import { Check, Grid, Notice, Output, Panel, Segmented, Select, TextArea, TextInput } from "../ui";
import { useStored } from "@/lib/store";

type Kind = "LocalBusiness" | "Product" | "FAQPage" | "Hotel";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface Hours { days: string[]; opens: string; closes: string }
interface Address { street: string; city: string; region: string; postal: string; country: string }

const BUSINESS_TYPES = [
  "LocalBusiness", "Store", "ClothingStore", "ElectronicsStore", "Florist", "HealthAndBeautyBusiness", "BeautySalon", "DaySpa",
  "Restaurant", "CafeOrCoffeeShop", "Bakery", "AutoRepair", "AutoDealer", "Dentist", "MedicalClinic", "Pharmacy",
  "ProfessionalService", "LegalService", "AccountingService", "RealEstateAgent", "TravelAgency", "SportsActivityLocation", "HomeAndConstructionBusiness",
];

const clean = (o: unknown): unknown => {
  if (Array.isArray(o)) {
    const a = o.map(clean).filter((x) => x !== undefined);
    return a.length ? a : undefined;
  }
  if (o && typeof o === "object") {
    const e = Object.entries(o).map(([k, v]) => [k, clean(v)] as const).filter(([, v]) => v !== undefined);
    const keys = e.map(([k]) => k).filter((k) => !k.startsWith("@"));
    return keys.length ? Object.fromEntries(e) : undefined;
  }
  if (typeof o === "string") return o.trim() ? o.trim() : undefined;
  return o;
};

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

function AddressFields({ a, set }: { a: Address; set: (a: Address) => void }) {
  return (
    <>
      <TextInput label="Street address" value={a.street} onChange={(e) => set({ ...a, street: e.target.value })} placeholder="No. 12, Galle Road" />
      <div className="row">
        <TextInput label="City" value={a.city} onChange={(e) => set({ ...a, city: e.target.value })} placeholder="Colombo 03" />
        <TextInput label="Region / province" value={a.region} onChange={(e) => set({ ...a, region: e.target.value })} placeholder="Western Province" />
      </div>
      <div className="row">
        <TextInput label="Postal code" value={a.postal} onChange={(e) => set({ ...a, postal: e.target.value })} placeholder="00300" />
        <TextInput label="Country code" value={a.country} onChange={(e) => set({ ...a, country: e.target.value.toUpperCase().slice(0, 2) })} placeholder="LK" hint="Two letters, ISO 3166" />
      </div>
    </>
  );
}

function HoursFields({ hours, set }: { hours: Hours[]; set: (h: Hours[]) => void }) {
  return (
    <div className="stack">
      {hours.map((h, i) => (
        <div key={i} className="hours">
          <div className="hours__days">
            {DAYS.map((d) => (
              <button key={d} type="button" className={`filter${h.days.includes(d) ? " filter--on" : ""}`} aria-pressed={h.days.includes(d)}
                onClick={() => set(hours.map((x, j) => (j === i ? { ...x, days: x.days.includes(d) ? x.days.filter((y) => y !== d) : [...x.days, d] } : x)))}>
                {d.slice(0, 3)}
              </button>
            ))}
          </div>
          <div className="row" style={{ alignItems: "center" }}>
            <input className="inp" type="time" value={h.opens} onChange={(e) => set(hours.map((x, j) => (j === i ? { ...x, opens: e.target.value } : x)))} aria-label="Opens" style={{ width: 130 }} />
            <span className="muted">to</span>
            <input className="inp" type="time" value={h.closes} onChange={(e) => set(hours.map((x, j) => (j === i ? { ...x, closes: e.target.value } : x)))} aria-label="Closes" style={{ width: 130 }} />
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => set(hours.filter((_, j) => j !== i))} aria-label="Remove hours"><Trash2 size={14} /></button>
          </div>
        </div>
      ))}
      <button type="button" className="btn btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => set([...hours, { days: [], opens: "09:00", closes: "18:00" }])}><Plus size={14} /> Add opening hours</button>
    </div>
  );
}

const hoursSpec = (hours: Hours[]) => hours.filter((h) => h.days.length).map((h) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: h.days, opens: h.opens, closes: h.closes }));
const postal = (a: Address) => ({ "@type": "PostalAddress", streetAddress: a.street, addressLocality: a.city, addressRegion: a.region, postalCode: a.postal, addressCountry: a.country });

const emptyAddr: Address = { street: "", city: "", region: "", postal: "", country: "LK" };

export function SchemaBuilder() {
  const [kind, setKind] = useStored<Kind>("den.schema.kind", "LocalBusiness");

  const [biz, setBiz] = useStored("den.schema.biz", {
    type: "Store", name: "", url: "", phone: "", email: "", image: "", logo: "", priceRange: "Rs.", lat: "", lng: "", sameAs: "", description: "",
    address: emptyAddr, hours: [{ days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], opens: "09:00", closes: "19:00" }] as Hours[],
  });
  const [prod, setProd] = useStored("den.schema.product", {
    name: "", description: "", images: "", sku: "", gtin: "", brand: "", url: "", price: "", currency: "LKR", availability: "InStock", condition: "NewCondition",
    priceValidUntil: "", rating: "", reviewCount: "", shippingCost: "", returnDays: "",
  });
  const [faq, setFaq] = useStored("den.schema.faq", [{ q: "", a: "" }]);
  const [hotel, setHotel] = useStored("den.schema.hotel", {
    name: "", description: "", url: "", phone: "", images: "", stars: "4", priceRange: "", checkin: "14:00", checkout: "12:00", lat: "", lng: "",
    amenities: "Free WiFi\nOutdoor pool\nBeach access\nRestaurant\nFree parking", pets: false, rating: "", reviewCount: "", address: emptyAddr,
  });

  const data = useMemo(() => {
    if (kind === "LocalBusiness") {
      return clean({
        "@context": "https://schema.org", "@type": biz.type, name: biz.name, description: biz.description, url: biz.url, telephone: biz.phone, email: biz.email,
        image: biz.image, logo: biz.logo, priceRange: biz.priceRange === "Rs." ? undefined : biz.priceRange, address: postal(biz.address),
        geo: biz.lat && biz.lng ? { "@type": "GeoCoordinates", latitude: Number(biz.lat), longitude: Number(biz.lng) } : undefined,
        openingHoursSpecification: hoursSpec(biz.hours), sameAs: lines(biz.sameAs),
      });
    }
    if (kind === "Product") {
      return clean({
        "@context": "https://schema.org", "@type": "Product", name: prod.name, description: prod.description, image: lines(prod.images), sku: prod.sku,
        gtin: prod.gtin, brand: prod.brand ? { "@type": "Brand", name: prod.brand } : undefined,
        offers: {
          "@type": "Offer", url: prod.url, price: prod.price, priceCurrency: prod.currency, availability: `https://schema.org/${prod.availability}`,
          itemCondition: `https://schema.org/${prod.condition}`, priceValidUntil: prod.priceValidUntil,
          shippingDetails: prod.shippingCost ? { "@type": "OfferShippingDetails", shippingRate: { "@type": "MonetaryAmount", value: prod.shippingCost, currency: prod.currency } } : undefined,
          hasMerchantReturnPolicy: prod.returnDays ? { "@type": "MerchantReturnPolicy", returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow", merchantReturnDays: Number(prod.returnDays) } : undefined,
        },
        aggregateRating: prod.rating && prod.reviewCount ? { "@type": "AggregateRating", ratingValue: prod.rating, reviewCount: prod.reviewCount } : undefined,
      });
    }
    if (kind === "FAQPage") {
      return clean({
        "@context": "https://schema.org", "@type": "FAQPage",
        mainEntity: faq.filter((x) => x.q.trim() && x.a.trim()).map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.a } })),
      });
    }
    return clean({
      "@context": "https://schema.org", "@type": "Hotel", name: hotel.name, description: hotel.description, url: hotel.url, telephone: hotel.phone,
      image: lines(hotel.images), starRating: hotel.stars ? { "@type": "Rating", ratingValue: hotel.stars } : undefined, priceRange: hotel.priceRange,
      checkinTime: hotel.checkin, checkoutTime: hotel.checkout, petsAllowed: hotel.pets, address: postal(hotel.address),
      geo: hotel.lat && hotel.lng ? { "@type": "GeoCoordinates", latitude: Number(hotel.lat), longitude: Number(hotel.lng) } : undefined,
      amenityFeature: lines(hotel.amenities).map((a) => ({ "@type": "LocationFeatureSpecification", name: a, value: true })),
      aggregateRating: hotel.rating && hotel.reviewCount ? { "@type": "AggregateRating", ratingValue: hotel.rating, reviewCount: hotel.reviewCount } : undefined,
    });
  }, [kind, biz, prod, faq, hotel]);

  const json = JSON.stringify(data ?? {}, null, 2);
  const script = `<script type="application/ld+json">\n${json}\n</script>`;

  const checks: { ok: boolean; text: string }[] = [];
  if (kind === "LocalBusiness") {
    checks.push({ ok: !!biz.name, text: "name (required)" }, { ok: !!(biz.address.street || biz.address.city), text: "address (required)" },
      { ok: !!biz.phone, text: "telephone (recommended)" }, { ok: !!biz.url, text: "url (recommended)" }, { ok: !!(biz.lat && biz.lng), text: "geo coordinates (recommended)" },
      { ok: biz.hours.some((h) => h.days.length), text: "opening hours (recommended)" }, { ok: !!biz.image, text: "image (recommended)" });
  } else if (kind === "Product") {
    checks.push({ ok: !!prod.name, text: "name (required)" }, { ok: !!prod.price || !!prod.rating, text: "offers, review or rating (one is required)" },
      { ok: !!prod.images, text: "image (recommended for merchant listings)" }, { ok: !!(prod.gtin || prod.sku), text: "gtin or sku (recommended)" },
      { ok: !!prod.brand, text: "brand (recommended)" }, { ok: !!prod.shippingCost, text: "shipping details (merchant listings)" }, { ok: !!prod.returnDays, text: "return policy (merchant listings)" });
  } else if (kind === "FAQPage") {
    const n = faq.filter((x) => x.q.trim() && x.a.trim()).length;
    checks.push({ ok: n > 0, text: `${n} complete question${n === 1 ? "" : "s"}` }, { ok: faq.every((x) => !x.q.trim() || x.a.trim()), text: "every question has an answer" });
  } else {
    checks.push({ ok: !!hotel.name, text: "name (required)" }, { ok: !!(hotel.address.street || hotel.address.city), text: "address (required)" },
      { ok: !!hotel.images, text: "image (recommended)" }, { ok: !!hotel.phone, text: "telephone (recommended)" }, { ok: !!(hotel.lat && hotel.lng), text: "geo coordinates (recommended)" });
  }

  return (
    <ToolFrame slug="schema-builder" wide>
      <Segmented label="Schema type" value={kind} onChange={setKind} options={[["LocalBusiness", "Local business"], ["Product", "Product"], ["FAQPage", "FAQ"], ["Hotel", "Hotel"]]} />
      <div style={{ height: 16 }} />
      <Grid>
        <div className="stack">
          {kind === "LocalBusiness" && (
            <>
              <Panel title="Business">
                <div className="row">
                  <Select label="Business type" value={biz.type} onChange={(e) => setBiz({ ...biz, type: e.target.value })} options={BUSINESS_TYPES} hint="The most specific type that fits" />
                  <TextInput label="Name" value={biz.name} onChange={(e) => setBiz({ ...biz, name: e.target.value })} />
                </div>
                <TextArea label="Description" rows={2} value={biz.description} onChange={(e) => setBiz({ ...biz, description: e.target.value })} />
                <div className="row">
                  <TextInput label="Website" value={biz.url} onChange={(e) => setBiz({ ...biz, url: e.target.value })} placeholder="https://" />
                  <TextInput label="Phone" value={biz.phone} onChange={(e) => setBiz({ ...biz, phone: e.target.value })} placeholder="+94 11 234 5678" />
                </div>
                <div className="row">
                  <TextInput label="Email" value={biz.email} onChange={(e) => setBiz({ ...biz, email: e.target.value })} />
                  <TextInput label="Price range" value={biz.priceRange} onChange={(e) => setBiz({ ...biz, priceRange: e.target.value })} hint="e.g. Rs. 2,000–15,000 or $$" />
                </div>
                <div className="row">
                  <TextInput label="Photo URL" value={biz.image} onChange={(e) => setBiz({ ...biz, image: e.target.value })} />
                  <TextInput label="Logo URL" value={biz.logo} onChange={(e) => setBiz({ ...biz, logo: e.target.value })} />
                </div>
              </Panel>
              <Panel title="Location">
                <AddressFields a={biz.address} set={(address) => setBiz({ ...biz, address })} />
                <div className="row">
                  <TextInput label="Latitude" value={biz.lat} onChange={(e) => setBiz({ ...biz, lat: e.target.value })} placeholder="6.9147" />
                  <TextInput label="Longitude" value={biz.lng} onChange={(e) => setBiz({ ...biz, lng: e.target.value })} placeholder="79.8528" hint="Right-click the pin in Google Maps to copy" />
                </div>
              </Panel>
              <Panel title="Opening hours"><HoursFields hours={biz.hours} set={(hours) => setBiz({ ...biz, hours })} /></Panel>
              <Panel title="Profiles"><TextArea label="Social and listing URLs" hint="One per line: Facebook, Instagram, Google Business Profile…" rows={3} value={biz.sameAs} onChange={(e) => setBiz({ ...biz, sameAs: e.target.value })} /></Panel>
            </>
          )}

          {kind === "Product" && (
            <>
              <Panel title="Product">
                <TextInput label="Name" value={prod.name} onChange={(e) => setProd({ ...prod, name: e.target.value })} />
                <TextArea label="Description" rows={3} value={prod.description} onChange={(e) => setProd({ ...prod, description: e.target.value })} />
                <TextArea label="Image URLs" hint="One per line. Google prefers 1:1, 4:3 and 16:9 versions." rows={3} value={prod.images} onChange={(e) => setProd({ ...prod, images: e.target.value })} />
                <div className="row">
                  <TextInput label="Brand" value={prod.brand} onChange={(e) => setProd({ ...prod, brand: e.target.value })} />
                  <TextInput label="SKU" value={prod.sku} onChange={(e) => setProd({ ...prod, sku: e.target.value })} />
                  <TextInput label="GTIN / barcode" value={prod.gtin} onChange={(e) => setProd({ ...prod, gtin: e.target.value })} />
                </div>
              </Panel>
              <Panel title="Offer">
                <div className="row">
                  <TextInput label="Price" value={prod.price} inputMode="decimal" onChange={(e) => setProd({ ...prod, price: e.target.value.replace(/[^\d.]/g, "") })} hint="Numbers only, no commas" />
                  <Select label="Currency" value={prod.currency} onChange={(e) => setProd({ ...prod, currency: e.target.value })} options={["LKR", "USD", "EUR", "GBP", "AUD", "INR", "AED"]} />
                </div>
                <div className="row">
                  <Select label="Availability" value={prod.availability} onChange={(e) => setProd({ ...prod, availability: e.target.value })} options={[["InStock", "In stock"], ["OutOfStock", "Out of stock"], ["PreOrder", "Pre-order"], ["BackOrder", "Back order"], ["LimitedAvailability", "Limited"]]} />
                  <Select label="Condition" value={prod.condition} onChange={(e) => setProd({ ...prod, condition: e.target.value })} options={[["NewCondition", "New"], ["UsedCondition", "Used"], ["RefurbishedCondition", "Refurbished"]]} />
                </div>
                <div className="row">
                  <TextInput label="Product page URL" value={prod.url} onChange={(e) => setProd({ ...prod, url: e.target.value })} />
                  <TextInput label="Price valid until" type="date" value={prod.priceValidUntil} onChange={(e) => setProd({ ...prod, priceValidUntil: e.target.value })} />
                </div>
                <div className="row">
                  <TextInput label="Shipping cost" value={prod.shippingCost} onChange={(e) => setProd({ ...prod, shippingCost: e.target.value })} />
                  <TextInput label="Return window (days)" value={prod.returnDays} onChange={(e) => setProd({ ...prod, returnDays: e.target.value.replace(/\D/g, "") })} />
                </div>
              </Panel>
              <Panel title="Reviews (only if shown on the page)">
                <div className="row">
                  <TextInput label="Average rating" value={prod.rating} onChange={(e) => setProd({ ...prod, rating: e.target.value })} placeholder="4.7" />
                  <TextInput label="Number of reviews" value={prod.reviewCount} onChange={(e) => setProd({ ...prod, reviewCount: e.target.value })} placeholder="38" />
                </div>
              </Panel>
            </>
          )}

          {kind === "FAQPage" && (
            <Panel title="Questions" actions={<button className="btn btn--sm" onClick={() => setFaq([...faq, { q: "", a: "" }])}><Plus size={14} /> Add question</button>}>
              {faq.map((x, i) => (
                <div key={i} className="faq-item">
                  <TextInput label={`Question ${i + 1}`} value={x.q} onChange={(e) => setFaq(faq.map((y, j) => (j === i ? { ...y, q: e.target.value } : y)))} />
                  <TextArea label="Answer" rows={3} value={x.a} onChange={(e) => setFaq(faq.map((y, j) => (j === i ? { ...y, a: e.target.value } : y)))} hint="Basic HTML like links and lists is allowed" />
                  {faq.length > 1 && <button className="btn btn--ghost btn--sm" onClick={() => setFaq(faq.filter((_, j) => j !== i))}><Trash2 size={14} /> Remove</button>}
                </div>
              ))}
            </Panel>
          )}

          {kind === "Hotel" && (
            <>
              <Panel title="Hotel">
                <TextInput label="Name" value={hotel.name} onChange={(e) => setHotel({ ...hotel, name: e.target.value })} placeholder="Pegasus Reef Hotel" />
                <TextArea label="Description" rows={2} value={hotel.description} onChange={(e) => setHotel({ ...hotel, description: e.target.value })} />
                <div className="row">
                  <TextInput label="Website" value={hotel.url} onChange={(e) => setHotel({ ...hotel, url: e.target.value })} />
                  <TextInput label="Phone" value={hotel.phone} onChange={(e) => setHotel({ ...hotel, phone: e.target.value })} />
                </div>
                <div className="row">
                  <Select label="Star rating" value={hotel.stars} onChange={(e) => setHotel({ ...hotel, stars: e.target.value })} options={[["", "Not rated"], "1", "2", "3", "4", "5"]} />
                  <TextInput label="Price range" value={hotel.priceRange} onChange={(e) => setHotel({ ...hotel, priceRange: e.target.value })} placeholder="USD 90–250" />
                </div>
                <div className="row">
                  <TextInput label="Check-in" type="time" value={hotel.checkin} onChange={(e) => setHotel({ ...hotel, checkin: e.target.value })} />
                  <TextInput label="Check-out" type="time" value={hotel.checkout} onChange={(e) => setHotel({ ...hotel, checkout: e.target.value })} />
                </div>
                <TextArea label="Image URLs" rows={2} value={hotel.images} onChange={(e) => setHotel({ ...hotel, images: e.target.value })} hint="One per line" />
                <TextArea label="Amenities" rows={4} value={hotel.amenities} onChange={(e) => setHotel({ ...hotel, amenities: e.target.value })} hint="One per line" />
                <Check label="Pets allowed" checked={hotel.pets} onChange={(v) => setHotel({ ...hotel, pets: v })} />
              </Panel>
              <Panel title="Location">
                <AddressFields a={hotel.address} set={(address) => setHotel({ ...hotel, address })} />
                <div className="row">
                  <TextInput label="Latitude" value={hotel.lat} onChange={(e) => setHotel({ ...hotel, lat: e.target.value })} />
                  <TextInput label="Longitude" value={hotel.lng} onChange={(e) => setHotel({ ...hotel, lng: e.target.value })} />
                </div>
              </Panel>
              <Panel title="Guest rating (only if shown on the page)">
                <div className="row">
                  <TextInput label="Average rating" value={hotel.rating} onChange={(e) => setHotel({ ...hotel, rating: e.target.value })} />
                  <TextInput label="Number of reviews" value={hotel.reviewCount} onChange={(e) => setHotel({ ...hotel, reviewCount: e.target.value })} />
                </div>
              </Panel>
            </>
          )}
        </div>

        <div className="stack schema-out">
          <Panel title="JSON-LD">
            <Output value={script} filename={`${kind.toLowerCase()}-schema.html`} maxHeight={560} />
            <div className="row">
              <a className="btn" href="https://search.google.com/test/rich-results" target="_blank" rel="noreferrer"><ExternalLink size={14} /> Google Rich Results Test</a>
              <a className="btn btn--ghost" href="https://validator.schema.org/" target="_blank" rel="noreferrer"><ExternalLink size={14} /> Schema.org validator</a>
            </div>
          </Panel>
          <Panel title="Checklist">
            <ul className="checks">
              {checks.map((c) => <li key={c.text} className={c.ok ? "t-add" : "muted"}>{c.ok ? "✓" : "○"} {c.text}</li>)}
            </ul>
            {kind === "FAQPage" && <Notice tone="info">Google now shows FAQ rich results mainly for well-known government and health sites. The markup still helps search engines and AI answers understand the page.</Notice>}
            <p className="help">Paste it into the page with a header/footer code plugin, Elementor&rsquo;s HTML widget or Divi&rsquo;s Code module. Don&rsquo;t duplicate what Yoast or Rank Math already outputs.</p>
          </Panel>
        </div>
      </Grid>
    </ToolFrame>
  );
}
