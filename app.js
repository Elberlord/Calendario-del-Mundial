let calendarData = null;
let matches = [];

const YOUTUBE_SUBSCRIBE_URL = "https://www.youtube.com/@Elberlord?sub_confirmation=1";
const WATCH_ONLINE_URL = "https://rojadirecta.cloud/index.php";

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

async function loadCalendar() {
  const response = await fetch("worldcup_calendar_2026.json", { cache: "no-store" });
  if (!response.ok) throw new Error("No pude cargar worldcup_calendar_2026.json");
  calendarData = await response.json();
  matches = calendarData.matches || [];
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
  if (!score || !score.includes("-")) return null;
  const [home, away] = score.split("-").map(Number);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  return { home, away };
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
  $("#standingsStatusLine").textContent = `Calculada con ${completedGroupMatches} partidos finalizados de fase de grupos. Top 2 clasifican directo; los mejores terceros compiten por cupos.`;

  container.innerHTML = visibleGroups.map(([group, rows]) => `
    <section class="group-table">
      <h3 class="group-title">${group}</h3>
      <div class="standings-row header">
        <span>#</span><span>Equipo</span><span>PJ</span><span>G</span><span>E</span><span>P</span><span>GF</span><span>GC</span><span>DG</span><span>Pts</span>
      </div>
      ${rows.map((row, index) => `
        <div class="standings-row ${index < 2 ? "qualify" : index === 2 ? "third-watch" : ""}">
          <span class="rank">${index + 1}</span>
          <span class="team-name">${row.team}</span>
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
  `).join("") || `<p class="meta">No hay grupos con ese filtro.</p>`;
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
  $("#knockoutList").innerHTML = renderGroupedMatches(knockoutMatches) || `<p class="meta">No hay eliminatorias cargadas.</p>`;
}


function whatsappMatchLink(match) {
  const phone = "50664305227";
  const message = "como puedo ver el partido";
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}


function watchButtonHtml(match) {
  if (match.status === "complete") {
    return `<button class="watch-btn watch-btn-disabled" type="button" disabled aria-disabled="true">Finalizado</button>`;
  }

  return `<button class="watch-btn" type="button">Ver</button>`;
}

function renderGroupedMatches(data) {
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
          <span class="badge ${match.status}">${match.status === "complete" ? "Finalizado" : "Pendiente"}</span>
          <div>
            <strong>${match.stage}</strong>
            <div class="meta">${match.round}${match.group ? " · " + match.group : ""}</div>
          </div>
          <strong>${match.home}</strong>
          <div class="teamscore">${match.score || "VS"}</div>
          <strong>${match.away}</strong>
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
