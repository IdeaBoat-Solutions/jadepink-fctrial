/* Typo-tolerant product matching for the floor — the "Amazon search box" brain.
   Pure + dependency-free so the server ranker and any client UI share it.

   How it works: the query is split into tokens ("florl dress" → ["florl",
   "dress"]). Every token must match somewhere in the product's words
   (name + colour + size + category + sku) — order doesn't matter, one typo
   per token is forgiven, plurals ("kurti"/"kurtis") collapse. Anything with
   an unmatched token is rejected, so results stay tight, not mushy. */

export function normalizeSearchText(raw: string): string {
  return (raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function searchTokens(query: string): string[] {
  return normalizeSearchText(query).split(" ").filter(Boolean);
}

/** Capped Levenshtein — bails out past maxDist instead of filling the matrix. */
export function editDistance(a: string, b: string, maxDist = 2): number {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > maxDist) return maxDist + 1;
  const prev: number[] = Array.from({ length: lb + 1 }, (_, j) => j);
  for (let i = 1; i <= la; i++) {
    let cur = i;
    let rowMin = i;
    let prevDiag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= lb; j++) {
      const nextDiag = prev[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(prev[j] + 1, cur + 1, prevDiag + cost);
      prevDiag = nextDiag;
      prev[j - 1] = cur;
      cur = v;
      if (v < rowMin) rowMin = v;
    }
    prev[lb] = cur;
    if (rowMin > maxDist) return maxDist + 1;
  }
  return prev[lb];
}

function singular(word: string): string {
  if (word.length > 4 && word.endsWith("es")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s")) return word.slice(0, -1);
  return word;
}

/* 0 exact · 1 prefix · 2 substring · 3 one typo · 4 two typos · 5 no match.
   Short tokens (sizes, "m", "red") only earn exact/prefix — edit distance on
   two letters is noise, not forgiveness. */
function wordScore(token: string, word: string): number {
  if (!word) return 5;
  if (word === token) return 0;
  if (word.startsWith(token)) return 1;
  if (word.includes(token)) return 2;
  const w = singular(word);
  const t = singular(token);
  if (w === t) return 1;
  if (w.startsWith(t) || t.startsWith(w)) return 2;
  if (token.length >= 4 && editDistance(t, w, 1) <= 1) return 3;
  if (token.length >= 6 && editDistance(t, w, 2) <= 2) return 4;
  return 5;
}

function tokenScore(token: string, words: string[]): number {
  let best = 5;
  for (const w of words) {
    const s = wordScore(token, w);
    if (s < best) best = s;
    if (best === 0) break;
  }
  return best;
}

/* Total relevance for one candidate, or null when any token finds nothing.
   Lower is better — sort ascending. */
export function rankQuery(haystack: string, tokens: string[]): number | null {
  if (!tokens.length) return null;
  const words = normalizeSearchText(haystack).split(" ").filter(Boolean);
  if (!words.length) return null;
  let total = 0;
  for (const t of tokens) {
    // Single letters only count on exact/prefix (sizes like "m").
    if (t.length === 1) {
      const hit = words.some((w) => w === t || w.startsWith(t));
      if (!hit) return null;
      total += words.some((w) => w === t) ? 0 : 1;
      continue;
    }
    const s = tokenScore(t, words);
    if (s >= 5) return null;
    total += s;
  }
  return total;
}
