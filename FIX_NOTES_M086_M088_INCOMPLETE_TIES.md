# Fix M086/M088: empates incompletos en eliminatoria

## Problema
El actualizador estaba marcando como `complete` cualquier partido que trajera `score`, aunque el feed no confirmara estado final.

Eso contaminó estos cruces:

- M086 Argentina vs Cabo Verde: `complete`, `1-1`, sin `winner` ni penales.
- M088 Australia vs Egipto: `complete`, `1-1`, sin `winner` ni penales.

En eliminatoria, un empate sin penales o sin `winner` no puede resolver ganador.

## Cambios aplicados

### scripts/update-worldcup-public.js
- `extractStatus()` ya no convierte cualquier marcador en finalizado.
- Si hay score pero el feed no confirma final, queda como `live`.
- `mergeMatches()` vuelve a priorizar equipos + fecha antes que `externalId`.
- `externalId` solo se usa si también coincide equipos + fecha.
- Se agregó protección para no sobrescribir eliminatorias ya resueltas con marcadores incompletos.

### JSON
Se limpiaron los falsos finales:

- `worldcup_calendar_2026.json`
- `public/worldcup_calendar_2026.json`

M086 y M088 quedaron temporalmente como:

```json
"status": "scheduled",
"score": ""
```

Cuando tengas el resultado real, debe guardarse completo, por ejemplo:

```json
"status": "complete",
"score": "1-1 (4-3)",
"winner": "Argentina"
```

## Archivos modificados
- scripts/update-worldcup-public.js
- worldcup_calendar_2026.json
- public/worldcup_calendar_2026.json
- FIX_NOTES_M086_M088_INCOMPLETE_TIES.md
