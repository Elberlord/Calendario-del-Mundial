async function getCustomCalendar() {
  const url = process.env.CUSTOM_CALENDAR_URL;
  if (!url) {
    throw new Error("CUSTOM_CALENDAR_URL no está configurado.");
  }

  const response = await fetch(url, {
    headers: { "Accept": "application/json" }
  });

  if (!response.ok) {
    throw new Error(`Custom provider respondió ${response.status}`);
  }

  const payload = await response.json();

  if (!payload.matches || !Array.isArray(payload.matches)) {
    throw new Error("El custom provider debe devolver { competition, stages, matches }.");
  }

  return payload;
}

module.exports = { getCustomCalendar };
