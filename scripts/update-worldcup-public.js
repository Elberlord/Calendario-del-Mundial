/**
 * Smart World Cup public updater for GitHub Pages.
 * No API key needed.
 *
 * What this script protects:
 * - Fetches more than one public source and keeps the most complete result.
 * - Treats past scored matches as complete, so tables/brackets keep advancing.
 * - Resolves Ganador/Perdedor placeholders after each knockout result.
 * - Avoids overwriting a verified knockout result with an incomplete tie.
 */

const fs = require("fs/promises");
const path = require("path");

const CALENDAR_FILE = process.env.CALENDAR_FILE || "worldcup_calendar_2026.json";
const PUBLIC_CALENDAR_FILE = process.env.PUBLIC_CALENDAR_FILE || "public/worldcup_calendar_2026.json";
const SCRIPT_CALENDAR_FILE = process.env.SCRIPT_CALENDAR_FILE || "scripts/worldcup_calendar_2026.json";
const DEFAULT_PUBLIC_SOURCE_URLS = [
  "https://raw.githubusercontent.com/upbound-web/worldcup-live.json/master/2026/worldcup.json",
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json"
];
const PUBLIC_SOURCE_URLS = String(process.env.PUBLIC_SOURCE_URLS || DEFAULT_PUBLIC_SOURCE_URLS.join(","))
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);
const SOURCE_TIMEOUT_MS = Number(process.env.SOURCE_TIMEOUT_MS || 15000);
const SOURCE_RETRIES = Math.max(1, Number(process.env.SOURCE_RETRIES || 2));
const AUTOMATIC_UPDATE_START = new Date("2026-07-18T00:00:00Z");
const AUTOMATIC_UPDATE_END = new Date("2026-07-21T00:00:00Z");

// Correcciones verificadas para casos donde una fuente publica se queda con un marcador viejo
// o incompleto. Esto evita que una actualizacion automatica vuelva a romper cruces ya confirmados.
const VERIFIED_RESULT_FIXES = [
  {
    id: "M082", home: "Bélgica", away: "Senegal", date: "2026-07-01",
    status: "complete", score: "3-2", winner: "Bélgica",
    reason: "Resultado verificado: Bélgica 3-2 Senegal."
  },
  {
    id: "M086", home: "Argentina", away: "Cabo Verde", date: "2026-07-03",
    status: "complete", score: "3-2", winner: "Argentina",
    reason: "Resultado verificado: Argentina 3-2 Cabo Verde tras tiempo extra."
  },
  {
    id: "M088", home: "Australia", away: "Egipto", date: "2026-07-03",
    status: "complete", score: "1-1 (2-4)", winner: "Egipto",
    reason: "Resultado verificado: Australia 1-1 Egipto; Egipto ganó 4-2 en penales."
  },
  {
    id: "M089", home: "Paraguay", away: "Francia", date: "2026-07-04",
    timeET: "5:00 PM ET", venue: "Philadelphia",
    status: "complete", score: "0-1", winner: "Francia",
    reason: "Resultado e ID oficial corregidos: M089 Paraguay 0-1 Francia."
  },
  {
    id: "M090", home: "Canadá", away: "Marruecos", date: "2026-07-04",
    timeET: "1:00 PM ET", venue: "Houston",
    status: "complete", score: "0-3", winner: "Marruecos",
    reason: "Resultado e ID oficial corregidos: M090 Canadá 0-3 Marruecos."
  },
  {
    id: "M091", home: "Brasil", away: "Noruega", date: "2026-07-05",
    status: "complete", score: "1-2", winner: "Noruega",
    reason: "Resultado verificado: Brasil 1-2 Noruega."
  },
  {
    id: "M092", home: "México", away: "Inglaterra", date: "2026-07-05",
    status: "complete", score: "2-3", winner: "Inglaterra",
    reason: "Resultado verificado: México 2-3 Inglaterra."
  },
  {
    id: "M093", home: "Portugal", away: "España", date: "2026-07-06",
    status: "complete", score: "0-1", winner: "España",
    reason: "Resultado verificado: Portugal 0-1 España."
  },
  {
    id: "M094", home: "Estados Unidos", away: "Bélgica", date: "2026-07-06",
    status: "complete", score: "1-4", winner: "Bélgica",
    reason: "Resultado verificado: Estados Unidos 1-4 Bélgica."
  },
  {
    id: "M095", home: "Argentina", away: "Egipto", date: "2026-07-07",
    status: "complete", score: "3-2", winner: "Argentina",
    reason: "Resultado verificado: Argentina 3-2 Egipto."
  },
  {
    id: "M096", home: "Suiza", away: "Colombia", date: "2026-07-07",
    status: "complete", score: "0-0 (4-3)", winner: "Suiza",
    reason: "Resultado verificado: Suiza 0-0 Colombia; Suiza ganó 4-3 en penales."
  },
  {
    id: "M097", home: "Francia", away: "Marruecos", date: "2026-07-09",
    status: "complete", score: "2-0", winner: "Francia",
    reason: "Resultado oficial: Francia 2-0 Marruecos."
  },
  {
    id: "M098", home: "España", away: "Bélgica", date: "2026-07-10",
    status: "complete", score: "2-1", winner: "España",
    reason: "Resultado oficial: España 2-1 Bélgica."
  },
  {
    id: "M099", home: "Noruega", away: "Inglaterra", date: "2026-07-11",
    status: "complete", score: "1-2", winner: "Inglaterra",
    reason: "Resultado oficial: Noruega 1-2 Inglaterra tras tiempo extra."
  },
  {
    id: "M100", home: "Argentina", away: "Suiza", date: "2026-07-11",
    status: "complete", score: "3-1", winner: "Argentina",
    reason: "Resultado oficial: Argentina 3-1 Suiza tras tiempo extra."
  },
  {
    id: "M101", home: "Francia", away: "España", date: "2026-07-14",
    status: "complete", score: "0-2", winner: "España",
    reason: "Resultado oficial: Francia 0-2 España."
  },
  {
    id: "M102", home: "Inglaterra", away: "Argentina", date: "2026-07-15",
    status: "complete", score: "1-2", winner: "Argentina",
    reason: "Resultado oficial: Inglaterra 1-2 Argentina."
  }
];

if (require.main === module) {
  main().catch((error) => {
    console.error("Updater failed:", error);
    process.exit(1);
  });
}

async function main() {
  if (shouldSkipScheduledRun()) {
    console.log("Ejecución programada fuera de la ventana final del Mundial 2026. No se consulta ninguna fuente.");
    return;
  }

  const original = await readCalendar();
  let calendar = normalizeCalendar(original);

  if (isTournamentComplete(calendar)) {
    console.log("El calendario ya tiene los 104 partidos finalizados. No se requieren más consultas automáticas.");
    return;
  }

  console.log("Revisión programada: se consultan fuentes públicas y se repara el bracket si hay resultados pendientes.");

  const sourceCandidates = await fetchAvailableSources();
  const remoteMatches = combineCandidateMatches(sourceCandidates);

  if (remoteMatches.length) {
    calendar = normalizeCalendar(mergeMatches(calendar, remoteMatches));
    console.log(`Partidos normalizados desde fuentes publicas: ${remoteMatches.length}`);
  } else {
    console.log("Ninguna fuente publica devolvio partidos normalizados. Se aplicaron solo reparaciones locales seguras.");
  }

  calendar.competition = {
    ...(calendar.competition || {}),
    updateMode: "github-actions-public-no-key-stable",
    publicSources: PUBLIC_SOURCE_URLS,
    autoStatusRepair: true,
    knockoutAutoAdvance: true,
    automaticUpdateWindow: "2026-07-18/2026-07-20",
    sourceTimeoutMs: SOURCE_TIMEOUT_MS
  };

  const changed = comparableCalendar(original) !== comparableCalendar(calendar);

  if (!changed) {
    console.log("Sin cambios reales para guardar.");
    return;
  }

  calendar.competition.lastUpdated = new Date().toISOString();
  await writeCalendar(calendar);
  console.log("Calendario actualizado y guardado en raiz + public/.");
}

async function readCalendar() {
  const raw = await fs.readFile(CALENDAR_FILE, "utf8");
  return JSON.parse(raw);
}

async function writeCalendar(calendar) {
  const output = JSON.stringify(calendar, null, 2) + "\n";
  await fs.writeFile(CALENDAR_FILE, output, "utf8");
  await fs.mkdir(path.dirname(PUBLIC_CALENDAR_FILE), { recursive: true });
  await fs.writeFile(PUBLIC_CALENDAR_FILE, output, "utf8");
  if (SCRIPT_CALENDAR_FILE && SCRIPT_CALENDAR_FILE !== CALENDAR_FILE && SCRIPT_CALENDAR_FILE !== PUBLIC_CALENDAR_FILE) {
    await fs.mkdir(path.dirname(SCRIPT_CALENDAR_FILE), { recursive: true });
    await fs.writeFile(SCRIPT_CALENDAR_FILE, output, "utf8");
  }
}

async function fetchAvailableSources() {
  const candidates = [];

  for (let priority = 0; priority < PUBLIC_SOURCE_URLS.length; priority += 1) {
    const url = PUBLIC_SOURCE_URLS[priority];

    try {
      console.log(`Consultando fuente publica: ${url}`);
      const payload = await fetchJsonWithRetry(url);
      const matches = normalizePayload(payload, url, priority);
      const stats = getSourceStats(matches);

      console.log(
        `Fuente revisada: ${url} · partidos: ${stats.total} · con marcador: ${stats.scored} · finalizados: ${stats.completed}`
      );

      if (matches.length) {
        candidates.push({ url, priority, matches, stats });
      }
    } catch (error) {
      console.log(`Fuente fallo: ${url}`);
      console.log(error.message);
    }
  }

  candidates.sort((a, b) =>
    b.stats.completed - a.stats.completed ||
    b.stats.scored - a.stats.scored ||
    b.stats.total - a.stats.total ||
    a.priority - b.priority
  );

  if (candidates.length) {
    const best = candidates[0];
    console.log(
      `Mejor fuente disponible: ${best.url} · partidos: ${best.stats.total} · con marcador: ${best.stats.scored} · finalizados: ${best.stats.completed}`
    );
  }

  return candidates;
}

function shouldSkipScheduledRun() {
  if (process.env.GITHUB_EVENT_NAME !== "schedule") return false;
  const now = new Date();
  return now < AUTOMATIC_UPDATE_START || now >= AUTOMATIC_UPDATE_END;
}

function isTournamentComplete(calendar) {
  const matches = calendar?.matches || [];
  return matches.length === 104 && matches.every((match) => match.status === "complete");
}

async function fetchJsonWithRetry(url) {
  let lastError = null;

  for (let attempt = 1; attempt <= SOURCE_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "Accept": "application/json,text/plain,*/*",
          "User-Agent": "mundial-calendar-updater/2.0 (+github-actions)"
        }
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const raw = await response.text();
      if (!raw.trim()) throw new Error("respuesta vacía");
      return JSON.parse(raw);
    } catch (error) {
      lastError = error;
      const reason = error?.name === "AbortError" ? `timeout de ${SOURCE_TIMEOUT_MS} ms` : error.message;
      console.log(`Intento ${attempt}/${SOURCE_RETRIES} falló para ${url}: ${reason}`);
      if (attempt < SOURCE_RETRIES) await sleep(1000 * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error("No se pudo consultar la fuente");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function combineCandidateMatches(candidates) {
  const byKey = new Map();
  const loose = [];

  for (const candidate of candidates) {
    for (const match of candidate.matches) {
      const keys = getRemoteMergeKeys(match);
      if (!keys.length) {
        loose.push(match);
        continue;
      }

      for (const key of keys) {
        const current = byKey.get(key);
        if (!current || remoteQuality(match) > remoteQuality(current)) {
          byKey.set(key, match);
        }
      }
    }
  }

  const unique = new Map();
  for (const match of [...byKey.values(), ...loose]) {
    const key = getRemoteMergeKeys(match)[0] || `${match.source}|${match.externalId}|${match.home}|${match.away}|${match.date}`;
    const current = unique.get(key);
    if (!current || remoteQuality(match) > remoteQuality(current)) unique.set(key, match);
  }

  return [...unique.values()].sort((a, b) =>
    String(a.date || "").localeCompare(String(b.date || "")) ||
    String(a.timeET || "").localeCompare(String(b.timeET || "")) ||
    String(a.id || "").localeCompare(String(b.id || ""))
  );
}

function getRemoteMergeKeys(match) {
  const keys = [];
  if (match.externalId) keys.push(`id:${normalizeExternalId(match.externalId)}`);
  if (match.date && match.home && match.away) {
    keys.push(`teams:${makeTeamDateKey(match)}`);
    keys.push(`teams:${makeTeamDateKey({ ...match, home: match.away, away: match.home })}`);
  }
  if (match.group && match.home && match.away) keys.push(`group:${makeGroupPairKey(match)}`);
  return keys.filter(Boolean);
}

function getSourceStats(matches) {
  return {
    total: matches.length,
    scored: matches.filter(match => Boolean(match.score)).length,
    completed: matches.filter(match => match.status === "complete").length
  };
}

function normalizePayload(payload, sourceUrl, sourcePriority) {
  let rawMatches = [];

  if (Array.isArray(payload)) rawMatches = payload;
  else if (Array.isArray(payload.matches)) rawMatches = payload.matches;
  else if (Array.isArray(payload.games)) rawMatches = payload.games;
  else if (Array.isArray(payload.data)) rawMatches = payload.data;
  else if (Array.isArray(payload.response)) rawMatches = payload.response;
  else if (payload.response && Array.isArray(payload.response.games)) rawMatches = payload.response.games;
  else if (payload.game && typeof payload.game === "object") rawMatches = [payload.game];

  return rawMatches
    .map((match, index) => normalizeMatch(match, sourceUrl, sourcePriority, index))
    .filter(Boolean);
}

function normalizeMatch(match, sourceUrl, sourcePriority, index) {
  const home = pick(match, [
    "team1", "home", "homeTeam", "home_team", "homeTeamName", "teamA", "team_a",
    "local", "localTeam", "home_name", "home_team_name", "home_team_name_en", "homeTeamNameEn"
  ]);

  const away = pick(match, [
    "team2", "away", "awayTeam", "away_team", "awayTeamName", "teamB", "team_b",
    "visitor", "visitorTeam", "away_name", "away_team_name", "away_team_name_en", "awayTeamNameEn"
  ]);

  const date = normalizeDate(pick(match, [
    "date", "matchDate", "kickoffDate", "startDate", "local_date", "utc_date", "datetime", "fixtureDate"
  ]));
  if (!home || !away || !date) return null;

  const score = extractScore(match);
  const status = extractStatus(match, score);
  const roundRaw = String(pick(match, ["round", "stage", "phase", "matchday", "roundName", "type"]) || "");
  const typeRaw = String(pick(match, ["type", "stage_type", "phase_type"]) || "");
  const groupRaw = String(pick(match, ["group", "groupName", "pool"]) || "");
  const winner = extractWinner(match) || inferWinnerFromValues(home, away, score, status);
  const rawId = pick(match, ["id", "matchId", "gameId", "_id", "fixture_id"]);

  const normalized = {
    id: String(rawId || `PUBLIC-${index + 1}`),
    externalId: String(rawId || `PUBLIC-${index + 1}`),
    stage: inferStage(roundRaw, groupRaw, typeRaw),
    round: normalizeRound(roundRaw, groupRaw, typeRaw),
    group: normalizeGroup(groupRaw || roundRaw),
    date,
    timeET: normalizeTimeET(match),
    home: translateTeamName(home),
    away: translateTeamName(away),
    venue: pick(match, ["ground", "venue", "stadium", "city", "location", "stadium_name", "stadium_name_en"]) || "",
    status,
    score,
    source: sourceUrl,
    sourcePriority
  };

  if (winner) normalized.winner = translateTeamName(winner);
  return normalized;
}

function pick(obj, keys) {
  for (const key of keys) {
    const value = obj?.[key];

    if (typeof value === "string" && value.trim() && value.trim().toLowerCase() !== "null") return value.trim();
    if (typeof value === "number") return String(value);
    if (typeof value === "boolean") return String(value);

    if (value && typeof value === "object") {
      if (value.name) return String(value.name).trim();
      if (value.en) return String(value.en).trim();
      if (value.title) return String(value.title).trim();
      if (value.name_en) return String(value.name_en).trim();
    }
  }
  return "";
}

function extractScore(match) {
  const penalties = extractPenaltyScore(match);

  const mainArray = firstArray(
    match?.score?.et,
    match?.score?.extraTime,
    match?.score?.extra_time,
    match?.score?.fulltime,
    match?.score?.fullTime,
    match?.score?.ft,
    match?.score?.regular,
    match?.score
  );

  if (mainArray) {
    const [homeScore, awayScore] = mainArray;
    if (shouldIgnoreZeroZeroNotStarted(match, homeScore, awayScore)) return "";
    return formatScoreWithPenalties(homeScore, awayScore, penalties);
  }

  const homeScore = firstDefined(
    match.homeScore, match.scoreHome, match.home_score, match.goalsHome, match.homeGoals,
    match.home_score_current, match.score_home, match?.score?.home, match?.goals?.home
  );
  const awayScore = firstDefined(
    match.awayScore, match.scoreAway, match.away_score, match.goalsAway, match.awayGoals,
    match.away_score_current, match.score_away, match?.score?.away, match?.goals?.away
  );

  if (isScoreValue(homeScore) && isScoreValue(awayScore)) {
    if (shouldIgnoreZeroZeroNotStarted(match, homeScore, awayScore)) return "";
    return formatScoreWithPenalties(homeScore, awayScore, penalties);
  }

  if (typeof match.result === "string") {
    const result = match.result.trim();

    if (/^\d+\s*-\s*\d+\s*\(\d+\s*-\s*\d+\)$/.test(result)) {
      return result.replace(/\s+/g, "");
    }

    if (/^\d+\s*-\s*\d+$/.test(result)) {
      const [home, away] = result.split("-").map(value => value.trim());
      if (shouldIgnoreZeroZeroNotStarted(match, home, away)) return "";
      return formatScoreWithPenalties(home, away, penalties);
    }
  }

  return "";
}

function firstArray(...values) {
  for (const value of values) {
    if (Array.isArray(value) && value.length >= 2 && isScoreValue(value[0]) && isScoreValue(value[1])) return value;
  }
  return null;
}

function shouldIgnoreZeroZeroNotStarted(match, homeScore, awayScore) {
  const home = Number(homeScore);
  const away = Number(awayScore);
  if (home !== 0 || away !== 0) return false;

  const finished = parseBoolean(firstDefined(match.finished, match.isFinished, match.completed, match.is_complete));
  if (finished === true) return false;

  const elapsed = String(firstDefined(match.time_elapsed, match.elapsed, match.status, match.state, match.matchStatus, match.gameStatus) || "").toLowerCase();
  return finished === false || /not\s*started|notstarted|scheduled|upcoming|fixture|pre|none|^0$/.test(elapsed);
}

function formatScoreWithPenalties(homeScore, awayScore, penalties) {
  const base = `${Number(homeScore)}-${Number(awayScore)}`;
  if (!penalties) return base;

  const home = Number(homeScore);
  const away = Number(awayScore);

  // Solo se añaden penales cuando el marcador principal terminó empatado.
  if (home !== away) return base;

  return `${base} (${penalties.home}-${penalties.away})`;
}

function extractPenaltyScore(match) {
  const candidates = [
    match?.score?.p,
    match?.score?.pens,
    match?.score?.penalties,
    match?.score?.penalty,
    match?.score?.pk,
    match?.score?.shootout,
    match?.penalties,
    match?.penalty,
    match?.shootout
  ];

  for (const candidate of candidates) {
    const parsed = parsePenaltyCandidate(candidate);
    if (parsed) return parsed;
  }

  const homePens = firstDefined(
    match.homePenaltyScore, match.penaltyHome, match.penaltiesHome, match.homePenalties,
    match.pen_home, match.home_penalty_score, match?.score?.penaltiesHome, match?.score?.homePenalties
  );
  const awayPens = firstDefined(
    match.awayPenaltyScore, match.penaltyAway, match.penaltiesAway, match.awayPenalties,
    match.pen_away, match.away_penalty_score, match?.score?.penaltiesAway, match?.score?.awayPenalties
  );

  if (isScoreValue(homePens) && isScoreValue(awayPens)) {
    return { home: Number(homePens), away: Number(awayPens) };
  }

  return null;
}

function parsePenaltyCandidate(candidate) {
  if (!candidate) return null;

  if (Array.isArray(candidate) && candidate.length >= 2 && isScoreValue(candidate[0]) && isScoreValue(candidate[1])) {
    return { home: Number(candidate[0]), away: Number(candidate[1]) };
  }

  if (typeof candidate === "string") {
    const match = candidate.trim().match(/^(\d+)\s*-\s*(\d+)$/);
    if (match) return { home: Number(match[1]), away: Number(match[2]) };
  }

  if (typeof candidate === "object") {
    const home = firstDefined(candidate.home, candidate.homeScore, candidate.scoreHome, candidate.team1, candidate.local);
    const away = firstDefined(candidate.away, candidate.awayScore, candidate.scoreAway, candidate.team2, candidate.visitor);

    if (isScoreValue(home) && isScoreValue(away)) {
      return { home: Number(home), away: Number(away) };
    }
  }

  return null;
}

function extractWinner(match) {
  return pick(match, [
    "winner", "winnerTeam", "winner_team", "winnerName", "winningTeam", "winning_team",
    "qualifiedTeam", "qualified_team", "advanceTeam", "advancingTeam"
  ]);
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function isScoreValue(value) {
  return value !== undefined && value !== null && value !== "" && !Number.isNaN(Number(value));
}

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  const text = String(value || "").trim().toLowerCase();
  if (["true", "1", "yes", "y", "finished", "complete", "completed"].includes(text)) return true;
  if (["false", "0", "no", "n", "notstarted", "not started", "scheduled", "upcoming"].includes(text)) return false;
  return null;
}

function extractStatus(match, score) {
  const raw = String(pick(match, ["status", "state", "matchStatus", "gameStatus", "time_elapsed"]) || "").toLowerCase();
  const finished = parseBoolean(firstDefined(match.finished, match.isFinished, match.completed, match.is_complete));

  if (finished === true) return "complete";
  if (raw.includes("finished") || raw.includes("complete") || raw.includes("final") || raw === "ft" || raw.includes("aet") || raw.includes("pen")) return "complete";
  if (raw.includes("live") || raw.includes("playing") || raw.includes("progress") || raw.includes("in play") || /^\d+$/.test(raw)) return "live";
  if (finished === false || raw.includes("notstarted") || raw.includes("not started") || raw.includes("scheduled") || raw.includes("upcoming")) return "scheduled";

  if (score) {
    return matchEndedBySchedule(match) ? "complete" : "live";
  }

  return "scheduled";
}

function normalizeDate(value) {
  if (!value) return "";
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const slashDate = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashDate) {
    const month = slashDate[1].padStart(2, "0");
    const day = slashDate[2].padStart(2, "0");
    return `${slashDate[3]}-${month}-${day}`;
  }

  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);

  return "";
}

function normalizeTimeET(match) {
  const time = pick(match, ["time", "kickoff", "kickoffTime", "startTime", "hour"]);
  const localDate = pick(match, ["local_date"]);

  if (localDate) {
    const parsed = parseLooseDateTime(localDate);
    if (parsed) return formatET(parsed);
  }

  if (!time) return "";
  if (/ET/i.test(time)) return time;

  const dateValue = pick(match, ["date", "matchDate", "kickoffDate", "startDate"]);
  const utcOffsetMatch = String(time).match(/(\d{1,2}):(\d{2})\s*UTC([+-]\d{1,2})/i);
  if (utcOffsetMatch && dateValue) {
    const hour = Number(utcOffsetMatch[1]);
    const minute = Number(utcOffsetMatch[2]);
    const offset = Number(utcOffsetMatch[3]);
    const sign = offset >= 0 ? "+" : "-";
    const iso = `${normalizeDate(dateValue)}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00${sign}${String(Math.abs(offset)).padStart(2, "0")}:00`;
    return formatET(new Date(iso));
  }

  if (/^\d{1,2}:\d{2}$/.test(time)) return `${time}`;

  const parsed = new Date(time);
  if (!Number.isNaN(parsed.getTime())) return formatET(parsed);

  return String(time);
}

function parseLooseDateTime(value) {
  const raw = String(value || "").trim();
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (slash) {
    const [, month, day, year, hour, minute] = slash;
    return new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute}:00-04:00`);
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseKickoffInstant(match) {
  const direct = pick(match, ["datetime", "utc_date", "fixtureDate", "startDate", "kickoffDate"]);
  if (direct) {
    const parsed = new Date(direct);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const localDate = pick(match, ["local_date"]);
  if (localDate) return parseLooseDateTime(localDate);

  const date = normalizeDate(pick(match, ["date", "matchDate"]));
  const time = pick(match, ["time", "kickoff", "kickoffTime", "startTime", "hour"]);
  if (!date) return null;

  if (time) {
    const utcOffsetMatch = String(time).match(/(\d{1,2}):(\d{2})\s*UTC([+-]\d{1,2})/i);
    if (utcOffsetMatch) {
      const hour = Number(utcOffsetMatch[1]);
      const minute = Number(utcOffsetMatch[2]);
      const offset = Number(utcOffsetMatch[3]);
      const sign = offset >= 0 ? "+" : "-";
      return new Date(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00${sign}${String(Math.abs(offset)).padStart(2, "0")}:00`);
    }

    if (/^\d{1,2}:\d{2}$/.test(time)) {
      const [hour, minute] = time.split(":");
      return new Date(`${date}T${hour.padStart(2, "0")}:${minute}:00-04:00`);
    }
  }

  return new Date(`${date}T23:59:59-04:00`);
}

function matchEndedBySchedule(match) {
  const kickoff = parseKickoffInstant(match);
  if (!kickoff || Number.isNaN(kickoff.getTime())) {
    const date = normalizeDate(match.date);
    if (!date) return false;
    const today = new Date().toISOString().slice(0, 10);
    return date < today;
  }

  const END_BUFFER_MINUTES = Number(process.env.UPDATE_AFTER_MINUTES || 180);
  return Date.now() >= kickoff.getTime() + END_BUFFER_MINUTES * 60 * 1000;
}

function formatET(date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(date) + " ET";
}

function normalizeRound(roundRaw, groupRaw, typeRaw) {
  const text = String(roundRaw || "").trim();
  const type = String(typeRaw || "").toLowerCase();
  if (!text && type.includes("group")) return "Jornada";
  if (/^\d+$/.test(text) && (groupRaw || type.includes("group"))) return `Jornada ${text}`;
  if (/matchday/i.test(text)) return text.replace(/Matchday/i, "Jornada");
  if (/round of 16/i.test(text) || /round_?of_?16/i.test(type)) return "Octavos";
  if (/round of 32/i.test(text) || /round_?of_?32/i.test(type)) return "R32";
  return text || "Calendario";
}

function normalizeGroup(value) {
  const text = String(value || "").trim();
  const match = text.match(/^([A-L])$/i) || text.match(/Group\s+([A-L])/i) || text.match(/Grupo\s+([A-L])/i);
  return match ? `Grupo ${match[1].toUpperCase()}` : "";
}

function inferStage(roundRaw, groupRaw, typeRaw) {
  const text = `${roundRaw} ${groupRaw} ${typeRaw}`.toLowerCase();

  if (text.includes("group") || text.includes("grupo") || text.includes("matchday") || text.includes("jornada") || /^\s*[a-l]\s*$/.test(String(groupRaw))) return "Fase de grupos";
  if (text.includes("round of 32") || text.includes("round_of_32") || text.includes("r32")) return "Round of 32";
  if (text.includes("round of 16") || text.includes("round_of_16") || text.includes("octavos")) return "Octavos de final";
  if (text.includes("quarter") || text.includes("cuartos")) return "Cuartos de final";
  if (text.includes("semi")) return "Semifinales";
  if (text.includes("3rd") || text.includes("third") || text.includes("tercer")) return "Tercer lugar";
  if (text.includes("final")) return "Final";

  return roundRaw || "Calendario";
}

function mergeMatches(calendar, remoteMatches) {
  const updated = normalizeCalendar(structuredClone(calendar));
  const current = updated.matches || [];
  const byExternalId = new Map();
  const byNumericId = new Map();
  const byTeamDate = new Map();
  const byGroupPair = new Map();

  for (let i = 0; i < current.length; i++) {
    const match = current[i];
    if (match.externalId) byExternalId.set(normalizeExternalId(match.externalId), i);
    if (match.id) byExternalId.set(normalizeExternalId(match.id), i);
    const numeric = normalizeExternalId(match.id);
    if (numeric) byNumericId.set(numeric, i);
    byTeamDate.set(makeTeamDateKey(match), i);
    byTeamDate.set(makeTeamDateKey({ ...match, home: match.away, away: match.home }), i);
    if (match.group) byGroupPair.set(makeGroupPairKey(match), i);
  }

  let changedCount = 0;

  for (const remote of remoteMatches) {
    let index = byTeamDate.get(makeTeamDateKey(remote));
    if (index === undefined && remote.group) index = byGroupPair.get(makeGroupPairKey(remote));

    if (index === undefined && remote.externalId) {
      const numeric = normalizeExternalId(remote.externalId);
      const candidateIndex = byNumericId.get(numeric) ?? byExternalId.get(numeric);
      if (candidateIndex !== undefined && isCompatibleRemoteSlot(current[candidateIndex], remote)) {
        index = candidateIndex;
      }
    }

    if (index === undefined) {
      index = findResolvedKnockoutSlotIndex(current, remote);
    }

    if (index === undefined) {
      // Los feeds publicos suelen traer eliminatorias o partidos cruzados de medianoche con otro ID/fecha.
      // Si no encontramos un partido real del calendario local, no lo agregamos para evitar duplicados fantasma.
      continue;
    }

    const existing = current[index];
    const alignedRemote = alignRemoteOrientation(remote, existing);
    const safeRemote = protectKnockoutRemoteResult(alignedRemote, existing);
    const merged = mergeSingleMatch(existing, safeRemote);

    if (JSON.stringify(existing) !== JSON.stringify(merged)) {
      changedCount += 1;
      current[index] = merged;
    }
  }

  updated.matches = dedupeCurrentMatches(current).sort(sortMatches);

  console.log(`Partidos modificados/agregados: ${changedCount}`);
  return updated;
}

function alignRemoteOrientation(remote, existing) {
  if (!remote || !existing) return remote;

  const direct = normalizeName(remote.home) === normalizeName(existing.home) &&
    normalizeName(remote.away) === normalizeName(existing.away);
  const reversed = normalizeName(remote.home) === normalizeName(existing.away) &&
    normalizeName(remote.away) === normalizeName(existing.home);

  if (direct || !reversed) return remote;

  return {
    ...remote,
    home: existing.home,
    away: existing.away,
    score: reverseScoreText(remote.score)
  };
}

function reverseScoreText(value) {
  const score = parseScoreText(value);
  if (!score) return value;

  const base = `${score.away}-${score.home}`;
  if (score.pensHome === null || score.pensAway === null) return base;
  return `${base} (${score.pensAway}-${score.pensHome})`;
}

function mergeSingleMatch(existing, remote) {
  const existingQuality = remoteQuality(existing);
  const remoteResultQuality = remoteQuality(remote);
  const remoteHasUsefulResult = Boolean(remote.score) && remoteResultQuality >= existingQuality;
  const canReplaceTeams = !remote.group && remote.home && remote.away && (isPlaceholderTeam(existing.home) || isPlaceholderTeam(existing.away));

  const merged = {
    ...existing,
    id: existing.id || remote.id,
    externalId: existing.externalId || remote.externalId,
    source: remote.source || existing.source,
    venue: existing.venue || remote.venue,
    timeET: existing.timeET || remote.timeET,
    round: existing.round || remote.round,
    stage: existing.stage || remote.stage,
    group: existing.group || remote.group
  };

  if (canReplaceTeams) {
    merged.home = remote.home || merged.home;
    merged.away = remote.away || merged.away;
  }

  if (remoteHasUsefulResult || !existing.score) merged.score = remote.score || existing.score;

  if (remote.status === "complete") merged.status = "complete";
  else if (remote.status === "live" && merged.status !== "complete") merged.status = "live";
  else if (!merged.status) merged.status = remote.status || "scheduled";

  if (remote.winner && (remote.status === "complete" || !merged.winner)) merged.winner = remote.winner;
  if (!merged.winner && merged.status === "complete" && !merged.group) {
    merged.winner = inferWinnerFromValues(merged.home, merged.away, merged.score, merged.status) || merged.winner;
  }

  return merged;
}

function isCompatibleRemoteSlot(existing, remote) {
  if (!existing || !remote) return false;
  if (String(existing.date || "") !== String(remote.date || "")) return false;
  if (existing.group || remote.group) return true;

  const teamsMatch = makeTeamDateKey(existing) === makeTeamDateKey(remote) ||
    makeTeamDateKey({ ...existing, home: existing.away, away: existing.home }) === makeTeamDateKey(remote);

  return teamsMatch || isPlaceholderTeam(existing.home) || isPlaceholderTeam(existing.away);
}

function findResolvedKnockoutSlotIndex(current, remote) {
  if (remote.group) return undefined;
  const remoteHome = normalizeName(remote.home || "");
  const remoteAway = normalizeName(remote.away || "");
  if (!remoteHome || !remoteAway) return undefined;

  return current.findIndex((match) => {
    if (match.group) return false;
    if (String(match.date || "") !== String(remote.date || "")) return false;
    const home = normalizeName(match.home || "");
    const away = normalizeName(match.away || "");
    return (home === remoteHome && away === remoteAway) || (home === remoteAway && away === remoteHome);
  });
}

function normalizeCalendar(calendar) {
  let updated = structuredClone(calendar);
  updated.matches = (updated.matches || []).map((match) => normalizeExistingMatch(match));
  updated = applyVerifiedResultFixes(updated);
  updated = applyKnockoutAdvancement(updated);
  updated.matches = dedupeCurrentMatches(updated.matches || []).sort(sortMatches);
  return updated;
}

function normalizeExistingMatch(match) {
  const normalized = { ...match };
  const score = parseScoreText(normalized.score);

  if (score && shouldPromoteExistingScoreToComplete(normalized, score)) {
    normalized.status = "complete";
  }

  if (normalized.status === "complete" && !normalized.group && !normalized.winner) {
    normalized.winner = inferWinnerFromValues(normalized.home, normalized.away, normalized.score, normalized.status) || normalized.winner;
  }

  if (!normalized.status) normalized.status = "scheduled";
  return normalized;
}

function shouldPromoteExistingScoreToComplete(match, score) {
  if (!score) return false;
  if (match.status === "complete") return true;
  if (match.status === "live" && !matchEndedBySchedule(match)) return false;
  if (match.group) return matchEndedBySchedule(match);
  return hasResolvedWinner(match) && matchEndedBySchedule(match);
}

function applyVerifiedResultFixes(calendar) {
  const updated = structuredClone(calendar);
  const matches = updated.matches || [];
  let fixCount = 0;

  for (const fix of VERIFIED_RESULT_FIXES) {
    const index = matches.findIndex((match) =>
      String(match.id || "") === fix.id ||
      (
        String(match.date || "") === fix.date &&
        normalizeName(match.home || "") === normalizeName(fix.home) &&
        normalizeName(match.away || "") === normalizeName(fix.away)
      )
    );

    if (index === -1) continue;

    const existing = matches[index];
    const corrected = {
      ...existing,
      home: fix.home || existing.home,
      away: fix.away || existing.away,
      date: fix.date || existing.date,
      timeET: fix.timeET || existing.timeET,
      venue: fix.venue || existing.venue,
      status: fix.status,
      score: fix.score,
      winner: fix.winner,
      resultProtection: fix.reason
    };

    if (JSON.stringify(existing) !== JSON.stringify(corrected)) {
      matches[index] = corrected;
      fixCount += 1;
      console.log(`Correccion verificada aplicada: ${fix.id} ${fix.home} ${fix.score} ${fix.away}`);
    }
  }

  updated.matches = matches;
  if (fixCount) console.log(`Correcciones verificadas aplicadas: ${fixCount}`);
  return updated;
}

function applyKnockoutAdvancement(calendar) {
  const updated = structuredClone(calendar);
  const matches = updated.matches || [];
  const byId = new Map(matches.map((match) => [String(match.id || "").toUpperCase(), match]));
  let changedCount = 0;

  for (let pass = 0; pass < 8; pass += 1) {
    let passChanged = false;

    for (const match of matches) {
      const homeResolved = resolveAdvancementToken(match.home, byId);
      const awayResolved = resolveAdvancementToken(match.away, byId);

      if (homeResolved && match.home !== homeResolved) {
        match.home = homeResolved;
        passChanged = true;
        changedCount += 1;
      }

      if (awayResolved && match.away !== awayResolved) {
        match.away = awayResolved;
        passChanged = true;
        changedCount += 1;
      }

      if (match.status === "complete" && !match.group && !match.winner) {
        const inferred = inferWinnerFromValues(match.home, match.away, match.score, match.status);
        if (inferred) {
          match.winner = inferred;
          passChanged = true;
          changedCount += 1;
        }
      }
    }

    if (!passChanged) break;
  }

  if (changedCount) console.log(`Cruces de eliminatoria resueltos automaticamente: ${changedCount}`);
  updated.matches = matches;
  return updated;
}

function resolveAdvancementToken(value, byId) {
  const token = String(value || "").trim();
  const matchToken = token.match(/^(Ganador|Perdedor)\s+(M\d{3})$/i);
  if (!matchToken) return null;

  const source = byId.get(matchToken[2].toUpperCase());
  if (!source || source.status !== "complete") return null;

  const result = getWinnerLoser(source);
  if (!result) return null;
  return matchToken[1].toLowerCase() === "ganador" ? result.winner : result.loser;
}

function getWinnerLoser(match) {
  if (!match || match.status !== "complete") return null;

  if (match.winner) {
    const winnerName = normalizeName(match.winner);
    if (normalizeName(match.home) === winnerName) return { winner: match.home, loser: match.away };
    if (normalizeName(match.away) === winnerName) return { winner: match.away, loser: match.home };
  }

  const score = parseScoreText(match.score);
  if (!score) return null;

  let homeWins = score.home > score.away;
  if (score.home === score.away) {
    if (score.pensHome === null || score.pensAway === null) return null;
    homeWins = score.pensHome > score.pensAway;
  }

  return homeWins
    ? { winner: match.home, loser: match.away }
    : { winner: match.away, loser: match.home };
}

function inferWinnerFromValues(home, away, scoreText, status) {
  if (status && status !== "complete") return "";
  const score = parseScoreText(scoreText);
  if (!score) return "";

  if (score.home > score.away) return home;
  if (score.away > score.home) return away;
  if (score.pensHome !== null && score.pensAway !== null) {
    return score.pensHome > score.pensAway ? home : away;
  }
  return "";
}

function parseScoreText(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d+)\s*-\s*(\d+)(?:\s*\((\d+)\s*-\s*(\d+)\))?$/);
  if (!match) return null;
  return {
    home: Number(match[1]),
    away: Number(match[2]),
    pensHome: match[3] !== undefined ? Number(match[3]) : null,
    pensAway: match[4] !== undefined ? Number(match[4]) : null
  };
}

function isKnockoutMatch(match) {
  return !match.group;
}

function hasResolvedWinner(match) {
  if (!match) return false;
  if (match.winner) return true;
  const score = parseScoreText(match.score);
  if (!score) return false;
  if (score.home !== score.away) return true;
  return score.pensHome !== null && score.pensAway !== null;
}

function isIncompleteKnockoutTie(match) {
  if (!isKnockoutMatch(match)) return false;

  const score = parseScoreText(match.score);
  if (!score) return false;

  const isTie = score.home === score.away;
  const hasPenalties = score.pensHome !== null && score.pensAway !== null;
  const hasWinner = Boolean(match.winner);

  return isTie && !hasPenalties && !hasWinner;
}

function protectKnockoutRemoteResult(remote, existing) {
  const remoteInLocalSlot = { ...remote, group: existing.group };

  if (!isIncompleteKnockoutTie(remoteInLocalSlot)) {
    return remote;
  }

  console.log(
    `Resultado incompleto de eliminatoria protegido: ${existing.id || remote.id} ${remote.home} ${remote.score} ${remote.away}. Falta winner o penales.`
  );

  return {
    ...remote,
    status: remote.status === "complete" ? "live" : remote.status,
    winner: ""
  };
}

function makeGroupPairKey(match) {
  const teams = [normalizeName(match.home || ""), normalizeName(match.away || "")].sort().join("|");
  return `${match.group || ""}|${teams}`;
}

function makeTeamDateKey(match) {
  return `${match.date || ""}|${normalizeName(match.home || "")}|${normalizeName(match.away || "")}`;
}

function normalizeExternalId(value) {
  const raw = String(value || "").trim();
  const number = raw.match(/\d+/)?.[0] || "";
  return number ? String(Number(number)) : raw.toLowerCase();
}

function matchWeight(match) {
  let weight = 0;
  if (match.status === "complete") weight += 100;
  if (match.status === "live") weight += 50;
  if (match.score) weight += 30;
  if (match.winner) weight += 25;
  if (!String(match.id || "").startsWith("PUBLIC-")) weight += 5;
  return weight;
}

function remoteQuality(match) {
  let weight = matchWeight(match);
  if (match.sourcePriority !== undefined) weight += Math.max(0, 10 - Number(match.sourcePriority));
  return weight;
}

function dedupeCurrentMatches(matches) {
  const groupBest = new Map();
  const clean = [];

  for (const match of matches) {
    const sanitized = { ...match };
    delete sanitized.sourcePriority;

    if (!sanitized.group) {
      if (!String(sanitized.id || "").startsWith("PUBLIC-")) clean.push(sanitized);
      continue;
    }

    const key = makeGroupPairKey(sanitized);
    const current = groupBest.get(key);
    if (!current || matchWeight(sanitized) > matchWeight(current) || (matchWeight(sanitized) === matchWeight(current) && String(sanitized.date) < String(current.date))) {
      groupBest.set(key, sanitized);
    }
  }

  return [...groupBest.values(), ...clean];
}

function sortMatches(a, b) {
  return String(a.date || "").localeCompare(String(b.date || "")) ||
    String(a.timeET || "").localeCompare(String(b.timeET || "")) ||
    String(a.id || "").localeCompare(String(b.id || ""));
}

function isPlaceholderTeam(value) {
  return /^(Ganador|Perdedor)\s+M\d{3}$/i.test(String(value || "").trim()) ||
    /^(1|2)[A-L]$/i.test(String(value || "").trim()) ||
    /^3rd\s+[A-L](?:\/[A-L])*$/i.test(String(value || "").trim());
}

function comparableCalendar(calendar) {
  const copy = structuredClone(calendar);
  if (copy.competition) {
    delete copy.competition.lastUpdated;
  }
  for (const match of copy.matches || []) {
    delete match.resultProtectionUpdatedAt;
    delete match.sourcePriority;
  }
  return JSON.stringify(copy);
}

const TEAM_ALIASES = new Map(Object.entries({
  "mexico": "mexico",
  "southafrica": "sudafrica",
  "sudafrica": "sudafrica",
  "southkorea": "coreadelsur",
  "korearepublic": "coreadelsur",
  "coreadelsur": "coreadelsur",
  "czechia": "chequia",
  "czechrepublic": "chequia",
  "chequia": "chequia",
  "canada": "canada",
  "bosniaandherzegovina": "bosniayherzegovina",
  "bosniayherzegovina": "bosniayherzegovina",
  "qatar": "qatar",
  "switzerland": "suiza",
  "suiza": "suiza",
  "brazil": "brasil",
  "brasil": "brasil",
  "morocco": "marruecos",
  "marruecos": "marruecos",
  "haiti": "haiti",
  "scotland": "escocia",
  "escocia": "escocia",
  "unitedstates": "estadosunidos",
  "unitedstatesofamerica": "estadosunidos",
  "usa": "estadosunidos",
  "us": "estadosunidos",
  "estadosunidos": "estadosunidos",
  "paraguay": "paraguay",
  "australia": "australia",
  "turkey": "turquia",
  "turkiye": "turquia",
  "turquia": "turquia",
  "germany": "alemania",
  "alemania": "alemania",
  "curacao": "curazao",
  "curazao": "curazao",
  "ivorycoast": "costademarfil",
  "cotedivoire": "costademarfil",
  "cotedivoire": "costademarfil",
  "costademarfil": "costademarfil",
  "ecuador": "ecuador",
  "netherlands": "paisesbajos",
  "paisesbajos": "paisesbajos",
  "japan": "japon",
  "japon": "japon",
  "sweden": "suecia",
  "suecia": "suecia",
  "tunisia": "tunez",
  "tunez": "tunez",
  "spain": "espana",
  "espana": "espana",
  "capeverde": "caboverde",
  "caboverde": "caboverde",
  "saudiarabia": "arabiasaudita",
  "arabiasaudita": "arabiasaudita",
  "uruguay": "uruguay",
  "belgium": "belgica",
  "belgica": "belgica",
  "egypt": "egipto",
  "egipto": "egipto",
  "iran": "iran",
  "newzealand": "nuevazelanda",
  "nuevazelanda": "nuevazelanda",
  "france": "francia",
  "francia": "francia",
  "senegal": "senegal",
  "iraq": "irak",
  "irak": "irak",
  "norway": "noruega",
  "noruega": "noruega",
  "argentina": "argentina",
  "algeria": "argelia",
  "argelia": "argelia",
  "austria": "austria",
  "jordan": "jordania",
  "jordania": "jordania",
  "portugal": "portugal",
  "drcongo": "rdcongo",
  "congodr": "rdcongo",
  "congodemocraticrepublic": "rdcongo",
  "rdcongo": "rdcongo",
  "uzbekistan": "uzbekistan",
  "colombia": "colombia",
  "england": "inglaterra",
  "inglaterra": "inglaterra",
  "croatia": "croacia",
  "croacia": "croacia",
  "ghana": "ghana",
  "panama": "panama"
}));

function normalizeName(value) {
  const raw = String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");

  return TEAM_ALIASES.get(raw) || raw;
}

function translateTeamName(value) {
  const normalized = normalizeName(value);
  const display = {
    sudafrica: "Sudáfrica",
    coreadelsur: "Corea del Sur",
    chequia: "Chequia",
    bosniayherzegovina: "Bosnia y Herzegovina",
    suiza: "Suiza",
    brasil: "Brasil",
    marruecos: "Marruecos",
    escocia: "Escocia",
    estadosunidos: "Estados Unidos",
    turquia: "Turquía",
    alemania: "Alemania",
    curazao: "Curazao",
    costademarfil: "Costa de Marfil",
    paisesbajos: "Países Bajos",
    japon: "Japón",
    suecia: "Suecia",
    tunez: "Túnez",
    espana: "España",
    caboverde: "Cabo Verde",
    arabiasaudita: "Arabia Saudita",
    belgica: "Bélgica",
    egipto: "Egipto",
    nuevazelanda: "Nueva Zelanda",
    francia: "Francia",
    irak: "Irak",
    noruega: "Noruega",
    argelia: "Argelia",
    jordania: "Jordania",
    rdcongo: "RD Congo",
    inglaterra: "Inglaterra",
    croacia: "Croacia",
    panama: "Panamá"
  };

  return display[normalized] || value;
}

module.exports = {
  alignRemoteOrientation,
  reverseScoreText,
  parseScoreText,
  normalizeCalendar
};
