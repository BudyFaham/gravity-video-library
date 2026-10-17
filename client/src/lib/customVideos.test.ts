import { describe, expect, it } from "vitest";
import { parseCustomVideos } from "./customVideos";

describe("custom video storage", () => {
  it("accepts valid saved videos and ignores malformed entries", () => {
    const result = parseCustomVideos(JSON.stringify([{ id: "abc123", title: "محاضرة جديدة" }, { id: 42, title: "غير صالح" }, null]));
    expect(result).toEqual([{ id: "abc123", title: "محاضرة جديدة" }]);
  });

  it("returns an empty list for invalid storage content", () => {
    expect(parseCustomVideos("not-json")).toEqual([]);
    expect(parseCustomVideos(null)).toEqual([]);
  });
});
