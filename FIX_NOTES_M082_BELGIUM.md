# Fix M082 Belgium vs Senegal

## Problema
El actualizador publico podia dejar M082 como `2-2`, aunque el partido correcto fuera Belgica 3-2 Senegal. Como la app resuelve los cruces por marcador, un empate sin penales ni ganador dejaba M094 como `Ganador M082`.

## Ajuste aplicado
- `worldcup_calendar_2026.json`
  - M082 ahora queda `score: "3-2"`, `status: "complete"`, `winner: "Bélgica"`.
- `public/worldcup_calendar_2026.json`
  - Misma correccion para GitHub Pages/servidor publico.
- `scripts/update-worldcup-public.js`
  - Se agrego `VERIFIED_RESULT_FIXES`.
  - Despues de mezclar datos de fuentes publicas, aplica correcciones verificadas para evitar que un dato viejo vuelva a romper el cruce.

## Donde verifica datos el actualizador
- `.github/workflows/update-worldcup.yml`
  - Ejecuta `node scripts/update-worldcup-public.js` cada 2 horas y tambien manualmente con `workflow_dispatch`.
  - Define `PUBLIC_SOURCE_URLS`.
- `scripts/update-worldcup-public.js`
  - `PUBLIC_SOURCE_URLS` lista las fuentes publicas usadas.
  - `fetchBestAvailableSources()` consulta esas fuentes.
  - `normalizePayload()` y `normalizeMatch()` convierten los datos recibidos al formato del calendario.
  - `mergeMatches()` mezcla los datos remotos con `worldcup_calendar_2026.json`.
  - `applyVerifiedResultFixes()` protege correcciones verificadas como M082.
