import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import YAML from "yaml";

const projectRoot = resolve(import.meta.dirname, "..");
const sourceRoot = resolve(projectRoot, "../PyTaboo/assets/deck");
const targetRoot = resolve(projectRoot, "data/decks");
const reportPath = resolve(projectRoot, "data/import-report.json");

const categories = [
  ["animals", "Animali"],
  ["children", "Bambini"],
  ["brand", "Brand"],
  ["cartoon", "Cartoni"],
  ["food", "Cibo"],
  ["geo", "Geografia"],
  ["math", "Matematica"],
  ["music", "Musica"],
  ["nerd", "Nerd"],
  ["science", "Scienza"],
  ["sport", "Sport"],
  ["history", "Storia"],
  ["tech", "Tecnologia"],
  ["holiday", "Vacanze"],
  ["vehicoles", "Veicoli"],
];

const normalize = (value) =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("it");

const records = [];
for (const [categoryId, title] of categories) {
  const sourcePath = resolve(sourceRoot, `${categoryId}.yaml`);
  const source = await readFile(sourcePath, "utf8");

  for (const [index, rawLine] of source.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const parsed = YAML.parse(line);
    const entries = Object.entries(parsed ?? {});
    if (entries.length !== 1) {
      throw new Error(`${sourcePath}:${index + 1}: carta YAML non valida`);
    }

    const [word, forbidden] = entries[0];
    records.push({
      categoryId,
      categoryTitle: title,
      word: String(word).trim(),
      forbidden: Array.isArray(forbidden)
        ? forbidden.map((item) => String(item).trim())
        : forbidden,
      source: `${categoryId}.yaml:${index + 1}`,
    });
  }
}

// The legacy Python implementation used last-write-wins dictionaries. During
// this one-time migration we make that behavior explicit and report every
// discarded definition instead of losing it silently.
const winners = new Map();
const discarded = [];
for (const record of records) {
  const key = normalize(record.word);
  const previous = winners.get(key);
  if (previous) {
    discarded.push({
      normalizedWord: key,
      discarded: previous.source,
      kept: record.source,
    });
  }
  winners.set(key, record);
}

const grouped = new Map(categories.map(([id]) => [id, []]));
for (const record of winners.values()) grouped.get(record.categoryId).push(record);

await mkdir(targetRoot, { recursive: true });
for (const [categoryId] of categories) {
  const output = {};
  const cards = grouped
    .get(categoryId)
    .sort((a, b) => a.word.localeCompare(b.word, "it"));
  for (const card of cards) output[card.word] = card.forbidden;

  await writeFile(
    resolve(targetRoot, `${categoryId}.yaml`),
    YAML.stringify(output, { lineWidth: 0 }),
  );
}

await mkdir(dirname(reportPath), { recursive: true });
await writeFile(
  reportPath,
  `${JSON.stringify(
    {
      importedAt: new Date().toISOString(),
      sourceDefinitions: records.length,
      uniqueCards: winners.size,
      discardedDefinitions: discarded.length,
      discarded,
    },
    null,
    2,
  )}\n`,
);

console.log(
  `Importate ${winners.size} carte uniche; ${discarded.length} definizioni legacy registrate nel report.`,
);
