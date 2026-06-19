require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs/promises");

const { getLocalCalendar } = require("./providers/localProvider");
const { getApiFootballCalendar } = require("./providers/apiFootballProvider");
const { getCustomCalendar } = require("./providers/customProvider");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || 300);

let cache = {
  calendar: null,
  provider: null,
  expiresAt: 0
};

app.use(cors());
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    provider: process.env.DATA_PROVIDER || "local",
    cacheActive: Boolean(cache.calendar && cache.expiresAt > Date.now()),
    cacheExpiresAt: cache.expiresAt ? new Date(cache.expiresAt).toISOString() : null
  });
});

app.get("/api/worldcup/calendar", async (req, res) => {
  try {
    const provider = process.env.DATA_PROVIDER || "local";

    if (cache.calendar && cache.provider === provider && cache.expiresAt > Date.now()) {
      return res.json({
        ...cache.calendar,
        source: `${provider}:cache`
      });
    }

    const calendar = await loadCalendarByProvider(provider);
    const normalized = {
      ...calendar,
      source: provider,
      competition: {
        ...calendar.competition,
        lastUpdated: new Date().toISOString()
      }
    };

    cache = {
      calendar: normalized,
      provider,
      expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000
    };

    res.json(normalized);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "CALENDAR_SYNC_FAILED",
      message: error.message
    });
  }
});

async function loadCalendarByProvider(provider) {
  if (provider === "api-football") return getApiFootballCalendar();
  if (provider === "custom") return getCustomCalendar();
  return getLocalCalendar();
}

app.listen(PORT, () => {
  console.log(`Mundial Calendar API running on http://localhost:${PORT}`);
});
