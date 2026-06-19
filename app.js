let calendarData = null;
let matches = [];

const $ = (s) => document.querySelector(s);

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

  const stages = [...new Set(matches.map(m => m.stage))];
  stageFilter.innerHTML = `<option value="all">Todas las rondas</option>` + stages.map(s => `<option value="${s}">${s}</option>`).join("");

  const groups = [...new Set(matches.map(m => m.group).filter(Boolean))].sort();
  groupFilter.innerHTML = `<option value="all">Todos los grupos</option>` + groups.map(g => `<option value="${g}">${g}</option>`).join("");

  $("#matchCount").textContent = matches.length;
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

function render() {
  renderOverview();
  const list = $("#calendarList");
  const data = filteredMatches();

  $("#calendarTitle").textContent = $("#stageFilter").value === "all" ? "Calendario completo" : $("#stageFilter").value;
  $("#statusLine").textContent = `${data.length} partidos visibles · Actualizado: ${calendarData.competition.lastUpdated}`;

  const grouped = data.reduce((acc, match) => {
    acc[match.date] ||= [];
    acc[match.date].push(match);
    return acc;
  }, {});

  list.innerHTML = Object.entries(grouped).map(([date, dayMatches]) => `
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
        </article>
      `).join("")}
    </section>
  `).join("") || `<p class="meta">No hay partidos con ese filtro.</p>`;
}

function formatDay(value) {
  return new Intl.DateTimeFormat("es", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(new Date(value + "T12:00:00"));
}

function goToNextMatch() {
  const now = new Date("2026-06-18T00:00:00");
  const next = matches.find(m => m.status !== "complete" && new Date(m.date + "T12:00:00") >= now);
  if (next) document.getElementById(next.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
}

$("#searchInput").addEventListener("input", render);
$("#stageFilter").addEventListener("change", render);
$("#groupFilter").addEventListener("change", render);
$("#refreshBtn").addEventListener("click", loadCalendar);
$("#todayBtn").addEventListener("click", goToNextMatch);

loadCalendar().catch(error => {
  $("#statusLine").textContent = error.message;
});
