import { describe, expect, it } from "vitest";
import { insertAxisLabel, removeAxisLabel } from "../shared/grid-axis";

describe("grid axis labels", () => {
  it("inserts a prime label without renumbering the following original axis", () => {
    expect(insertAxisLabel(["1", "2", "3"], 0, "1′")).toEqual(["1", "1′", "2", "3"]);
    expect(insertAxisLabel(["1", "1′", "2", "3"], 1, "1″")).toEqual(["1", "1′", "1″", "2", "3"]);
  });

  it("keeps original labels when an inserted axis is removed", () => {
    expect(removeAxisLabel(["1", "1′", "2", "3"], 1)).toEqual(["1", "2", "3"]);
  });

  it("supports alphabetic prime labels too", () => {
    expect(insertAxisLabel(["A", "B", "C"], 0, "A′")).toEqual(["A", "A′", "B", "C"]);
  });
});
