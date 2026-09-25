import { describe, expect, it } from "vitest";
import {
  editDistance,
  normalizeSearchText,
  rankQuery,
  searchTokens,
} from "@/lib/fuzzy";

/* The floor search box is the "Amazon search" the FC types into all day. Its
   ranking is pure (src/lib/fuzzy), so every rule that decides what a retailer
   sees on the first screen is pinned here. A silent ranking regression costs
   real conversions, and no UI test would catch it. */

const HAY = {
  floralDress: "Floral Print Wrap Dress saree red free",
  kurti: "Cotton Kurti with Embroidery blue free",
  kurtas: "Chikankari Kurtas ivory free",
  saree: "Banarasi Silk Saree maroon 28",
  lehenga: "Pastel Lehenga Set pink 34",
  denim: "Denim Jacket indigo 32 medium",
  blackDress: "Black Party Dress black medium",
};

/** Score a query against one product's searchable text. */
const score = (query: string, haystack: string) => rankQuery(haystack, searchTokens(query));

describe("normalizeSearchText", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeSearchText("Saree, RED!")).toBe("saree red");
  });

  it("collapses runs of whitespace", () => {
    expect(normalizeSearchText("  florl   dress  ")).toBe("florl dress");
  });

  it("keeps digits — sizes and SKUs are searchable", () => {
    expect(normalizeSearchText("size 32")).toBe("size 32");
  });

  it("is null-safe", () => {
    expect(normalizeSearchText(undefined as unknown as string)).toBe("");
  });
});

describe("searchTokens", () => {
  it("splits on whitespace and drops empties", () => {
    expect(searchTokens("florl  dress ")).toEqual(["florl", "dress"]);
  });

  it("returns nothing for punctuation-only input", () => {
    expect(searchTokens("---")).toEqual([]);
  });
});

describe("editDistance", () => {
  it("measures single typos", () => {
    expect(editDistance("floral", "florl")).toBe(1);
    expect(editDistance("kurti", "kurti")).toBe(0);
  });

  it("bails out past maxDist instead of returning a full matrix distance", () => {
    // "abcdef" vs "uvwxyz" is distance 6 — capped at maxDist+1.
    expect(editDistance("abcdef", "uvwxyz", 2)).toBe(3);
  });
});

describe("rankQuery — matching rules", () => {
  it("requires EVERY token to match somewhere (no mushy results)", () => {
    expect(score("floral dress", HAY.floralDress)).not.toBeNull();
    // "saree" is absent from the kurti haystack.
    expect(score("saree kurti", HAY.kurti)).toBeNull();
  });

  it("is token-order-free", () => {
    expect(score("dress floral", HAY.floralDress)).toBe(score("floral dress", HAY.floralDress));
  });

  it("forgives one typo on long words", () => {
    expect(score("florl dress", HAY.floralDress)).not.toBeNull();
    expect(score("kurti", HAY.kurti)).not.toBeNull();
  });

  it("collapses plurals", () => {
    // "kurti" and "kurtas" are the same garment to a retailer.
    expect(score("kurti", HAY.kurtas)).not.toBeNull();
    expect(score("kurtis", HAY.kurti)).not.toBeNull();
  });

  it("matches on colour, size, category and sku, not just name", () => {
    expect(score("maroon", HAY.saree)).not.toBeNull();      // colour
    expect(score("28", HAY.saree)).not.toBeNull();           // size
    expect(score("indigo", HAY.denim)).not.toBeNull();       // colour
  });

  it("rejects gibberish rather than returning the whole catalogue", () => {
    expect(score("zzzqqq", HAY.floralDress)).toBeNull();
    expect(score("xqzvkj", HAY.denim)).toBeNull();
  });

  it("returns null for an empty token list or empty haystack", () => {
    expect(rankQuery(HAY.floralDress, [])).toBeNull();
    expect(rankQuery("", searchTokens("dress"))).toBeNull();
  });
});

describe("rankQuery — ranking order (what lands first in the dropdown)", () => {
  it("ranks exact before prefix before substring", () => {
    // wordScore ladder: 0 exact · 1 prefix · 2 substring
    const exact = score("lehenga", HAY.lehenga);   // "lehenga" is its own word
    const prefix = score("den", HAY.denim);         // "denim jacket" starts with it
    const substring = score("ana", HAY.saree);      // inside "banarasi"
    expect(exact).not.toBeNull();
    expect(prefix).not.toBeNull();
    expect(substring).not.toBeNull();
    expect(exact).toBeLessThan(prefix as number);
    expect(prefix).toBeLessThan(substring as number);
  });

  it("prefers a pure word match over a typo word for the same query", () => {
    const clean = score("silk", "Banarasi Silk Saree");        // exact word
    const typo = score("silk", "Banarasi Silkk Saree");         // one typo away
    expect(clean).not.toBeNull();
    expect(typo).not.toBeNull();
    expect(clean).toBeLessThan(typo as number);
  });

  it("charges more for a query whose extra token only fuzzily matches", () => {
    const single = score("floral", HAY.floralDress);
    const withTypo = score("floral denm", HAY.floralDress + " denim");
    expect(single).not.toBeNull();
    expect(withTypo).not.toBeNull();
    expect(withTypo).toBeGreaterThan(single as number);
  });

  it("keeps single-letter tokens (sizes) exact/prefix-only — no typo noise", () => {
    // "m" must not fuzzily match every word containing a near-m.
    expect(score("m", HAY.blackDress)).not.toBeNull();    // exact "medium"
    expect(score("z", HAY.floralDress)).toBeNull();
  });
});
