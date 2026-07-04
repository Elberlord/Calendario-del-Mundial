/**
 * Smart World Cup public updater for GitHub Pages.
 * No API key needed.
 */

const fs = require("fs/promises");

const CALENDAR_FILE = process.env.CALENDAR_FILE || "worldcup_calendar_2026.json";
const PUBLIC_CALENDAR_FILE = process.env.PUBLIC_CALENDAR_FILE || "public/worldcup_calendar_2026.json";
const PUBLIC_SOURCE_URLS = String(
  process.env.PUBLIC_SOURCE_URLS ||
  "https://worldcup26.ir/get/games,https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json"
 ).split(",").map((url) => url.trim()).filter(Boolean);

// Correcciones verificadas para casos donde una fuente publica se queda con un marcador viejo
// o incompleto. Esto evita que una actualizacion automatica vuelva a romper cruces ya confirmados.
const VERIFIED_RESULT_FIXES = [
  {
    id: "M082",
    home: "Bélgica",
    away: "Senegal",
    date: "2026-07-01",
    status: "complete",
    score: "3-2",
    winner: "Bélgica",
    reason: "Resultado verificado: Bélgica 3-2 Senegal. La fuente publica podia devolver 2-2 y bloquear Ganador M082."
  },
  {
    id: "M086",
    home: "Argentina",
    away: "Cabo Verde",
    date: "2026-07-03",
    status: "complete",
    score: "3-2",
    winner: "Argentina",
    reason: "Resultado verificado: Argentina 3-2 Cabo Verde. La fuente publica podia devolver un marcador incompleto y bloquear Ganador M086."
  },
  {
    id: "M088",
    home: "Australia",
    away: "Egipto",
    date: "2026-07-03",
    status: "complete",
    score: "1-1 (2-4)",
    winner: "Egipto",
    reason: "Resultado verificado: Australia 1-1 Egipto, Egipto gana 4-2 en penales. La fuente publica podia devolver solo 1-1 y bloquear Ganador M088."
  }
];

main().catch((error) => {
  console.error("Updater failed:", error);
  process.exit(1);
});

async function main() {
  const calendar = await readCalendar();

  console.log("Revision programada cada 2 horas: se consultan fuentes publicas aunque no haya partidos en curso.");

  const remoteMatches = await fetchBestAvailableSources();

  if (!remoteMatches.length) {
    console.log("Ninguna fuente publica devolvio partidos normalizados.");
    return;
  }

  const updated = applyVerifiedResultFixes(mergeMatches(calendar, remoteMatches));
  updated.competition = {
    ...(updated.competition || {}),
    lastUpdated: new Date().toISOString(),
    updateMode: "github-actions-public-no-key",
    publicSources: PUBLIC_SOURCE_URLS
  };

  const output = JSON.stringify(updated, null, 2) + "\n";
  await fs.writeFile(CALENDAR_FILE, output, "utf8");
  await fs.mkdir(require("path").dirname(PUBLIC_CALENDAR_FILE), { recursive: true });
  await fs.writeFile(PUBLIC_CALENDAR_FILE, output, "utf8");
  console.log(`Calendario actualizado desde fuente publica. Partidos recibidos: ${remoteMatches.length}`);
}

async function readCalendar() {
  const raw = await fs.readFile(CALENDAR_FILE, "utf8");
  return JSON.parse(raw);
}

async function fetchBestAvailableSources() {
  const candidates = [];

  for (const url of PUBLIC_SOURCE_URLS) {
    try {
      console.log(`Consultando fuente publica: ${url}`);
      const response = await fetch(url, { headers: { "Accept": "application/json" } });

      if (!response.ok) {
        console.log(`Fuente fallo con HTTP ${response.status}: ${url}`);
        continue;
      }

      const payload = await response.json();
      const matches = normalizePayload(payload, url);
      const stats = getSourceStats(matches);

      console.log(
        `Fuente revisada: ${url} · partidos: ${stats.total} · con marcador: ${stats.scored} · finalizados: ${stats.completed}`
      );

      if (matches.length) {
        candidates.push({ url, matches, stats });
      }
    } catch (error) {
      console.log(`Fuente fallo: ${url}`);
      console.log(error.message);
    }
  }

  if (!candidates.length) return [];

  candidates.sort((a, b) =>
    b.stats.scored - a.stats.scored ||
    b.stats.completed - a.stats.completed ||
    b.stats.total - a.stats.total
  );

  const best = candidates[0];
  console.log(
    `Mejor fuente seleccionada: ${best.url} · partidos: ${best.stats.total} · con marcador: ${best.stats.scored} · finalizados: ${best.stats.completed}`
  );

  return best.matches;
}

function getSourceStats(matches) {
  return {
    total: matches.length,
    scored: matches.filter(match => match.score).length,
    completed: matches.filter(match => match.status === "complete").length
  };
}

function normalizePayload(payload, sourceUrl) {
  let rawMatches = [];

  if (Array.isArray(payload)) rawMatches = payload;
  else if (Array.isArray(payload.matches)) rawMatches = payload.matches;
  else if (Array.isArray(payload.games)) rawMatches = payload.games;
  else if (Array.isArray(payload.data)) rawMatches = payload.data;
  else if (Array.isArray(payload.response)) rawMatches = payload.response;
  else if (payload.response && Array.isArray(payload.response.games)) rawMatches = payload.response.games;

  return rawMatches
    .map((match, index) => normalizeMatch(match, sourceUrl, index))
    .filter(Boolean);
}

function normalizeMatch(match, sourceUrl, index) {
  const home = pick(match, [
    "team1", "home", "homeTeam", "home_team", "homeTeamName", "teamA", "team_a",
    "local", "localTeam", "home_name"
  ]);

  const away = pick(match, [
    "team2", "away", "awayTeam", "away_team", "awayTeamName", "teamB", "team_b",
    "visitor", "visitorTeam", "away_name"
  ]);

  const date = normalizeDate(pick(match, ["date", "matchDate", "kickoffDate", "startDate"]));
  if (!home || !away || !date) return null;

  const score = extractScore(match);
  const status = extractStatus(match, score);
  const winner = extractWinner(match);
  const roundRaw = String(pick(match, ["round", "stage", "phase", "matchday", "roundName"]) || "");
  const groupRaw = String(pick(match, ["group", "groupName", "pool"]) || "");

  const normalized = {
    id: String(pick(match, ["id", "matchId", "gameId", "_id"]) || `PUBLIC-${index + 1}`),
    externalId: String(pick(match, ["id", "matchId", "gameId", "_id"]) || `PUBLIC-${index + 1}`),
    stage: inferStage(roundRaw, groupRaw),
    round: normalizeRound(roundRaw),
    group: normalizeGroup(groupRaw || roundRaw),
    date,
    timeET: normalizeTimeET(match),
    home: translateTeamName(home),
    away: translateTeamName(away),
    venue: pick(match, ["ground", "venue", "stadium", "city", "location"]) || "",
    status,
    score,
    source: sourceUrl
  };

  if (winner) normalized.winner = translateTeamName(winner);
  return normalized;
}

function pick(obj, keys) {
  for (const key of keys) {
    const value = obj?.[key];

    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);

    if (value && typeof value === "object") {
      if (value.name) return String(value.name).trim();
      if (value.en) return String(value.en).trim();
      if (value.title) return String(value.title).trim();
    }
  }
  return "";
}

function extractScore(match) {
  const penalties = extractPenaltyScore(match);

  if (Array.isArray(match?.score?.ft)) {
    return formatScoreWithPenalties(match.score.ft[0], match.score.ft[1], penalties);
  }

  if (Array.isArray(match?.score)) {
    return formatScoreWithPenalties(match.score[0], match.score[1], penalties);
  }

  const homeScore = firstDefined(
    match.homeScore, match.scoreHome, match.home_score, match.goalsHome, match.homeGoals,
    match?.score?.home, match?.goals?.home
  );
  const awayScore = firstDefined(
    match.awayScore, match.scoreAway, match.away_score, match.goalsAway, match.awayGoals,
    match?.score?.away, match?.goals?.away
  );

  if (isScoreValue(homeScore) && isScoreValue(awayScore)) {
    return formatScoreWithPenalties(homeScore, awayScore, penalties);
  }

  if (typeof match.result === "string") {
    const result = match.result.trim();

    if (/^\d+\s*-\s*\d+\s*\(\d+\s*-\s*\d+\)$/.test(result)) {
      return result.replace(/\s+/g, "");
    }

    if (/^\d+\s*-\s*\d+$/.test(result)) {
      const [home, away] = result.split("-").map(value => value.trim());
      return formatScoreWithPenalties(home, away, penalties);
    }
  }

  return "";
}

function formatScoreWithPenalties(homeScore, awayScore, penalties) {
  const base = `${homeScore}-${awayScore}`;
  if (!penalties) return base;

  const home = Number(homeScore);
  const away = Number(awayScore);

  // Solo se añaden penales cuando el marcador principal terminó empatado.
  if (home !== away) return base;

  return `${base} (${penalties.home}-${penalties.away})`;
}

function extractPenaltyScore(match) {
  const candidates = [
    match?.score?.pens,
    match?.score?.penalties,
    match?.score?.penalty,
    match?.score?.p,
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

function extractStatus(match, score) {
  const raw = String(pick(match, ["status", "state", "matchStatus", "gameStatus"]) || "").toLowerCase();

  if (raw.includes("live") || raw.includes("playing") || raw.includes("progress") || raw.includes("in play")) return "live";
  if (raw.includes("finished") || raw.includes("complete") || raw.includes("final") || raw === "ft" || raw.includes("aet") || raw.includes("pen")) return "complete";

  // Si el feed trae un marcador pero no confirma que terminó, lo tratamos como en curso.
  // Esto evita que un 1-1 provisional de eliminatoria quede como "Finalizado".
  if (score) return "live";

  return "scheduled";
}

function normalizeDate(value) {
  if (!value) return "";
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);

  return "";
}

function normalizeTimeET(match) {
  const time = pick(match, ["time", "kickoff", "kickoffTime", "startTime", "hour"]);
  if (!time) return "";
  if (/ET/i.test(time)) return time;

  const utcOffsetMatch = String(time).match(/(\d{1,2}):(\d{2})\s*UTC([+-]\d{1,2})/i);
  if (utcOffsetMatch && match.date) {
    const hour = Number(utcOffsetMatch[1]);
    const minute = Number(utcOffsetMatch[2]);
    const offset = Number(utcOffsetMatch[3]);
    const sign = offset >= 0 ? "+" : "-";
    const iso = `${match.date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00${sign}${String(Math.abs(offset)).padStart(2, "0")}:00`;
    return formatET(new Date(iso));
  }

  if (/^\d{1,2}:\d{2}$/.test(time)) return `${time}`;

  const parsed = new Date(time);
  if (!Number.isNaN(parsed.getTime())) return formatET(parsed);

  return String(time);
}

function formatET(date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(date) + " ET";
}

function normalizeRound(roundRaw) {
  const text = String(roundRaw || "").trim();
  if (!text) return "Calendario";
  if (/matchday/i.test(text)) return text.replace(/Matchday/i, "Jornada");
  return text;
}

function normalizeGroup(value) {
  const text = String(value || "");
  const match = text.match(/Group\s+([A-L])/i) || text.match(/Grupo\s+([A-L])/i);
  return match ? `Grupo ${match[1].toUpperCase()}` : "";
}

function inferStage(roundRaw, groupRaw) {
  const text = `${roundRaw} ${groupRaw}`.toLowerCase();

  if (text.includes("group") || text.includes("grupo") || text.includes("matchday") || text.includes("jornada")) return "Fase de grupos";
  if (text.includes("round of 32")) return "Round of 32";
  if (text.includes("round of 16") || text.includes("octavos")) return "Octavos de final";
  if (text.includes("quarter") || text.includes("cuartos")) return "Cuartos de final";
  if (text.includes("semi")) return "Semifinales";
  if (text.includes("3rd") || text.includes("third") || text.includes("tercer")) return "Tercer lugar";
  if (text.includes("final")) return "Final";

  return roundRaw || "Calendario";
}

function mergeMatches(calendar, remoteMatches) {
  const updated = structuredClone(calendar);
  const current = updated.matches || [];
  const byExternalId = new Map();
  const byTeamDate = new Map();
  const byGroupPair = new Map();

  for (let i = 0; i < current.length; i++) {
    const match = current[i];
    if (match.externalId) byExternalId.set(String(match.externalId), i);
    byTeamDate.set(makeTeamDateKey(match), i);
    byTeamDate.set(makeTeamDateKey({ ...match, home: match.away, away: match.home }), i);
    if (match.group) byGroupPair.set(makeGroupPairKey(match), i);
  }

  let changedCount = 0;

  for (const remote of remoteMatches) {
    let index = byTeamDate.get(makeTeamDateKey(remote));
    if (index === undefined && remote.group) index = byGroupPair.get(makeGroupPairKey(remote));

    if (index === undefined && remote.externalId) {
      const candidateIndex = byExternalId.get(String(remote.externalId));
      if (candidateIndex !== undefined) {
        const candidate = current[candidateIndex];
        if (makeTeamDateKey(candidate) === makeTeamDateKey(remote)) {
          index = candidateIndex;
        } else {
          console.log(`ExternalId ignorado por no coincidir equipos/fecha: ${remote.externalId} -> ${remote.home} vs ${remote.away} ${remote.date}`);
        }
      }
    }

    if (index === undefined) {
      // Los feeds publicos suelen traer eliminatorias o partidos cruzados de medianoche con otro ID/fecha.
      // Si no encontramos un partido real del calendario local, no lo agregamos para evitar duplicados fantasma.
      continue;
    }

    const existing = current[index];
    const safeRemote = protectKnockoutRemoteResult(remote, existing);
    const keepVerifiedKnockoutResult = isKnockoutMatch(existing) && hasResolvedWinner(existing) && safeRemote.score && !hasResolvedWinner(safeRemote);

    const merged = {
      ...existing,
      id: existing.id || safeRemote.id,
      externalId: existing.externalId || safeRemote.externalId,
      status: keepVerifiedKnockoutResult ? existing.status : (safeRemote.status || existing.status),
      score: keepVerifiedKnockoutResult ? existing.score : (safeRemote.score || existing.score),
      winner: keepVerifiedKnockoutResult ? existing.winner : (safeRemote.winner || existing.winner),
      source: safeRemote.source || existing.source,
      venue: existing.venue || safeRemote.venue,
      timeET: existing.timeET || safeRemote.timeET,
      round: existing.round || safeRemote.round,
      stage: existing.stage || safeRemote.stage,
      group: existing.group || safeRemote.group
    };

    if (JSON.stringify(existing) !== JSON.stringify(merged)) {
      changedCount += 1;
      current[index] = merged;
    }
  }

  updated.matches = dedupeCurrentMatches(current).sort((a, b) =>
    String(a.date || "").localeCompare(String(b.date || "")) ||
    String(a.timeET || "").localeCompare(String(b.timeET || "")) ||
    String(a.id || "").localeCompare(String(b.id || ""))
  );

  console.log(`Partidos modificados/agregados: ${changedCount}`);
  return updated;
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
      status: fix.status,
      score: fix.score,
      winner: fix.winner,
      resultProtection: fix.reason,
      resultProtectionUpdatedAt: new Date().toISOString()
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

function matchWeight(match) {
  let weight = 0;
  if (match.status === "complete") weight += 100;
  if (match.score) weight += 30;
  if (String(match.id || "").startsWith("PUBLIC-")) weight += 10;
  return weight;
}

function dedupeCurrentMatches(matches) {
  const groupBest = new Map();
  const clean = [];

  for (const match of matches) {
    if (!match.group) {
      if (!String(match.id || "").startsWith("PUBLIC-")) clean.push(match);
      continue;
    }

    const key = makeGroupPairKey(match);
    const current = groupBest.get(key);
    if (!current || matchWeight(match) > matchWeight(current) || (matchWeight(match) === matchWeight(current) && String(match.date) < String(current.date))) {
      groupBest.set(key, match);
    }
  }

  return [...groupBest.values(), ...clean];
}

function makeTeamDateKey(match) {
  return `${match.date || ""}|${normalizeName(match.home || "")}|${normalizeName(match.away || "")}`;
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
  "usa": "estadosunidos",
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
