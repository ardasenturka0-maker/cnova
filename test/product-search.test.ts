import assert from "node:assert/strict";
import test from "node:test";
import { inspectProductPage, searchProductOffers } from "../src/lib/services/productSearchService";
import { parseProductPage } from "../src/lib/services/productPageInspectorService";

test("internet product offers are validated, filtered and sorted by delivered total", async () => {
  const previousUrl = process.env.PRODUCT_SEARCH_API_URL;
  const previousKey = process.env.PRODUCT_SEARCH_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.PRODUCT_SEARCH_API_URL = "https://search.example.test/products";
  process.env.PRODUCT_SEARCH_API_KEY = "test-product-search-key-123456789";
  let requestedUrl = "";
  let authorization = "";
  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input);
    authorization = String((init?.headers as Record<string, string>)?.authorization || "");
    return new Response(JSON.stringify({ offers: [
      { seller: "Pahalı", unitPrice: 100, shippingPrice: 20, productUrl: "https://shop.example/pahali", inStock: true },
      { seller: "Ucuz", unitPrice: 90, shippingPrice: 5, productUrl: "https://shop.example/ucuz", inStock: true },
      { seller: "Tükendi", unitPrice: 50, shippingPrice: 0, productUrl: "https://shop.example/tukendi", inStock: false }
    ] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const offers = await searchProductOffers("  Anestezi   kartuşu  ");
    assert.equal(new URL(requestedUrl).searchParams.get("q"), "Anestezi kartuşu");
    assert.equal(authorization, "Bearer test-product-search-key-123456789");
    assert.deepEqual(offers.map((offer) => offer.seller), ["Ucuz", "Pahalı"]);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.PRODUCT_SEARCH_API_URL; else process.env.PRODUCT_SEARCH_API_URL = previousUrl;
    if (previousKey === undefined) delete process.env.PRODUCT_SEARCH_API_KEY; else process.env.PRODUCT_SEARCH_API_KEY = previousKey;
  }
});

test("built-in product page API reads JSON-LD and meta prices", () => {
  const jsonLd = `<html><script type="application/ld+json">{"@type":"Product","name":"Kompozit","brand":{"name":"Dental Depo"},"offers":{"@type":"Offer","price":"1299.90","priceCurrency":"TRY","availability":"https://schema.org/InStock"}}</script></html>`;
  assert.deepEqual(parseProductPage(jsonLd, "https://shop.example/kompozit"), {
    seller: "Dental Depo", unitPrice: 1299.9, shippingPrice: 0, productUrl: "https://shop.example/kompozit", inStock: true
  });
  const meta = `<meta property="og:site_name" content="Medikal Market"><meta property="product:price:amount" content="1.499,50">`;
  assert.equal(parseProductPage(meta, "https://market.example/urun").unitPrice, 1499.5);
});

test("a dentist can paste a purchase page and receive its live price", async () => {
  const previousUrl = process.env.PRODUCT_SEARCH_API_URL;
  const previousKey = process.env.PRODUCT_SEARCH_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.PRODUCT_SEARCH_API_URL = "https://search.example.test/products";
  process.env.PRODUCT_SEARCH_API_KEY = "test-product-search-key-123456789";
  let requestedUrl = "";
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ offers: [
      { seller: "Dental Mağaza", unitPrice: 249.9, shippingPrice: 0, productUrl: "https://redirect.example/untrusted", inStock: true }
    ] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const productUrl = "https://shop.example/kompozit-dolgu";
    const offer = await inspectProductPage(productUrl);
    assert.equal(new URL(requestedUrl).searchParams.get("url"), productUrl);
    assert.equal(offer.seller, "Dental Mağaza");
    assert.equal(offer.unitPrice, 249.9);
    assert.equal(offer.productUrl, productUrl);
    await assert.rejects(() => inspectProductPage("http://shop.example/urun"));
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.PRODUCT_SEARCH_API_URL; else process.env.PRODUCT_SEARCH_API_URL = previousUrl;
    if (previousKey === undefined) delete process.env.PRODUCT_SEARCH_API_KEY; else process.env.PRODUCT_SEARCH_API_KEY = previousKey;
  }
});
