const fs = require("fs");
const path = require("path");

const files = [
  "worldcup_calendar_2026.json",
  "public/worldcup_calendar_2026.json",
  "scripts/worldcup_calendar_2026.json"
];

const rawFiles = files.map((file) => fs.readFileSync(path.resolve(file), "utf8"));
const errors = [];

if (!rawFiles.every((raw) => raw === rawFiles[0])) {
  errors.push("Las tres copias del calendario no son idénticas.");
}

let calendar;
try {
  calendar = JSON.parse(rawFiles[0]);
} catch (error) {
  errors.push(`JSON inválido: ${error.message}`);
}

if (calendar) {
  const matches = Array.isArray(calendar.matches) ? calendar.matches : [];
  const ids = matches.map((match) => match.id);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);

  if (matches.length !== 104) errors.push(`Se esperaban 104 partidos y hay ${matches.length}.`);
  if (duplicateIds.length) errors.push(`IDs duplicados: ${[...new Set(duplicateIds)].join(", ")}.`);

  const byId = new Map(matches.map((match) => [match.id, match]));
  const expected = {
    M089: ["Paraguay", "Francia", "0-1", "Francia"],
    M090: ["Canadá", "Marruecos", "0-3", "Marruecos"],
    M097: ["Francia", "Marruecos", "2-0", "Francia"],
    M098: ["España", "Bélgica", "2-1", "España"],
    M099: ["Noruega", "Inglaterra", "1-2", "Inglaterra"],
    M100: ["Argentina", "Suiza", "3-1", "Argentina"],
    M101: ["Francia", "España", "0-2", "España"],
    M102: ["Inglaterra", "Argentina", "1-2", "Argentina"]
  };

  for (const [id, [home, away, score, winner]] of Object.entries(expected)) {
    const match = byId.get(id);
    if (!match) {
      errors.push(`Falta ${id}.`);
      continue;
    }
    if (match.home !== home || match.away !== away || match.score !== score || match.winner !== winner || match.status !== "complete") {
      errors.push(`${id} no coincide con el resultado verificado.`);
    }
  }

  const bronze = byId.get("M103");
  const final = byId.get("M104");
  if (!bronze || bronze.home !== "Francia" || bronze.away !== "Inglaterra") {
    errors.push("M103 debe ser Francia vs Inglaterra.");
  }
  if (!final || final.home !== "España" || final.away !== "Argentina") {
    errors.push("M104 debe ser España vs Argentina.");
  }

  for (const match of matches) {
    if (!match.id || !match.date || !match.home || !match.away || !match.status) {
      errors.push(`Partido incompleto: ${match.id || "sin ID"}.`);
    }
    if (match.status === "complete" && !match.score) {
      errors.push(`${match.id} está finalizado sin marcador.`);
    }
    if (!match.group && match.status === "complete" && !match.winner) {
      errors.push(`${match.id} está finalizado sin ganador.`);
    }
  }
}

if (errors.length) {
  console.error("Validación fallida:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Calendario válido: 104 partidos, copias sincronizadas y bracket actualizado.");
