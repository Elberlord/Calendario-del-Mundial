let calendarData = null;
let matches = [];

const YOUTUBE_SUBSCRIBE_URL = "https://www.youtube.com/@Elberlord?sub_confirmation=1";
const WATCH_ONLINE_URL = "https://viprow.im/sports/football/";

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

async function loadCalendar() {
  const response = await fetch("worldcup_calendar_2026.json", { cache: "no-store" });
  if (!response.ok) throw new Error("No pude cargar worldcup_calendar_2026.json");
  calendarData = await response.json();
  matches = normalizeMatches(calendarData.matches || []);
  setupFilters();
  render();
}

function setupFilters() {
  const stageFilter = $("#stageFilter");
  const groupFilter = $("#groupFilter");
  const standingsGroupFilter = $("#standingsGroupFilter");

  const stages = [...new Set(matches.map(m => m.stage))];
  stageFilter.innerHTML = `<option value="all">Todas las rondas</option>` + stages.map(s => `<option value="${s}">${s}</option>`).join("");

  const groups = [...new Set(matches.map(m => m.group).filter(Boolean))].sort();
  const groupOptions = `<option value="all">Todos los grupos</option>` + groups.map(g => `<option value="${g}">${g}</option>`).join("");
  groupFilter.innerHTML = groupOptions;
  standingsGroupFilter.innerHTML = groupOptions;

  $("#matchCount").textContent = matches.length;
}

function parseScore(score) {
  const text = String(score || "").trim();
  const match = text.match(/^(\d+)\s*(?:\(\d+\))?\s*-\s*(\d+)\s*(?:\(\d+\))?/);
  if (!match) return null;
  const home = Number(match[1]);
  const away = Number(match[2]);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  return { home, away };
}

function normalizeMatchStatus(match) {
  if (!match) return "scheduled";
  if (match.status === "complete" || match.status === "live") return match.status;
  if (match.score || match.winner || hasPenaltyScore(match)) return "complete";
  return match.status || "scheduled";
}

function hasPenaltyScore(match) {
  return !!getPenaltyScore(match);
}

function getPenaltyScore(match) {
  const directHome = match?.penaltyHome ?? match?.penaltiesHome ?? match?.homePenalties ?? match?.penalty_score_home;
  const directAway = match?.penaltyAway ?? match?.penaltiesAway ?? match?.awayPenalties ?? match?.penalty_score_away;
  if (isFiniteScore(directHome) && isFiniteScore(directAway)) {
    return { home: Number(directHome), away: Number(directAway) };
  }

  const text = String(match?.score || "");
  let parsed = text.match(/\((\d+)\s*-\s*(\d+)\)/);
  if (parsed) return { home: Number(parsed[1]), away: Number(parsed[2]) };

  parsed = text.match(/\d+\s*\((\d+)\)\s*-\s*\d+\s*\((\d+)\)/);
  if (parsed) return { home: Number(parsed[1]), away: Number(parsed[2]) };

  return null;
}

function isFiniteScore(value) {
  return value !== undefined && value !== null && value !== "" && Number.isFinite(Number(value));
}

function getWinnerSideFromMatch(match) {
  const winner = normalizeTeamKey(match?.winner || match?.winnerTeam || match?.advancedTeam || "");
  if (!winner) return null;
  if (winner === normalizeTeamKey(match.home)) return "home";
  if (winner === normalizeTeamKey(match.away)) return "away";
  return null;
}


function normalizeTeamName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/3rd/g, "3")
    .trim();
}



function normalizeTeamKey(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const TEAM_FLAGS = {
  "alemania": "de",
  "arabia saudita": "sa",
  "argelia": "dz",
  "argentina": "ar",
  "australia": "au",
  "austria": "at",
  "belgica": "be",
  "bosnia y herzegovina": "ba",
  "brasil": "br",
  "cabo verde": "cv",
  "canada": "ca",
  "chequia": "cz",
  "colombia": "co",
  "corea del sur": "kr",
  "costa de marfil": "ci",
  "croacia": "hr",
  "curazao": "cw",
  "ecuador": "ec",
  "egipto": "eg",
  "escocia": "gb-sct",
  "espana": "es",
  "estados unidos": "us",
  "francia": "fr",
  "ghana": "gh",
  "haiti": "ht",
  "inglaterra": "gb-eng",
  "irak": "iq",
  "iran": "ir",
  "japon": "jp",
  "jordania": "jo",
  "marruecos": "ma",
  "mexico": "mx",
  "noruega": "no",
  "nueva zelanda": "nz",
  "paises bajos": "nl",
  "panama": "pa",
  "paraguay": "py",
  "portugal": "pt",
  "qatar": "qa",
  "rd congo": "cd",
  "senegal": "sn",
  "sudafrica": "za",
  "suecia": "se",
  "suiza": "ch",
  "tunez": "tn",
  "turquia": "tr",
  "uruguay": "uy",
  "uzbekistan": "uz"
};

function getTeamFlag(teamName) {
  const code = TEAM_FLAGS[normalizeTeamKey(teamName)];
  if (!code) return null;
  return {
    code,
    src: `https://flagcdn.com/w40/${code}.png`,
    srcset: `https://flagcdn.com/w80/${code}.png 2x`,
    alt: `Bandera de ${teamName}`
  };
}

function normalizeMatches(rawMatches) {
  const groupBest = new Map();
  const knockoutMatches = [];

  rawMatches.forEach(match => {
    const normalizedMatch = { ...match, status: normalizeMatchStatus(match) };

    if (!normalizedMatch.group) {
      if (!String(normalizedMatch.id || "").startsWith("PUBLIC-")) knockoutMatches.push(normalizedMatch);
      return;
    }

    const teams = [normalizeTeamName(normalizedMatch.home), normalizeTeamName(normalizedMatch.away)].sort().join(" vs ");
    const key = `${normalizedMatch.group}::${teams}`;
    const current = groupBest.get(key);
    if (!current || matchWeight(normalizedMatch) > matchWeight(current) || (matchWeight(normalizedMatch) === matchWeight(current) && String(normalizedMatch.date) < String(current.date))) {
      groupBest.set(key, normalizedMatch);
    }
  });

  return [...groupBest.values(), ...knockoutMatches].sort((a, b) =>
    String(a.date || "").localeCompare(String(b.date || "")) ||
    String(a.timeET || "").localeCompare(String(b.timeET || "")) ||
    String(a.id || "").localeCompare(String(b.id || ""))
  );
}

function matchWeight(match) {
  let weight = 0;
  if (match.status === "complete") weight += 100;
  if (match.score) weight += 30;
  if (String(match.id || "").startsWith("PUBLIC-")) weight += 10;
  return weight;
}

function groupIsClosed(rows) {
  return rows.length === 4 && rows.every(row => row.played >= 3);
}

function rowStatusLabel(index, closed) {
  if (closed && index < 2) return "Clasificado";
  if (closed && index === 2) return "3.º en espera";
  if (closed) return "Eliminado";
  if (index < 2) return "Zona directa";
  if (index === 2) return "3.º en pelea";
  return "Pendiente";
}

function rowStatusClass(index, closed) {
  if (closed && index < 2) return "qualified";
  if (closed && index === 2) return "third";
  if (closed) return "out";
  if (index < 2) return "zone";
  if (index === 2) return "third";
  return "pending";
}

function calculateStandings() {
  const table = {};

  matches.filter(m => m.group).forEach(match => {
    table[match.group] ||= {};
    [match.home, match.away].forEach(team => {
      table[match.group][team] ||= {
        team, group: match.group, played: 0, wins: 0, draws: 0, losses: 0,
        gf: 0, ga: 0, gd: 0, points: 0
      };
    });

    if (match.status !== "complete") return;
    const score = parseScore(match.score);
    if (!score) return;

    const home = table[match.group][match.home];
    const away = table[match.group][match.away];

    home.played += 1;
    away.played += 1;

    home.gf += score.home;
    home.ga += score.away;
    away.gf += score.away;
    away.ga += score.home;

    if (score.home > score.away) {
      home.wins += 1; home.points += 3;
      away.losses += 1;
    } else if (score.home < score.away) {
      away.wins += 1; away.points += 3;
      home.losses += 1;
    } else {
      home.draws += 1; away.draws += 1;
      home.points += 1; away.points += 1;
    }

    home.gd = home.gf - home.ga;
    away.gd = away.gf - away.ga;
  });

  Object.keys(table).forEach(group => {
    table[group] = Object.values(table[group]).sort((a, b) =>
      b.points - a.points ||
      b.gd - a.gd ||
      b.gf - a.gf ||
      a.team.localeCompare(b.team)
    );
  });

  return table;
}


function getGroupLetter(group) {
  const match = String(group || "").match(/([A-L])$/i);
  return match ? match[1].toUpperCase() : "";
}

function isPlaceholderTeam(value) {
  const text = String(value || "").trim();
  return /^(1|2)[A-L]$/i.test(text)
    || /^3rd\s+[A-L](?:\/[A-L])*$/i.test(text)
    || /^(Ganador|Perdedor)\s+M\d{3}$/i.test(text);
}

function thirdPlaceRank(rows) {
  return (rows || [])
    .filter(row => row.played > 0)
    .map(row => ({ ...row, groupLetter: getGroupLetter(row.group), closed: groupIsClosed(rows) }))
    .sort((a, b) =>
      b.points - a.points ||
      b.gd - a.gd ||
      b.gf - a.gf ||
      a.team.localeCompare(b.team)
    );
}

function buildBracketState() {
  const standings = calculateStandings();
  const direct = {};
  const thirds = [];

  Object.entries(standings).forEach(([group, rows]) => {
    const letter = getGroupLetter(group);
    if (!letter || rows.length < 3) return;

    const closed = groupIsClosed(rows);
    direct[`1${letter}`] = rows[0] ? { team: rows[0].team, closed } : null;
    direct[`2${letter}`] = rows[1] ? { team: rows[1].team, closed } : null;
    thirds.push({ ...rows[2], groupLetter: letter, closed });
  });

  const bestThirds = thirds
    .filter(row => row.played > 0)
    .sort((a, b) =>
      b.points - a.points ||
      b.gd - a.gd ||
      b.gf - a.gf ||
      a.team.localeCompare(b.team)
    )
    .slice(0, 8);

  const usedThirdGroups = new Set();
  const thirdSlotAssignments = new Map();
  getRoundOf32Matches()
    .flatMap(match => [match.home, match.away])
    .filter(token => /^3rd\s+[A-L](?:\/[A-L])*$/i.test(String(token || "")))
    .forEach(token => {
      const allowedGroups = String(token).replace(/^3rd\s+/i, "").split("/").map(group => group.trim().toUpperCase());
      const candidate = bestThirds.find(row => allowedGroups.includes(row.groupLetter) && !usedThirdGroups.has(row.groupLetter));
      if (!candidate) return;
      usedThirdGroups.add(candidate.groupLetter);
      thirdSlotAssignments.set(token, candidate);
    });

  return { standings, direct, thirds, bestThirds, thirdSlotAssignments };
}

function getRoundOf32Matches() {
  return matches
    .filter(match => !match.group && (match.stage === "Round of 32" || match.round === "R32"))
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")) || String(a.timeET || "").localeCompare(String(b.timeET || "")) || String(a.id || "").localeCompare(String(b.id || "")));
}

function resolveSlot(value, bracketState = buildBracketState()) {
  const token = String(value || "").trim();

  if (/^(1|2)[A-L]$/i.test(token)) {
    const data = bracketState.direct[token.toUpperCase()];
    if (!data?.team) return { label: token, note: "Pendiente", resolved: false, provisional: true };
    return {
      label: data.team,
      note: data.closed ? token.toUpperCase() : `${token.toUpperCase()} provisional`,
      resolved: data.closed,
      provisional: !data.closed
    };
  }

  if (/^3rd\s+[A-L](?:\/[A-L])*$/i.test(token)) {
    const data = bracketState.thirdSlotAssignments.get(token);
    if (!data?.team) return { label: token, note: "Mejores terceros", resolved: false, provisional: true };
    return {
      label: data.team,
      note: data.closed ? `3${data.groupLetter}` : `3${data.groupLetter} provisional`,
      resolved: data.closed,
      provisional: !data.closed
    };
  }

  const sourceMatch = token.match(/^(Ganador|Perdedor)\s+(M\d{3})$/i);
  if (sourceMatch) {
    const wantWinner = sourceMatch[1].toLowerCase() === "ganador";
    const match = matches.find(item => String(item.id).toUpperCase() === sourceMatch[2].toUpperCase());
    const advanced = match ? getAdvancedTeam(match, wantWinner, bracketState) : null;
    if (!advanced) return { label: token, note: match ? summarizeMatchTeams(match, bracketState) : "Pendiente", resolved: false, provisional: true };
    return { label: advanced.label, note: token, resolved: true, provisional: false };
  }

  return { label: token, note: "", resolved: true, provisional: false };
}

function summarizeMatchTeams(match, bracketState) {
  const home = resolveSlot(match.home, bracketState).label;
  const away = resolveSlot(match.away, bracketState).label;
  if (!home || !away) return "Pendiente";
  return `${home} vs ${away}`;
}

function getAdvancedTeam(match, wantWinner, bracketState) {
  if (normalizeMatchStatus(match) !== "complete") return null;
  const explicitWinner = getWinnerSideFromMatch(match);
  const score = parseScore(match.score);
  if (!score && !explicitWinner) return null;

  let homeWins = explicitWinner === "home";
  if (!explicitWinner && score.home !== score.away) {
    homeWins = score.home > score.away;
  } else if (!explicitWinner && score.home === score.away) {
    const pens = getPenaltyScore(match);
    if (!pens) return null;
    homeWins = pens.home > pens.away;
  }

  const winnerValue = homeWins ? match.home : match.away;
  const loserValue = homeWins ? match.away : match.home;
  return resolveSlot(wantWinner ? winnerValue : loserValue, bracketState);
}

function displayMatchTeam(value, bracketState) {
  const resolved = resolveSlot(value, bracketState);
  if (!isPlaceholderTeam(value)) return `<strong>${resolved.label}</strong>`;
  return `
    <strong class="resolved-team ${resolved.resolved ? "resolved" : "provisional"}">${resolved.label}</strong>
    <span class="slot-note">${resolved.note}</span>
  `;
}

function renderThirdPlaceBoard(bracketState = buildBracketState()) {
  const target = document.getElementById("thirdPlaceList");
  if (!target) return;

  const rows = bracketState.bestThirds;
  target.innerHTML = `
    <div class="third-board-head">
      <strong>Mejores terceros</strong>
      <span>Se usan para llenar automáticamente los cruces de 16avos cuando encajan con cada casilla.</span>
    </div>
    <div class="third-board-grid">
      ${rows.length ? rows.map((row, index) => `
        <span class="third-pill ${row.closed ? "closed" : "provisional"}">
          ${index + 1}. ${row.team} <em>3${row.groupLetter}${row.closed ? "" : " prov."} · ${row.points} pts · DG ${row.gd}</em>
        </span>
      `).join("") : `<span class="third-pill provisional">Aún no hay terceros con partidos cargados.</span>`}
    </div>
  `;
}

function getMatchById(matchId) {
  return matches.find(match => String(match.id).toUpperCase() === String(matchId).toUpperCase()) || null;
}

function getMatchWinnerSide(match) {
  if (!match || normalizeMatchStatus(match) !== "complete") return null;
  const explicitWinner = getWinnerSideFromMatch(match);
  if (explicitWinner) return explicitWinner;

  const score = parseScore(match.score);
  if (!score) return null;
  if (score.home > score.away) return "home";
  if (score.away > score.home) return "away";

  const pens = getPenaltyScore(match);
  if (!pens) return null;
  return pens.home > pens.away ? "home" : "away";
}

function renderBracketTeamLine(match, teamValue, side, bracketState) {
  const resolved = resolveSlot(teamValue, bracketState);
  const winnerSide = getMatchWinnerSide(match);
  const classes = ["bracket-team"];
  if (winnerSide === side) classes.push("winner");
  if (isPlaceholderTeam(teamValue)) classes.push(resolved.resolved ? "resolved" : "provisional");

  const flag = getTeamFlag(resolved.label);
  const compactVisual = flag
    ? `
      <div class="bracket-flag-wrap" title="${resolved.label}" aria-label="${resolved.label}">
        <img class="bracket-team-flag" src="${flag.src}" srcset="${flag.srcset}" alt="${flag.alt}" loading="lazy" />
      </div>
      ${resolved.note ? `<span class="slot-note">${resolved.note}</span>` : ""}
    `
    : displayMatchTeam(teamValue, bracketState);

  return `
    <div class="${classes.join(" ")}">
      ${compactVisual}
    </div>
  `;
}

function renderBracketCard(matchId, bracketState, extraClass = "") {
  const match = getMatchById(matchId);
  if (!match) return `<article class="bracket-match-card missing"><div class="bracket-card-top"><strong>${matchId}</strong></div><div class="meta">Partido no encontrado.</div></article>`;

  const normalizedStatus = normalizeMatchStatus(match);
  const statusLabel = normalizedStatus === "complete" ? "Finalizado" : "Pendiente";
  return `
    <article class="bracket-match-card ${extraClass} ${normalizedStatus === "complete" ? "is-complete" : "is-pending"}" id="bracket-${match.id}">
      <div class="bracket-card-top">
        <div>
          <strong>${match.id}</strong>
          <span>${match.round}</span>
        </div>
        <span class="bracket-card-status ${normalizedStatus === "complete" ? "complete" : "scheduled"}">${statusLabel}</span>
      </div>
      <div class="bracket-teams">
        ${renderBracketTeamLine(match, match.home, "home", bracketState)}
        ${renderBracketTeamLine(match, match.away, "away", bracketState)}
      </div>
      <div class="bracket-scoreline">${match.score || "VS"}</div>
      <div class="bracket-card-meta">${match.timeET}<span>·</span>${match.venue}</div>
    </article>
  `;
}

function renderBracketColumn(title, ids, sideClass, bracketState) {
  return `
    <section class="bracket-stage-col ${sideClass}">
      <div class="bracket-stage-label">${title}</div>
      <div class="bracket-stage-track">
        ${ids.map(id => renderBracketCard(id, bracketState)).join("")}
      </div>
    </section>
  `;
}

function renderBracketTree(bracketState = buildBracketState()) {
  const target = document.getElementById("knockoutBracket");
  if (!target) return;

  const leftColumns = [
    { title: "32avos", ids: ["M073", "M075", "M074", "M077", "M083", "M084", "M081", "M082"] },
    { title: "16avos", ids: ["M089", "M090", "M093", "M094"] },
    { title: "Cuartos", ids: ["M097", "M098"] },
    { title: "Semifinal", ids: ["M101"] }
  ];

  const rightColumns = [
    { title: "Semifinal", ids: ["M102"] },
    { title: "Cuartos", ids: ["M099", "M100"] },
    { title: "16avos", ids: ["M091", "M092", "M095", "M096"] },
    { title: "32avos", ids: ["M076", "M078", "M079", "M080", "M086", "M088", "M085", "M087"] }
  ];

  target.innerHTML = `
    <div class="third-board-head bracket-intro">
      <strong>Árbol de eliminatorias</strong>
      <span>Ahora puedes ver cada lado de la llave y los posibles cruces futuros. Los equipos se van reemplazando automáticamente cuando ya están definidos.</span>
    </div>
    <div class="bracket-board">
      <div class="bracket-side left">
        <div class="bracket-side-tag">Lado izquierdo</div>
        ${leftColumns.map(col => renderBracketColumn(col.title, col.ids, "left-side", bracketState)).join("")}
      </div>
      <div class="bracket-center">
        <div class="bracket-center-block">
          <div class="bracket-stage-label center">Final</div>
          ${renderBracketCard("M104", bracketState, "bracket-final-card")}
        </div>
        <div class="bracket-center-block minor">
          <div class="bracket-stage-label center">Tercer lugar</div>
          ${renderBracketCard("M103", bracketState, "bracket-third-card")}
        </div>
      </div>
      <div class="bracket-side right">
        <div class="bracket-side-tag">Lado derecho</div>
        ${rightColumns.map(col => renderBracketColumn(col.title, col.ids, "right-side", bracketState)).join("")}
      </div>
    </div>
  `;
}

function renderStandings() {
  const standings = calculateStandings();
  const q = $("#standingsSearchInput").value.trim().toLowerCase();
  const selectedGroup = $("#standingsGroupFilter").value;
  const container = $("#standingsList");

  const visibleGroups = Object.entries(standings).filter(([group, rows]) => {
    const text = `${group} ${rows.map(r => r.team).join(" ")}`.toLowerCase();
    return (selectedGroup === "all" || selectedGroup === group) && text.includes(q);
  });

  const completedGroupMatches = matches.filter(m => m.group && m.status === "complete").length;
  const closedGroups = visibleGroups.filter(([, rows]) => groupIsClosed(rows)).length;
  $("#standingsStatusLine").textContent = `Calculada con ${completedGroupMatches} partidos finalizados de fase de grupos. ${closedGroups} grupos cerrados. Top 2 aparecen como clasificados; terceros quedan en espera.`;

  container.innerHTML = visibleGroups.map(([group, rows]) => {
    const closed = groupIsClosed(rows);
    const groupNote = closed
      ? `Grupo cerrado · Clasificados: ${rows.slice(0, 2).map(r => r.team).join(" y ")}`
      : `En juego · ${rows.reduce((total, row) => total + row.played, 0) / 2}/6 partidos finalizados`;

    return `
      <section class="group-table ${closed ? "group-closed" : ""}">
        <div class="group-title-wrap">
          <h3 class="group-title">${group}</h3>
          <span class="group-note">${groupNote}</span>
        </div>
        <div class="standings-row header">
          <span>#</span><span>Equipo</span><span>PJ</span><span>G</span><span>E</span><span>P</span><span>GF</span><span>GC</span><span>DG</span><span>Pts</span>
        </div>
        ${rows.map((row, index) => `
          <div class="standings-row ${index < 2 ? "qualify" : index === 2 ? "third-watch" : ""}">
            <span class="rank">${index + 1}</span>
            <span class="team-cell">
              <strong class="team-name">${row.team}</strong>
              <em class="status-chip ${rowStatusClass(index, closed)}">${rowStatusLabel(index, closed)}</em>
            </span>
            <span>${row.played}</span>
            <span>${row.wins}</span>
            <span>${row.draws}</span>
            <span>${row.losses}</span>
            <span>${row.gf}</span>
            <span>${row.ga}</span>
            <span>${row.gd}</span>
            <span class="points">${row.points}</span>
          </div>
        `).join("")}
      </section>
    `;
  }).join("") || `<p class="meta">No hay grupos con ese filtro.</p>`;
}

function filteredMatches() {
  const q = $("#searchInput").value.trim().toLowerCase();
  const stage = $("#stageFilter").value;
  const group = $("#groupFilter").value;

  return matches.filter(m => {
    const text = `${m.id} ${m.stage} ${m.round} ${m.group} ${m.home} ${m.away} ${m.venue} ${m.date} ${m.timeET}`.toLowerCase();
    return (stage === "all" || m.stage === stage)
      && (group === "all" || m.group === group)
      && text.includes(q);
  });
}

function renderOverview() {
  const box = $("#stageOverview");
  box.innerHTML = (calendarData.stages || []).map(stage => `
    <article class="stage-card">
      <strong>${stage.name}</strong>
      <span>${stage.range}</span><br>
      <span>${stage.matches} partidos</span>
    </article>
  `).join("");
}

function renderCalendar() {
  renderOverview();
  const list = $("#calendarList");
  const data = filteredMatches();

  $("#calendarTitle").textContent = $("#stageFilter").value === "all" ? "Calendario completo" : $("#stageFilter").value;
  $("#statusLine").textContent = `${data.length} partidos visibles · Actualizado: ${calendarData.competition.lastUpdated}`;

  list.innerHTML = renderGroupedMatches(data) || `<p class="meta">No hay partidos con ese filtro.</p>`;
}

function renderKnockout() {
  const knockoutMatches = matches.filter(m => !m.group);
  const bracketState = buildBracketState();
  renderBracketTree(bracketState);
  renderThirdPlaceBoard(bracketState);
  $("#knockoutList").innerHTML = renderGroupedMatches(knockoutMatches, bracketState) || `<p class="meta">No hay eliminatorias cargadas.</p>`;
}


function whatsappMatchLink(match) {
  const phone = "50664305227";
  const message = "como puedo ver el partido";
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}


function watchButtonHtml(match) {
  if (normalizeMatchStatus(match) === "complete") {
    return `<button class="watch-btn watch-btn-disabled" type="button" disabled aria-disabled="true">Finalizado</button>`;
  }

  return `<button class="watch-btn" type="button">Ver</button>`;
}

function renderGroupedMatches(data, bracketState = buildBracketState()) {
  const grouped = data.reduce((acc, match) => {
    acc[match.date] ||= [];
    acc[match.date].push(match);
    return acc;
  }, {});

  return Object.entries(grouped).map(([date, dayMatches]) => `
    <section class="day" id="day-${date}">
      <h3>${formatDay(date)}</h3>
      ${dayMatches.map(match => `
        <article class="match" id="${match.id}">
          <span class="badge ${normalizeMatchStatus(match)}">${normalizeMatchStatus(match) === "complete" ? "Finalizado" : "Pendiente"}</span>
          <div>
            <strong>${match.stage}</strong>
            <div class="meta">${match.round}${match.group ? " · " + match.group : ""}</div>
          </div>
          <div class="team-slot">${displayMatchTeam(match.home, bracketState)}</div>
          <div class="teamscore">${match.score || "VS"}</div>
          <div class="team-slot">${displayMatchTeam(match.away, bracketState)}</div>
          <div class="meta">${match.timeET}<br>${match.venue}</div>
          ${watchButtonHtml(match)}
        </article>
      `).join("")}
    </section>
  `).join("");
}

function render() {
  renderStandings();
  renderCalendar();
  renderKnockout();
}

function formatDay(value) {
  return new Intl.DateTimeFormat("es", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(new Date(value + "T12:00:00"));
}

function goToNextMatch() {
  const now = new Date("2026-06-18T00:00:00");
  const next = matches.find(m => m.status !== "complete" && new Date(m.date + "T12:00:00") >= now);
  if (next) {
    document.querySelector(`[data-tab="calendar"]`).click();
    setTimeout(() => document.getElementById(next.id)?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
  }
}


function openWatchModal() {
  const modal = $("#watchModal");
  const subscribeBtn = $("#youtubeSubscribeBtn");
  const onlineBtn = $("#onlineWatchBtn");
  const hint = $("#unlockHint");

  subscribeBtn.href = YOUTUBE_SUBSCRIBE_URL;
  onlineBtn.href = WATCH_ONLINE_URL;
  onlineBtn.classList.add("hidden-link");
  hint.textContent = "Primero toca “Apoyar mi canal”.";

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeWatchModal() {
  const modal = $("#watchModal");
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

function unlockOnlineButton() {
  const onlineBtn = $("#onlineWatchBtn");
  const hint = $("#unlockHint");

  onlineBtn.classList.remove("hidden-link");
  hint.textContent = "Listo. Ya puedes tocar “Ver partido online”.";
}

document.addEventListener("click", (event) => {
  const watchButton = event.target.closest(".watch-btn");
  if (watchButton) {
    event.preventDefault();
    if (watchButton.disabled || watchButton.classList.contains("watch-btn-disabled")) return;
    openWatchModal();
    return;
  }

  if (event.target.id === "closeWatchModal" || event.target.id === "watchModal") {
    closeWatchModal();
    return;
  }

  if (event.target.id === "youtubeSubscribeBtn") {
    unlockOnlineButton();
  }
});

$$(".tab-btn").forEach(button => {
  button.addEventListener("click", () => {
    $$(".tab-btn").forEach(btn => btn.classList.remove("active"));
    $$(".tab-view").forEach(view => view.classList.remove("active-tab"));
    button.classList.add("active");
    $("#" + button.dataset.tab).classList.add("active-tab");
  });
});

$("#searchInput").addEventListener("input", renderCalendar);
$("#stageFilter").addEventListener("change", renderCalendar);
$("#groupFilter").addEventListener("change", renderCalendar);
$("#standingsSearchInput").addEventListener("input", renderStandings);
$("#standingsGroupFilter").addEventListener("change", renderStandings);
$("#resetStandingsFilterBtn").addEventListener("click", () => {
  $("#standingsSearchInput").value = "";
  $("#standingsGroupFilter").value = "all";
  renderStandings();
});
$("#refreshBtn").addEventListener("click", loadCalendar);
$("#todayBtn").addEventListener("click", goToNextMatch);

loadCalendar().catch(error => {
  $("#statusLine").textContent = error.message;
  $("#standingsStatusLine").textContent = error.message;
});
