import { describe, expect, it } from "vitest";
import { pageWindow } from "./pagination";

describe("pageWindow", () => {
  it("lists every page when there are few", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(2, 3)).toEqual([1, 2, 3]);
  });

  it("shows first, last and neighbours with gaps in between", () => {
    expect(pageWindow(10, 50)).toEqual([1, "gap", 9, 10, 11, "gap", 50]);
  });

  it("does not add a gap next to the first or last page", () => {
    expect(pageWindow(1, 50)).toEqual([1, 2, "gap", 50]);
    expect(pageWindow(3, 50)).toEqual([1, 2, 3, 4, "gap", 50]);
    expect(pageWindow(50, 50)).toEqual([1, "gap", 49, 50]);
  });
});
