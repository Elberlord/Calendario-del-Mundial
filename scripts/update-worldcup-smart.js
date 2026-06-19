/**
 * Smart World Cup updater for GitHub Pages.
 *
 * Runs every 5 minutes from GitHub Actions, but only calls the sports API
 * when a match is close to kickoff or likely in progress.
 *
 * Required repository secrets:
 * - API_FOOTBALL_KEY
 * - API_FOOTBALL_LEAGUE_ID
 *
 * Optional env:
 * - API_FOOTBALL_SEASON=2026
 * - API_FOOTBALL_HOST=v3.football.api-sports.io
 * - CALENDAR_FILE=worldcup_calendar_2026.json
 * - UPDATE_BEFORE_MINUTES=30
 * - UPDATE_AFTER_MINUTES=150
 */

const fs = require("fs/promises");

const CALENDAR_FILE = process.env.CALENDAR_FILE || "worldcup_calendar_2026.json";
const UPDATE_BEFORE_MINUTES = Number(process.env.UPDATE_BEFORE_MINUTES || 30);
const UPDATE_AFTER_MINUTES = Number(process.env.UPDATE_AFTER_MINUTES || 150);

const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;
const API_FOOTBALL_LEAGUE_ID = process.env.API_FOOTBALL_LEAGUE_ID;
const API_FOOTBALL_SEASON = process.env.API_FOOTBALL_SEASON || "2026";
const API_FOOTBALL_HOST = process.env.API_FOOTBALL_HOST || "v3.football.api-sports.io";

main().catch((error) => {
  console.error("Updater failed:", error);
  process.exit(1);
});

async function main() {
  const calendar = await readCalendar();

  if (!hasActiveUpdateWindow(calendar)) {
    console.log("No hay partido cerca o en curso. No se consume API.");
    return;
  }

  if (!API_FOOTBALL_KEY || !API_FOOTBALL_LEAGUE_ID) {
    console.log("Faltan secrets API_FOOTBALL_KEY o API_FOOTBALL_LEAGUE_ID. No se actualiza.");
    return;
  }

  console.log("Hay partido en ventana activa. Consultando API...");
  const fixtures = await fetchApiFootballFixtures();
  const normalized = fixtures.map(normalizeFixture).filter(Boolean);

  if (!normalized.length) {
    console.log("La API no devolvió fixtures normalizados.");
    return;
  }

  const updated = mergeMatches(calendar, normalized);
  updated.competition = {
    ...(updated.competition || {}),
    lastUpdated: new Date().toISOString(),
    updateMode: "github-actions-smart-5min"
  };

  await fs.writeFile(CALENDAR_FILE, JSON.stringify(updated, null, 2) + "\n", "utf8");
  console.log(`Calendario actualizado. Partidos API: ${normalized.length}`);
}

async function readCalendar() {
  const raw = await fs.readFile(CALENDAR_FILE, "utf8");
  return JSON.parse(raw);
}

function hasActiveUpdateWindow(calendar) {
  const now = new Date();
  const matches = calendar.matches || [];

  const activeMatches = matches.filter((match) => {
    if (match.status === "complete") return false;

    const kickoff = getKickoffDate(match);
    if (!kickoff) return false;

    const startWindow = new Date(kickoff.getTime() - UPDATE_BEFORE_MINUTES * 60 * 1000);
    const endWindow = new Date(kickoff.getTime() + UPDATE_AFTER_MINUTES * 60 * 1000);

    return now >= startWindow && now <= endWindow;
  });

  if (activeMatches.length) {
    console.log("Partidos en ventana activa:");
    for (const match of activeMatches) {
      console.log(`- ${match.id || ""} ${match.home} vs ${match.away} · ${match.date} ${match.timeET}`);
    }
  }

  return activeMatches.length > 0;
}

function getKickoffDate(match) {
  if (!match.date || !match.timeET) return null;

  // Expected examples:
  // date: "2026-06-18"
  // timeET: "9:00 PM ET"
  const timeMatch = String(match.timeET).match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!timeMatch) return null;

  let hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const meridiem = timeMatch[3].toUpperCase();

  if (meridiem === "PM" && hour !== 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;

  // ET during the World Cup dates is normally EDT (UTC-4).
  // This keeps GitHub Actions timing stable without extra libraries.
  const iso = `${match.date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-04:00`;
  const date = new Date(iso);

  return Number.isNaN(date.getTime()) ? null : date;
}

async function fetchApiFootballFixtures() {
  const url = new URL(`https://${API_FOOTBALL_HOST}/fixtures`);
  url.searchParams.set("league", API_FOOTBALL_LEAGUE_ID);
  url.searchParams.set("season", API_FOOTBALL_SEASON);

  const response = await fetch(url, {
    headers: {
      "x-apisports-key": API_FOOTBALL_KEY,
      "Accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`API-Football respondió ${response.status}`);
  }

  const payload = await response.json();

  if (payload.errors && Object.keys(payload.errors).length) {
    console.log("API errors:", JSON.stringify(payload.errors, null, 2));
  }

  return payload.response || [];
}

function normalizeFixture(fixture) {
  const fixtureId = fixture.fixture?.id;
  const dateValue = fixture.fixture?.date;
  const homeName = fixture.teams?.home?.name;
  const awayName = fixture.teams?.away?.name;

  if (!fixtureId || !dateValue || !homeName || !awayName) return null;

  const rawRound = fixture.league?.round || "";
  const group = extractGroup(rawRound);
  const stage = inferStage(rawRound);
  const status = normalizeStatus(fixture.fixture?.status);
  const homeGoals = fixture.goals?.home;
  const awayGoals = fixture.goals?.away;

  return {
    id: String(fixtureId),
    externalId: String(fixtureId),
    stage,
    round: rawRound || stage,
    group,
    date: formatDate(dateValue),
    timeET: formatTimeET(dateValue),
    home: homeName,
    away: awayName,
    venue: fixture.fixture?.venue?.name || fixture.fixture?.venue?.city || "",
    status,
    score: homeGoals === null || awayGoals === null || homeGoals === undefined || awayGoals === undefined
      ? ""
      : `${homeGoals}-${awayGoals}`
  };
}

function extractGroup(rawRound) {
  const match = String(rawRound).match(/Group\s+([A-L])/i);
  return match ? `Grupo ${match[1].toUpperCase()}` : "";
}

function inferStage(rawRound) {
  const text = String(rawRound).toLowerCase();

  if (text.includes("group")) return "Fase de grupos";
  if (text.includes("round of 32")) return "Round of 32";
  if (text.includes("round of 16")) return "Octavos de final";
  if (text.includes("quarter")) return "Cuartos de final";
  if (text.includes("semi")) return "Semifinales";
  if (text.includes("3rd") || text.includes("third")) return "Tercer lugar";
  if (text.includes("final")) return "Final";

  return rawRound || "Calendario";
}

function normalizeStatus(statusObj) {
  const short = statusObj?.short || "";

  if (["FT", "AET", "PEN"].includes(short)) return "complete";
  if (["1H", "2H", "HT", "ET", "BT", "P", "SUSP", "INT"].includes(short)) return "live";

  return "scheduled";
}

function formatDate(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function formatTimeET(value) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(new Date(value)) + " ET";
}

function mergeMatches(calendar, apiMatches) {
  const updated = structuredClone(calendar);
  const current = updated.matches || [];

  const byExternalId = new Map();
  const byTeamDate = new Map();

  for (let i = 0; i < current.length; i++) {
    const match = current[i];

    if (match.externalId) {
      byExternalId.set(String(match.externalId), i);
    }

    byTeamDate.set(makeTeamDateKey(match), i);
  }

  for (const apiMatch of apiMatches) {
    let index = apiMatch.externalId ? byExternalId.get(String(apiMatch.externalId)) : undefined;

    if (index === undefined) {
      index = byTeamDate.get(makeTeamDateKey(apiMatch));
    }

    if (index === undefined) {
      current.push(apiMatch);
      continue;
    }

    current[index] = {
      ...current[index],
      ...apiMatch,
      // Preserve internal ID if it already exists, because the frontend may expect M001 style IDs.
      id: current[index].id || apiMatch.id,
      externalId: apiMatch.externalId || current[index].externalId
    };
  }

  updated.matches = current.sort((a, b) => {
    const da = getKickoffDate(a) || new Date(`${a.date}T12:00:00Z`);
    const db = getKickoffDate(b) || new Date(`${b.date}T12:00:00Z`);
    return da - db;
  });

  return updated;
}

function makeTeamDateKey(match) {
  const date = match.date || "";
  const home = normalizeName(match.home || "");
  const away = normalizeName(match.away || "");

  return `${date}|${home}|${away}`;
}

function normalizeName(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
