import { describe, expect, it } from "vitest";
import {
  parseCsv,
  parseDurationToMinutes,
  parseMoneyToPence,
  slugify,
  suggestMapping,
} from "@/lib/import/csv";
import { SERVICE_TARGETS, validateServiceImport } from "@/lib/import/services";

const TARGETS = SERVICE_TARGETS.map((t) => ({ key: t.key, aliases: [...t.aliases] }));

describe("parseCsv", () => {
  it("reads a plain file", () => {
    const table = parseCsv("Name,Price\nSilk Press,85\nCut,75");
    expect(table.headers).toEqual(["Name", "Price"]);
    expect(table.rows).toEqual([
      { Name: "Silk Press", Price: "85" },
      { Name: "Cut", Price: "75" },
    ]);
  });

  it("keeps commas inside quoted fields", () => {
    const table = parseCsv('Name,Description\nCut,"Wash, cut and finish"');
    expect(table.rows[0].Description).toBe("Wash, cut and finish");
  });

  it("unescapes doubled quotes", () => {
    const table = parseCsv('Name,Description\nCut,"She said ""lovely"""');
    expect(table.rows[0].Description).toBe('She said "lovely"');
  });

  it("handles newlines inside quoted fields", () => {
    const table = parseCsv('Name,Description\nCut,"Line one\nLine two"');
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0].Description).toBe("Line one\nLine two");
  });

  it("handles CRLF endings and a trailing newline", () => {
    const table = parseCsv("Name,Price\r\nSilk Press,85\r\n");
    expect(table.rows).toEqual([{ Name: "Silk Press", Price: "85" }]);
  });

  it("strips a UTF-8 BOM", () => {
    const table = parseCsv("﻿Name,Price\nCut,75");
    expect(table.headers[0]).toBe("Name");
  });

  it("pads short rows rather than shifting columns", () => {
    const table = parseCsv("Name,Price,Deposit\nCut,75");
    expect(table.rows[0]).toEqual({ Name: "Cut", Price: "75", Deposit: "" });
  });

  it("returns nothing for an empty file", () => {
    expect(parseCsv("")).toEqual({ headers: [], rows: [] });
  });
});

describe("parseMoneyToPence", () => {
  it.each([
    ["85", 8500],
    ["£85", 8500],
    ["85.50", 8550],
    ["£1,085.50", 108550],
    ["85.5", 8550],
    ["0", 0],
    ["120 GBP", 12000],
  ])("reads %s as %i pence", (input, expected) => {
    expect(parseMoneyToPence(input)).toBe(expected);
  });

  it.each(["", "free", "POA", "85.999", "-20"])("rejects %s", (input) => {
    expect(parseMoneyToPence(input)).toBeNull();
  });

  it("never loses a penny to floating point", () => {
    // 0.1 + 0.2 style errors are why money is integer pence throughout.
    expect(parseMoneyToPence("0.29")).toBe(29);
    expect(parseMoneyToPence("1.10")).toBe(110);
    expect(parseMoneyToPence("19.99")).toBe(1999);
  });
});

describe("parseDurationToMinutes", () => {
  it.each([
    ["90", 90],
    ["90 min", 90],
    ["90 mins", 90],
    ["90 minutes", 90],
    ["1h 30m", 90],
    ["2h", 120],
    ["45m", 45],
    ["01:30", 90],
    ["00:45", 45],
  ])("reads %s as %i minutes", (input, expected) => {
    expect(parseDurationToMinutes(input)).toBe(expected);
  });

  it.each(["", "half an hour", "ninety"])("rejects %s", (input) => {
    expect(parseDurationToMinutes(input)).toBeNull();
  });
});

describe("slugify", () => {
  it("matches the database's slug shape", () => {
    expect(slugify("Wash, Cut & Finish")).toBe("wash-cut-finish");
    expect(slugify("Silk Press")).toBe("silk-press");
    expect(slugify("  Balayage  ")).toBe("balayage");
    expect(slugify("Coupé Française")).toBe("coupe-francaise");
  });
});

describe("suggestMapping", () => {
  it("matches exact column names", () => {
    const mapping = suggestMapping(["Name", "Price", "Duration"], TARGETS);
    expect(mapping.name).toBe("Name");
    expect(mapping.price).toBe("Price");
    expect(mapping.duration).toBe("Duration");
  });

  it("matches known Slick aliases", () => {
    const mapping = suggestMapping(
      ["Service Name", "Cost", "Length", "Service Category"],
      TARGETS,
    );
    expect(mapping.name).toBe("Service Name");
    expect(mapping.price).toBe("Cost");
    expect(mapping.duration).toBe("Length");
    expect(mapping.category).toBe("Service Category");
  });

  it("ignores case, spacing and punctuation", () => {
    const mapping = suggestMapping(["service_name", "PRICE (£)"], TARGETS);
    expect(mapping.name).toBe("service_name");
    expect(mapping.price).toBe("PRICE (£)");
  });

  it("never maps one column to two fields", () => {
    const mapping = suggestMapping(["Name", "Price"], TARGETS);
    const used = Object.values(mapping);
    expect(new Set(used).size).toBe(used.length);
  });

  it("leaves a field unmapped rather than guessing wildly", () => {
    const mapping = suggestMapping(["Widget", "Sprocket"], TARGETS);
    expect(mapping.price).toBeUndefined();
  });
});

describe("validateServiceImport", () => {
  const map = { name: "Name", price: "Price", duration: "Duration", category: "Category", deposit: "Deposit", description: "Description" };

  const table = (body: string) =>
    parseCsv(`Name,Category,Description,Duration,Price,Deposit\n${body}`);

  it("accepts a clean file", () => {
    const report = validateServiceImport(
      table("Silk Press,Smoothing,Smooth finish,90,85,30\nCut,Cutting,A cut,60,75,25"),
      map,
      new Set(),
    );
    expect(report.errorRows).toBe(0);
    expect(report.validRows).toBe(2);
    expect(report.rows[0].basePricePence).toBe(8500);
    expect(report.rows[0].depositPence).toBe(3000);
    expect(report.rows[0].durationMinutes).toBe(90);
  });

  it("rejects a row with no name and reports its line number", () => {
    const report = validateServiceImport(table(",Cutting,x,60,75,0"), map, new Set());
    expect(report.errorRows).toBe(1);
    expect(report.rows).toHaveLength(0);
    // Header is line 1, so the first data row is line 2.
    expect(report.issues[0].row).toBe(2);
  });

  it("rejects an unreadable price rather than importing zero", () => {
    const report = validateServiceImport(table("Cut,Cutting,x,60,POA,0"), map, new Set());
    expect(report.errorRows).toBe(1);
    expect(report.issues.some((i) => i.field === "price" && i.severity === "error")).toBe(true);
  });

  it("warns and defaults when a duration is missing", () => {
    const report = validateServiceImport(table("Cut,Cutting,x,,75,0"), map, new Set());
    expect(report.errorRows).toBe(0);
    expect(report.rows[0].durationMinutes).toBe(60);
    expect(report.issues.some((i) => i.severity === "warning" && i.field === "duration")).toBe(true);
  });

  it("rejects a duration outside what the database allows", () => {
    const report = validateServiceImport(table("Cut,Cutting,x,900,75,0"), map, new Set());
    expect(report.errorRows).toBe(1);
  });

  it("caps a deposit that exceeds the price instead of failing the insert", () => {
    // services_deposit_within_price would otherwise reject this at the database.
    const report = validateServiceImport(table("Cut,Cutting,x,60,50,80"), map, new Set());
    expect(report.errorRows).toBe(0);
    expect(report.rows[0].depositPence).toBe(5000);
    expect(report.issues.some((i) => i.field === "deposit" && i.severity === "warning")).toBe(true);
  });

  it("flags a service that already exists as a duplicate", () => {
    const report = validateServiceImport(
      table("Silk Press,Smoothing,x,90,85,30"),
      map,
      new Set(["silk-press"]),
    );
    expect(report.duplicateRows).toBe(1);
    expect(report.validRows).toBe(0);
    expect(report.rows[0].isDuplicate).toBe(true);
  });

  it("flags a repeat within the same file", () => {
    const report = validateServiceImport(
      table("Cut,Cutting,x,60,75,0\nCut,Cutting,x,60,75,0"),
      map,
      new Set(),
    );
    expect(report.duplicateRows).toBe(1);
    expect(report.validRows).toBe(1);
  });

  it("counts every row it read", () => {
    const report = validateServiceImport(
      table("Cut,Cutting,x,60,75,0\n,Cutting,x,60,75,0\nCut,Cutting,x,60,75,0"),
      map,
      new Set(),
    );
    expect(report.totalRows).toBe(3);
    expect(report.errorRows + report.validRows + report.duplicateRows).toBe(3);
  });
});
