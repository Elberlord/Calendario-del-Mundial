const { getLocalCalendar } = require("./localProvider");

const STAGE_MAP = {
  "Group Stage": "Fase de grupos",
  "Round of 32": "Round of 32",
  "Round of 16": "Octavos de final",
  "Quarter-finals": "Cuartos de final",
  "Semi-finals": "Semifinales",
  "3rd Place Final": "Tercer lugar",
  "Final": "Final"
};

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

function normalizeStatus(status) {
  const short = status?.short || "";
  if (["FT", "AET", "PEN"].includes(short)) return "complete";
  if (["1H", "2H", "HT", "ET", "BT", "P", "SUSP", "INT"].includes(short)) return "live";
  return "scheduled";
}

function normalizeFixture(fixture) {
  const rawRound = fixture.league?.round || "";
  const stage = Object.entries(STAGE_MAP).find(([key]) => rawRound.includes(key))?.[1] || rawRound || "Calendario";
  const isGroup = rawRound.toLowerCase().includes("group");
  const groupMatch = rawRound.match(/Group\s+([A-L])/i);
  const group = isGroup && groupMatch ? `Grupo ${groupMatch[1].toUpperCase()}` : "";

  const homeGoals = fixture.goals?.home;
  const awayGoals = fixture.goals?.away;
  const status = normalizeStatus(fixture.fixture?.status);

  return {
    id: String(fixture.fixture?.id || ""),
    externalId: String(fixture.fixture?.id || ""),
    stage,
    round: rawRound || stage,
    group,
    date: formatDate(fixture.fixture?.date),
    timeET: formatTimeET(fixture.fixture?.date),
    home: fixture.teams?.home?.name || "Local",
    away: fixture.teams?.away?.name || "Visitante",
    venue: fixture.fixture?.venue?.name || fixture.fixture?.venue?.city || "",
    status,
    score: homeGoals === null || awayGoals === null || homeGoals === undefined || awayGoals === undefined
      ? ""
      : `${homeGoals}-${awayGoals}`
  };
}

async function getApiFootballCalendar() {
  const key = process.env.API_FOOTBALL_KEY;
  const host = process.env.API_FOOTBALL_HOST || "v3.football.api-sports.io";
  const leagueId = process.env.API_FOOTBALL_LEAGUE_ID;
  const season = process.env.API_FOOTBALL_SEASON || "2026";

  if (!key || !leagueId) {
    throw new Error("Faltan API_FOOTBALL_KEY o API_FOOTBALL_LEAGUE_ID en .env.");
  }

  const url = new URL(`https://${host}/fixtures`);
  url.searchParams.set("league", leagueId);
  url.searchParams.set("season", season);

  const response = await fetch(url, {
    headers: {
      "x-apisports-key": key,
      "Accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`API-Football respondió ${response.status}`);
  }

  const payload = await response.json();
  const fixtures = payload.response || [];
  const local = await getLocalCalendar();

  return {
    competition: {
      ...local.competition,
      lastUpdated: new Date().toISOString(),
      provider: "api-football",
      providerLeagueId: leagueId,
      providerSeason: season
    },
    stages: local.stages,
    matches: fixtures.map(normalizeFixture).sort((a, b) => new Date(a.date) - new Date(b.date))
  };
}

module.exports = { getApiFootballCalendar };
