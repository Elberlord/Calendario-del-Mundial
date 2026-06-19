const path = require("path");
const fs = require("fs/promises");

async function getLocalCalendar() {
  const filePath = path.join(__dirname, "..", "..", "public", "worldcup_calendar_2026.json");
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

module.exports = { getLocalCalendar };
