import { assertEquals } from "@std/assert";
import { extractType } from "../types.ts";

Deno.test("extractType", async (t) => {
  await t.step("extracts type as first key", () => {
    assertEquals(extractType('{"type":"frame","plot":{}}'), "frame");
  });

  await t.step("extracts type as non-first key", () => {
    assertEquals(extractType('{"id":1,"type":"resize","width":800}'), "resize");
  });

  await t.step("ignores type inside nested object", () => {
    // "type" before the nested object is found correctly
    assertEquals(
      extractType('{"type":"frame","plot":{"type":"nested"}}'),
      "frame",
    );
  });

  await t.step("returns empty when type only exists in nested object", () => {
    // [^{}]* stops at the nested {, so a type-less top level returns ""
    assertEquals(
      extractType('{"plot":{"type":"nested"}}'),
      "",
    );
  });

  await t.step("returns empty string for missing type", () => {
    assertEquals(extractType('{"id":1}'), "");
  });

  await t.step("returns empty string for empty input", () => {
    assertEquals(extractType(""), "");
  });

  await t.step("handles whitespace around braces", () => {
    assertEquals(extractType('  { "type" : "close" }'), "close");
  });
});
