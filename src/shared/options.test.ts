import { describe, expect, it } from "vitest";
import { fillTemplate, placeholdersOf } from "./options";

describe("template placeholders", () => {
  it("are listed once each, in order", () => {
    expect(placeholdersOf("A {product} on {surface} with {product}")).toEqual([
      "product",
      "surface",
    ]);
  });
  it("are filled where a value is given", () => {
    expect(
      fillTemplate("A {product} on {surface}", { product: " vase " }),
    ).toBe("A vase on {surface}");
  });
});
