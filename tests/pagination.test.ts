import { describe, expect, it } from "vitest";
import { paginate, parsePage, parsePageSize, pageNumbers, toPageResult } from "@/lib/pagination";

/* Pagination math is the last line of defence against stranded UI: filter
   lists that shrink, hand-typed ?page=999, garbage query strings. These lock
   the clamping so a refactor can't strand a grid on an empty page. */
describe("parsePage / parsePageSize", () => {
  it("defaults garbage pages to 1", () => {
    expect(parsePage(null)).toBe(1);
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("")).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-3")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("2")).toBe(2);
  });

  it("clamps page size to [1, max], garbage to fallback", () => {
    expect(parsePageSize(null)).toBe(20);
    expect(parsePageSize("abc")).toBe(20);
    expect(parsePageSize("0")).toBe(20);
    expect(parsePageSize("-5")).toBe(20);
    expect(parsePageSize("5")).toBe(5);
    expect(parsePageSize("1000")).toBe(100);
    expect(parsePageSize("1000", 20, 50)).toBe(50);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 55 }, (_, i) => i);

  it("slices the requested page", () => {
    const p = paginate(items, 2, 24);
    expect(p.page).toBe(2);
    expect(p.pageItems).toHaveLength(24);
    expect(p.total).toBe(55);
    expect(p.totalPages).toBe(3);
    expect([p.start, p.end]).toEqual([25, 48]);
  });

  it("clamps a page past the end instead of returning empty", () => {
    // Filter shrank the list while ?page=9 stayed in the URL.
    const p = paginate(items.slice(0, 5), 9, 24);
    expect(p.page).toBe(1);
    expect(p.pageItems).toHaveLength(5);
  });

  it("reports 0,0 bounds for an empty list", () => {
    const p = paginate([], 1, 24);
    expect(p.totalPages).toBe(1);
    expect([p.start, p.end]).toEqual([0, 0]);
    expect(p.pageItems).toEqual([]);
  });
});

describe("toPageResult", () => {
  it("keeps server-paged rows but clamps the page number", () => {
    const p = toPageResult([1, 2], 9, 24, 2);
    expect(p.page).toBe(1);
    expect(p.total).toBe(2);
    expect(p.pageItems).toEqual([1, 2]);
  });
});

describe("pageNumbers", () => {
  it("lists every page when short", () => {
    expect(pageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("collapses long runs with a single ellipsis", () => {
    const nums = pageNumbers(6, 12);
    expect(nums[0]).toBe(1);
    expect(nums[nums.length - 1]).toBe(12);
    expect(nums).toContain(6);
    expect(nums.filter((n) => n === "…").length).toBeLessThanOrEqual(2);
  });
});
