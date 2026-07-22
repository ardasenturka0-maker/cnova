import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request } from "node:https";

const MAX_HTML_BYTES = 1_500_000;
const MAX_REDIRECTS = 4;

function isPublicIpv4(address: string) {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = octets;
  return !(
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 88 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && octets[2] === 100) ||
    (a === 203 && b === 0 && octets[2] === 113)
  );
}

export function isPublicIp(address: string) {
  const family = isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family !== 6) return false;
  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) return isPublicIpv4(normalized.slice(7));
  return !(
    normalized === "::" || normalized === "::1" ||
    normalized.startsWith("::") ||
    normalized.startsWith("fc") || normalized.startsWith("fd") ||
    /^fe[89a-f]/.test(normalized) || normalized.startsWith("ff") ||
    normalized.startsWith("64:ff9b:") || normalized.startsWith("2002:") ||
    /^2001:(?:0*:){1,3}/.test(normalized) || normalized.startsWith("2001:db8:")
  );
}

async function resolvePublicAddress(hostname: string, requestedFamily?: number) {
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  const safe = addresses.filter((entry) => isPublicIp(entry.address) && (!requestedFamily || entry.family === requestedFamily));
  if (!safe.length) throw new Error("Yerel veya özel ağdaki satın alma sayfalarına erişilemez.");
  return safe[0];
}

function validateProductUrl(value: string) {
  if (value.length < 1 || value.length > 2048) throw new Error("Geçerli bir HTTPS satın alma sayfası girin.");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname || (url.port && url.port !== "443")) {
    throw new Error("Geçerli bir HTTPS satın alma sayfası girin.");
  }
  return url;
}

function fetchHtml(url: URL, redirectsLeft = MAX_REDIRECTS): Promise<{ html: string; finalUrl: URL }> {
  return new Promise((resolve, reject) => {
    const req = request(url, {
      method: "GET",
      headers: {
        accept: "text/html,application/xhtml+xml;q=0.9",
        "accept-language": "tr-TR,tr;q=0.9,en;q=0.7",
        "user-agent": "Mozilla/5.0 (compatible; ClinicNovaPriceReader/1.0)"
      },
      lookup: (hostname, options, callback) => {
        const requested = typeof options === "number" ? options : options?.family;
        const family = requested === "IPv4" ? 4 : requested === "IPv6" ? 6 : requested;
        resolvePublicAddress(hostname, family || undefined)
          .then((entry) => callback(null, entry.address, entry.family))
          .catch((error) => callback(error as NodeJS.ErrnoException, "", 4));
      }
    }, (response) => {
      const status = response.statusCode ?? 0;
      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume();
        if (redirectsLeft <= 0) return reject(new Error("Satın alma sayfası çok fazla yönlendirme yaptı."));
        let nextUrl: URL;
        try { nextUrl = validateProductUrl(new URL(response.headers.location, url).toString()); }
        catch (error) { return reject(error); }
        fetchHtml(nextUrl, redirectsLeft - 1).then(resolve, reject);
        return;
      }
      if (status < 200 || status >= 300) {
        response.resume();
        reject(new Error(`Satın alma sayfası açılamadı (${status || "bağlantı"}).`));
        return;
      }
      const contentType = String(response.headers["content-type"] || "").toLowerCase();
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
        response.resume(); reject(new Error("Bağlantı bir HTML ürün sayfası değil.")); return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_HTML_BYTES) req.destroy(new Error("Satın alma sayfası çok büyük."));
        else chunks.push(chunk);
      });
      response.on("end", () => resolve({ html: Buffer.concat(chunks).toString("utf8"), finalUrl: url }));
    });
    req.setTimeout(12_000, () => req.destroy(new Error("Satın alma sayfası zaman aşımına uğradı.")));
    req.on("error", reject);
    req.end();
  });
}

function decodeHtml(value: string) {
  return value.replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)));
}

function numberFrom(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 && value <= 100_000_000 ? value : null;
  if (typeof value !== "string") return null;
  const compact = value.trim().replace(/[^\d,.-]/g, "");
  if (!compact) return null;
  const normalized = compact.includes(",")
    ? compact.replace(/\./g, "").replace(",", ".")
    : compact.replace(/,(?=\d{3}(?:\D|$))/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 100_000_000 ? parsed : null;
}

function productObjects(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(productObjects);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const types = Array.isArray(record["@type"]) ? record["@type"] : [record["@type"]];
  const own = types.some((type) => String(type).toLowerCase() === "product") ? [record] : [];
  return [...own, ...productObjects(record["@graph"]), ...productObjects(record.mainEntity)];
}

function metaContent(html: string, keys: string[]) {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name|itemprop)=["']${escaped}["'][^>]*>`, "i")
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return decodeHtml(match[1].trim());
    }
  }
  return "";
}

export function parseProductPage(html: string, productUrl: string) {
  const jsonLd = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap((match) => { try { return productObjects(JSON.parse(decodeHtml(match[1].trim()))); } catch { return []; } });
  for (const product of jsonLd) {
    const offers = Array.isArray(product.offers) ? product.offers : [product.offers];
    for (const rawOffer of offers) {
      if (!rawOffer || typeof rawOffer !== "object") continue;
      const offer = rawOffer as Record<string, unknown>;
      const price = numberFrom(offer.price ?? (offer.priceSpecification as Record<string, unknown> | undefined)?.price ?? offer.lowPrice);
      const availability = String(offer.availability || "").toLowerCase();
      if (!price || availability.includes("outofstock") || availability.includes("soldout")) continue;
      const sellerValue = offer.seller ?? product.brand;
      const seller = typeof sellerValue === "object" && sellerValue ? String((sellerValue as Record<string, unknown>).name || "") : String(sellerValue || "");
      return { seller: (seller.trim() || new URL(productUrl).hostname.replace(/^www\./, "")).slice(0, 200), unitPrice: price, shippingPrice: 0, productUrl, inStock: true };
    }
  }
  const price = numberFrom(metaContent(html, ["product:price:amount", "og:price:amount", "price"]));
  if (!price) throw new Error("Bu sayfada okunabilir bir ürün fiyatı bulunamadı.");
  const seller = metaContent(html, ["og:site_name", "application-name"]);
  return { seller: (seller || new URL(productUrl).hostname.replace(/^www\./, "")).slice(0, 200), unitPrice: price, shippingPrice: 0, productUrl, inStock: true };
}

export async function inspectPublicProductPage(productUrl: string) {
  const requestedUrl = validateProductUrl(productUrl.trim());
  await resolvePublicAddress(requestedUrl.hostname);
  const { html, finalUrl } = await fetchHtml(requestedUrl);
  return parseProductPage(html, finalUrl.toString());
}
