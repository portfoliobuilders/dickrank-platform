import { createElement, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { defaultFilters, SearchSidebar, type FilterState } from "@/components/search/SearchSidebar";

function Harness({ initial = defaultFilters }: { initial?: FilterState }) {
  const [filters, setFilters] = useState(initial);
  return createElement(SearchSidebar, {
    filters,
    onChange: setFilters,
    onReset: () => setFilters(defaultFilters),
    resultCount: 42,
  });
}

describe("search sidebar", () => {
  it("lists the 26 type filters, rating scale, verification, and location presets", () => {
    const html = renderToStaticMarkup(createElement(Harness));
    expect(html).toContain("Filters");
    expect(html).toContain("42 results");
    expect(html).toContain("Type (26 Categories)");
    expect(html).toContain("Straight");
    expect(html).toContain("Monster");
    expect(html).toContain("Minimum Rating");
    expect(html).toContain("Email Verified");
    expect(html).toContain("ID Verified");
    expect(html).toContain("Location");
    expect(html).toContain("Online Now");
    expect(html).toContain("Premium Only");
    expect(html).toContain("Reset All Filters");
    expect(defaultFilters.types).toEqual([]);
    expect(defaultFilters.rating).toEqual([0]);
  });
});
