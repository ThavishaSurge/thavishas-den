"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { ToolFrame } from "../ToolFrame";
import { Check, Grid, Notice, Output, Panel, Segmented, Select, Tabs, TextArea, TextInput } from "../ui";

type Tab = "wpconfig" | "htaccess" | "robots";

/* ---------- wp-config ---------- */

const SALT_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_ []{}<>~`+=,.;:/?|";
const SALT_KEYS = ["AUTH_KEY", "SECURE_AUTH_KEY", "LOGGED_IN_KEY", "NONCE_KEY", "AUTH_SALT", "SECURE_AUTH_SALT", "LOGGED_IN_SALT", "NONCE_SALT"];

function randomSalt(): string {
  const bytes = new Uint32Array(64);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => SALT_CHARS[b % SALT_CHARS.length]).join("").replace(/'/g, "!").replace(/\\/g, "#");
}

function randomPrefix(): string {
  const b = new Uint8Array(4);
  crypto.getRandomValues(b);
  return "wp_" + Array.from(b, (x) => "abcdefghijklmnopqrstuvwxyz0123456789"[x % 36]).join("") + "_";
}

const phpStr = (s: string) => `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

function WpConfigTab() {
  const [db, setDb] = useState({ name: "", user: "", pass: "", host: "localhost", prefix: "wp_" });
  const [salts, setSalts] = useState<string[]>([]);
  const [env, setEnv] = useState<"production" | "staging" | "development" | "local">("production");
  const [debug, setDebug] = useState<"off" | "log" | "display">("off");
  const [o, setO] = useState({
    disallowEdit: true, disallowMods: false, forceSslAdmin: true, proxyHttps: false, disableCron: false, cache: false,
    memory: "256M", maxMemory: "512M", revisions: "10", emptyTrash: "30", autoUpdate: "minor", home: "",
  });
  useEffect(() => setSalts(SALT_KEYS.map(randomSalt)), []);
  const set = (p: Partial<typeof o>) => setO((x) => ({ ...x, ...p }));

  const file = useMemo(() => {
    const L: string[] = [];
    L.push("<?php", "/**", " * WordPress configuration — generated in Thavisha's Den.", " */", "");
    L.push("// ** Database ** //");
    L.push(`define( 'DB_NAME', ${phpStr(db.name || "database_name_here")} );`);
    L.push(`define( 'DB_USER', ${phpStr(db.user || "username_here")} );`);
    L.push(`define( 'DB_PASSWORD', ${phpStr(db.pass || "password_here")} );`);
    L.push(`define( 'DB_HOST', ${phpStr(db.host || "localhost")} );`);
    L.push("define( 'DB_CHARSET', 'utf8mb4' );", "define( 'DB_COLLATE', '' );", "");
    L.push("// ** Authentication keys and salts ** //");
    L.push("// Change these to log everyone out. Fresh ones: https://api.wordpress.org/secret-key/1.1/salt/");
    SALT_KEYS.forEach((k, i) => L.push(`define( '${k.padEnd(16)}', '${salts[i] ?? ""}' );`));
    L.push("", `$table_prefix = ${phpStr(db.prefix || "wp_")};`, "");
    L.push("// ** Environment ** //", `define( 'WP_ENVIRONMENT_TYPE', '${env}' );`);
    if (o.home) {
      const h = o.home.replace(/\/+$/, "");
      L.push(`define( 'WP_HOME', ${phpStr(h)} );`, `define( 'WP_SITEURL', ${phpStr(h)} );`);
    }
    L.push("", "// ** Debugging ** //");
    if (debug === "off") L.push("define( 'WP_DEBUG', false );");
    else {
      L.push("define( 'WP_DEBUG', true );", "define( 'WP_DEBUG_LOG', true ); // wp-content/debug.log");
      L.push(`define( 'WP_DEBUG_DISPLAY', ${debug === "display" ? "true" : "false"} );`);
      if (debug === "log") L.push("@ini_set( 'display_errors', 0 );");
      L.push("define( 'SCRIPT_DEBUG', " + (debug === "display" ? "true" : "false") + " );");
    }
    L.push("", "// ** Security ** //");
    if (o.disallowEdit) L.push("define( 'DISALLOW_FILE_EDIT', true ); // no theme/plugin editor in wp-admin");
    if (o.disallowMods) L.push("define( 'DISALLOW_FILE_MODS', true ); // no installs or updates from wp-admin");
    if (o.forceSslAdmin) L.push("define( 'FORCE_SSL_ADMIN', true );");
    if (o.proxyHttps) {
      L.push("// Behind Cloudflare or a load balancer that terminates SSL:");
      L.push("if ( isset( $_SERVER['HTTP_X_FORWARDED_PROTO'] ) && 'https' === $_SERVER['HTTP_X_FORWARDED_PROTO'] ) {", "    $_SERVER['HTTPS'] = 'on';", "}");
    }
    L.push("", "// ** Performance ** //");
    L.push(`define( 'WP_MEMORY_LIMIT', '${o.memory}' );`, `define( 'WP_MAX_MEMORY_LIMIT', '${o.maxMemory}' );`);
    L.push(`define( 'WP_POST_REVISIONS', ${/^\d+$/.test(o.revisions) ? o.revisions : o.revisions === "off" ? "false" : "true"} );`);
    L.push(`define( 'EMPTY_TRASH_DAYS', ${Number(o.emptyTrash) || 30} );`);
    if (o.cache) L.push("define( 'WP_CACHE', true ); // required by most page-cache plugins");
    if (o.disableCron) L.push("define( 'DISABLE_WP_CRON', true ); // run wp-cron.php from a real server cron instead");
    L.push(`define( 'WP_AUTO_UPDATE_CORE', ${o.autoUpdate === "minor" ? "'minor'" : o.autoUpdate} );`);
    L.push("", "/* That's all, stop editing! Happy publishing. */", "", "if ( ! defined( 'ABSPATH' ) ) {", "    define( 'ABSPATH', __DIR__ . '/' );", "}", "", "require_once ABSPATH . 'wp-settings.php';", "");
    return L.join("\n");
  }, [db, salts, env, debug, o]);

  return (
    <Grid>
      <div className="stack">
        <Panel title="Database">
          <div className="row">
            <TextInput label="Database name" value={db.name} onChange={(e) => setDb({ ...db, name: e.target.value })} />
            <TextInput label="User" value={db.user} onChange={(e) => setDb({ ...db, user: e.target.value })} />
          </div>
          <div className="row">
            <TextInput label="Password" type="password" autoComplete="new-password" value={db.pass} onChange={(e) => setDb({ ...db, pass: e.target.value })} />
            <TextInput label="Host" value={db.host} onChange={(e) => setDb({ ...db, host: e.target.value })} />
          </div>
          <div className="row">
            <TextInput label="Table prefix" value={db.prefix} onChange={(e) => setDb({ ...db, prefix: e.target.value.replace(/[^\w]/g, "") })} hint="Only change on new installs" />
            <button className="btn" onClick={() => setDb({ ...db, prefix: randomPrefix() })}><RefreshCw size={14} /> Random prefix</button>
          </div>
        </Panel>
        <Panel title="Environment">
          <Segmented label="Environment" value={env} onChange={setEnv} options={[["production", "Production"], ["staging", "Staging"], ["development", "Development"], ["local", "Local"]]} />
          <Segmented label="Debugging" value={debug} onChange={setDebug} options={[["off", "Debug off"], ["log", "Log to debug.log"], ["display", "Show on screen"]]} />
          <TextInput label="Site URL (optional)" placeholder="https://example.com" value={o.home} onChange={(e) => set({ home: e.target.value })} hint="Hard-codes WP_HOME and WP_SITEURL — handy after a migration" />
        </Panel>
        <Panel title="Security & performance">
          <Check label="Disable the theme and plugin file editor" checked={o.disallowEdit} onChange={(v) => set({ disallowEdit: v })} />
          <Check label="Block all installs and updates from wp-admin" hint="For sites you update by deploy only" checked={o.disallowMods} onChange={(v) => set({ disallowMods: v })} />
          <Check label="Force HTTPS for wp-admin" checked={o.forceSslAdmin} onChange={(v) => set({ forceSslAdmin: v })} />
          <Check label="Fix HTTPS behind Cloudflare / a proxy" hint="Stops redirect loops when SSL ends at the proxy" checked={o.proxyHttps} onChange={(v) => set({ proxyHttps: v })} />
          <Check label="Enable WP_CACHE" checked={o.cache} onChange={(v) => set({ cache: v })} />
          <Check label="Disable WP-Cron" hint="Then add a server cron: */5 * * * * wget -q -O - https://example.com/wp-cron.php" checked={o.disableCron} onChange={(v) => set({ disableCron: v })} />
          <div className="row">
            <Select label="Memory limit" value={o.memory} onChange={(e) => set({ memory: e.target.value })} options={["128M", "256M", "512M"]} />
            <Select label="Admin memory limit" value={o.maxMemory} onChange={(e) => set({ maxMemory: e.target.value })} options={["256M", "512M", "1024M"]} />
          </div>
          <div className="row">
            <Select label="Post revisions" value={o.revisions} onChange={(e) => set({ revisions: e.target.value })} options={[["5", "Keep 5"], ["10", "Keep 10"], ["25", "Keep 25"], ["unlimited", "Unlimited"], ["off", "Off"]]} />
            <Select label="Empty trash after" value={o.emptyTrash} onChange={(e) => set({ emptyTrash: e.target.value })} options={[["7", "7 days"], ["30", "30 days"], ["90", "90 days"]]} />
            <Select label="Core auto-updates" value={o.autoUpdate} onChange={(e) => set({ autoUpdate: e.target.value })} options={[["minor", "Minor only"], ["true", "All versions"], ["false", "Off"]]} />
          </div>
        </Panel>
      </div>
      <Panel title="wp-config.php" actions={<button className="btn btn--sm" onClick={() => setSalts(SALT_KEYS.map(randomSalt))}><RefreshCw size={14} /> New salts</button>}>
        <Output value={file} filename="wp-config.php" maxHeight={900} />
        <p className="help">Salts are generated with your browser&rsquo;s secure random generator. Nothing you type here is sent anywhere.</p>
      </Panel>
    </Grid>
  );
}

/* ---------- .htaccess ---------- */

function HtaccessTab() {
  const [o, setO] = useState({
    wp: true, https: true, host: "keep" as "keep" | "www" | "non-www", domain: "",
    xmlrpc: true, protect: true, indexes: true, authors: true, headers: true, hsts: false,
    gzip: true, cache: true, uploadsPhp: false, redirects: "", maintenance: false, allowIp: "",
  });
  const set = (p: Partial<typeof o>) => setO((x) => ({ ...x, ...p }));

  const file = useMemo(() => {
    const B: string[] = [];
    const dom = o.domain.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "") || "example.com";
    const esc = dom.replace(/\./g, "\\.");
    if (o.maintenance) {
      B.push("# Maintenance mode", "<IfModule mod_rewrite.c>", "RewriteEngine On");
      if (o.allowIp) for (const ip of o.allowIp.split(/[\s,]+/).filter(Boolean)) B.push(`RewriteCond %{REMOTE_ADDR} !^${ip.replace(/\./g, "\\.")}$`);
      B.push("RewriteCond %{REQUEST_URI} !^/maintenance\\.html$", "RewriteCond %{REQUEST_URI} !\\.(css|js|png|jpe?g|svg|webp|woff2?)$ [NC]", "RewriteRule ^ /maintenance.html [R=302,L]", "</IfModule>", "");
    }
    if (o.https || o.host !== "keep") {
      B.push("# Canonical host and HTTPS", "<IfModule mod_rewrite.c>", "RewriteEngine On");
      if (o.host === "www") {
        B.push("RewriteCond %{HTTPS} off [OR]", `RewriteCond %{HTTP_HOST} ^${esc}$ [NC]`, `RewriteRule ^(.*)$ https://www.${dom}/$1 [L,R=301]`);
      } else if (o.host === "non-www") {
        B.push("RewriteCond %{HTTPS} off [OR]", `RewriteCond %{HTTP_HOST} ^www\\.${esc}$ [NC]`, `RewriteRule ^(.*)$ https://${dom}/$1 [L,R=301]`);
      } else {
        B.push("RewriteCond %{HTTPS} off", "RewriteCond %{HTTP:X-Forwarded-Proto} !https", "RewriteRule ^(.*)$ https://%{HTTP_HOST}/$1 [L,R=301]");
      }
      B.push("</IfModule>", "");
    }
    const redirects = o.redirects.split("\n").map((l) => l.trim().split(/\s+/)).filter((p) => p.length >= 2 && p[0].startsWith("/"));
    if (redirects.length) {
      B.push("# Redirects");
      for (const [from, to, code] of redirects) B.push(`Redirect ${code === "302" ? "302" : "301"} ${from} ${to}`);
      B.push("");
    }
    if (o.xmlrpc) B.push("# Block XML-RPC (brute force and DDoS target)", "<Files xmlrpc.php>", "  Require all denied", "</Files>", "");
    if (o.protect) {
      B.push("# Protect sensitive files", "<FilesMatch \"^(wp-config\\.php|\\.htaccess|\\.user\\.ini|php\\.ini|readme\\.html|license\\.txt|debug\\.log|error_log)$\">", "  Require all denied", "</FilesMatch>", "");
    }
    if (o.indexes) B.push("# No directory listings", "Options -Indexes", "");
    if (o.authors) B.push("# Stop user enumeration via ?author=N", "<IfModule mod_rewrite.c>", "RewriteEngine On", "RewriteCond %{REQUEST_URI} !^/wp-admin [NC]", "RewriteCond %{QUERY_STRING} ^author=\\d+ [NC]", "RewriteRule ^ - [F]", "</IfModule>", "");
    if (o.headers) {
      B.push("# Security headers", "<IfModule mod_headers.c>", "  Header always set X-Content-Type-Options \"nosniff\"", "  Header always set X-Frame-Options \"SAMEORIGIN\"", "  Header always set Referrer-Policy \"strict-origin-when-cross-origin\"", "  Header always set Permissions-Policy \"camera=(), microphone=(), geolocation=()\"");
      if (o.hsts) B.push("  Header always set Strict-Transport-Security \"max-age=31536000; includeSubDomains\"");
      B.push("</IfModule>", "");
    }
    if (o.gzip) B.push("# Compression", "<IfModule mod_deflate.c>", "  AddOutputFilterByType DEFLATE text/html text/plain text/css text/xml text/javascript application/javascript application/json application/xml image/svg+xml font/ttf font/otf", "</IfModule>", "");
    if (o.cache) {
      B.push("# Browser caching", "<IfModule mod_expires.c>", "  ExpiresActive On", "  ExpiresDefault \"access plus 1 month\"", "  ExpiresByType text/html \"access plus 0 seconds\"",
        "  ExpiresByType text/css \"access plus 1 year\"", "  ExpiresByType application/javascript \"access plus 1 year\"", "  ExpiresByType image/webp \"access plus 1 year\"",
        "  ExpiresByType image/avif \"access plus 1 year\"", "  ExpiresByType image/jpeg \"access plus 1 year\"", "  ExpiresByType image/png \"access plus 1 year\"",
        "  ExpiresByType image/svg+xml \"access plus 1 year\"", "  ExpiresByType font/woff2 \"access plus 1 year\"", "</IfModule>", "");
    }
    if (o.wp) {
      B.push("# BEGIN WordPress", "<IfModule mod_rewrite.c>", "RewriteEngine On", "RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]", "RewriteBase /", "RewriteRule ^index\\.php$ - [L]", "RewriteCond %{REQUEST_FILENAME} !-f", "RewriteCond %{REQUEST_FILENAME} !-d", "RewriteRule . /index.php [L]", "</IfModule>", "# END WordPress", "");
    }
    return B.join("\n");
  }, [o]);

  const uploadsFile = `# wp-content/uploads/.htaccess — never run PHP from the uploads folder
<FilesMatch "\\.(php|phtml|php\\d|phar)$">
  Require all denied
</FilesMatch>
`;

  return (
    <Grid>
      <div className="stack">
        <Panel title="Redirects & HTTPS">
          <Check label="Force HTTPS" checked={o.https} onChange={(v) => set({ https: v })} />
          <Segmented label="Host" value={o.host} onChange={(v) => set({ host: v })} options={[["keep", "Keep host as is"], ["www", "Always www"], ["non-www", "Never www"]]} />
          {o.host !== "keep" && <TextInput label="Domain" placeholder="example.com" value={o.domain} onChange={(e) => set({ domain: e.target.value })} />}
          <TextArea label="301 redirects" hint="One per line: /old-page /new-page  (add 302 at the end for temporary)" code rows={4} value={o.redirects} onChange={(e) => set({ redirects: e.target.value })} placeholder={"/old-shop /shop\n/about-us https://example.com/about"} />
        </Panel>
        <Panel title="Security">
          <Check label="Block xmlrpc.php" hint="Leave off if you use Jetpack or the WordPress mobile app" checked={o.xmlrpc} onChange={(v) => set({ xmlrpc: v })} />
          <Check label="Protect wp-config.php, logs and readme files" checked={o.protect} onChange={(v) => set({ protect: v })} />
          <Check label="Disable directory listings" checked={o.indexes} onChange={(v) => set({ indexes: v })} />
          <Check label="Block ?author= user enumeration" checked={o.authors} onChange={(v) => set({ authors: v })} />
          <Check label="Security headers" checked={o.headers} onChange={(v) => set({ headers: v })} />
          {o.headers && <Check label="HSTS (Strict-Transport-Security)" hint="Only once HTTPS works on every subdomain — browsers remember it for a year" checked={o.hsts} onChange={(v) => set({ hsts: v })} />}
          <Check label="Also give me an uploads/.htaccess that blocks PHP" checked={o.uploadsPhp} onChange={(v) => set({ uploadsPhp: v })} />
        </Panel>
        <Panel title="Performance & other">
          <Check label="Gzip compression" checked={o.gzip} onChange={(v) => set({ gzip: v })} />
          <Check label="Browser caching headers" hint="Skip if a cache plugin already writes these" checked={o.cache} onChange={(v) => set({ cache: v })} />
          <Check label="Maintenance mode" hint="Sends visitors to /maintenance.html" checked={o.maintenance} onChange={(v) => set({ maintenance: v })} />
          {o.maintenance && <TextInput label="Your IP (still sees the site)" placeholder="203.0.113.10" value={o.allowIp} onChange={(e) => set({ allowIp: e.target.value })} />}
          <Check label="WordPress permalinks block" checked={o.wp} onChange={(v) => set({ wp: v })} />
        </Panel>
      </div>
      <div className="stack">
        <Panel title=".htaccess">
          <Output value={file} filename="htaccess.txt" maxHeight={760} />
          <Notice tone="warn">Back up the current .htaccess first. A typo here takes the whole site down with a 500 error — if that happens, restore the backup over FTP. Rename the download to <code>.htaccess</code>.</Notice>
        </Panel>
        {o.uploadsPhp && <Panel title="wp-content/uploads/.htaccess"><Output value={uploadsFile} filename="uploads-htaccess.txt" /></Panel>}
      </div>
    </Grid>
  );
}

/* ---------- robots.txt ---------- */

const AI_BOTS = ["GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "anthropic-ai", "Google-Extended", "CCBot", "PerplexityBot", "Bytespider", "Applebot-Extended", "meta-externalagent", "Amazonbot"];

function RobotsTab() {
  const [preset, setPreset] = useState<"wp" | "woo" | "staging">("wp");
  const [site, setSite] = useState("");
  const [sitemaps, setSitemaps] = useState("sitemap_index.xml");
  const [ai, setAi] = useState(false);
  const [search, setSearch] = useState(true);
  const [extra, setExtra] = useState("");
  const [delay, setDelay] = useState("");

  const file = useMemo(() => {
    const L: string[] = [];
    const base = (site || "https://example.com").replace(/\/+$/, "");
    if (preset === "staging") {
      L.push("# Staging site — keep it out of search results", "User-agent: *", "Disallow: /", "");
      return L.join("\n");
    }
    L.push("User-agent: *", "Disallow: /wp-admin/", "Allow: /wp-admin/admin-ajax.php");
    if (search) L.push("Disallow: /?s=", "Disallow: /search/");
    if (preset === "woo") L.push("Disallow: /cart/", "Disallow: /checkout/", "Disallow: /my-account/", "Disallow: /*?add-to-cart=", "Disallow: /*?orderby=", "Disallow: /*?filter_", "Disallow: /*add_to_wishlist=");
    if (delay) L.push(`Crawl-delay: ${delay}`);
    for (const line of extra.split("\n").map((l) => l.trim()).filter(Boolean)) L.push(line);
    L.push("");
    if (ai) {
      L.push("# AI training and answer-engine crawlers");
      for (const b of AI_BOTS) L.push(`User-agent: ${b}`);
      L.push("Disallow: /", "");
    }
    for (const s of sitemaps.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean)) L.push(`Sitemap: ${s.startsWith("http") ? s : `${base}/${s.replace(/^\//, "")}`}`);
    return L.join("\n") + "\n";
  }, [preset, site, sitemaps, ai, search, extra, delay]);

  return (
    <Grid>
      <Panel title="Options">
        <Segmented label="Preset" value={preset} onChange={setPreset} options={[["wp", "WordPress"], ["woo", "WooCommerce"], ["staging", "Staging (block all)"]]} />
        {preset !== "staging" && (
          <>
            <TextInput label="Site URL" placeholder="https://example.com" value={site} onChange={(e) => setSite(e.target.value)} />
            <TextArea label="Sitemaps" hint="Yoast and Rank Math: sitemap_index.xml. WordPress core: wp-sitemap.xml" rows={2} value={sitemaps} onChange={(e) => setSitemaps(e.target.value)} />
            <Check label="Block internal search results" checked={search} onChange={setSearch} />
            <Check label="Block AI crawlers" hint={AI_BOTS.slice(0, 6).join(", ") + " and more"} checked={ai} onChange={setAi} />
            <Select label="Crawl-delay" value={delay} onChange={(e) => setDelay(e.target.value)} options={[["", "None (Google ignores it)"], ["5", "5 seconds"], ["10", "10 seconds"]]} />
            <TextArea label="Extra rules for all crawlers" code rows={3} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Disallow: /private/" />
          </>
        )}
      </Panel>
      <Panel title="robots.txt">
        <Output value={file} filename="robots.txt" />
        <p className="help">robots.txt asks crawlers politely — it doesn&rsquo;t hide pages. Use noindex or a password for anything private.</p>
      </Panel>
    </Grid>
  );
}

export function ConfigFiles() {
  const [tab, setTab] = useState<Tab>("wpconfig");
  return (
    <ToolFrame slug="config-files" wide>
      <Tabs value={tab} onChange={setTab} tabs={[["wpconfig", "wp-config.php"], ["htaccess", ".htaccess"], ["robots", "robots.txt"]]} />
      {tab === "wpconfig" && <WpConfigTab />}
      {tab === "htaccess" && <HtaccessTab />}
      {tab === "robots" && <RobotsTab />}
    </ToolFrame>
  );
}
