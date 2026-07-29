import { describe, expect, it } from "vitest";
import { cards, categories } from "../app/data/cards.generated";

const normalize = (value: string) =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("it");

const duplicateKey = (value: string) =>
  normalize(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]/g, "");

describe("card database", () => {
  it("contains globally unique, valid cards", () => {
    const words = cards.map((card) => duplicateKey(card.word));
    expect(new Set(words).size).toBe(cards.length);
    expect(cards.length).toBeGreaterThan(2_500);

    for (const card of cards) {
      expect(card.forbidden).toHaveLength(5);
      expect(new Set(card.forbidden.map(normalize)).size).toBe(5);
      expect(card.forbidden.map(normalize)).not.toContain(normalize(card.word));
    }
  });

  it("contains every declared category and accurate counts", () => {
    for (const category of categories) {
      const count = cards.filter((card) => card.categoryId === category.id).length;
      expect(count).toBe(category.count);
      expect(count).toBeGreaterThan(0);
    }
  });
});
