# API_NOTES

## Proveedores considerados

- API-Football / API-Sports: fixtures, standings, teams y más.
- Sportmonks: fixtures pasados, presentes y futuros; livescores para tiempo real.
- Custom provider: cualquier API que devuelva el formato normalizado.

## Formato normalizado que espera el frontend

```json
{
  "competition": {
    "id": "world-cup-2026",
    "name": "FIFA World Cup 2026",
    "lastUpdated": "2026-06-19T00:00:00Z"
  },
  "stages": [],
  "matches": [
    {
      "id": "123",
      "externalId": "123",
      "stage": "Fase de grupos",
      "round": "Group A - 1",
      "group": "Grupo A",
      "date": "2026-06-11",
      "timeET": "3:00 PM ET",
      "home": "México",
      "away": "Sudáfrica",
      "venue": "Mexico City",
      "status": "complete",
      "score": "2-0"
    }
  ]
}
```

## Cache

`CACHE_TTL_SECONDS=300` evita gastar llamadas de API cada vez que alguien refresca.

Durante partidos puedes bajarlo a 30-60 segundos.
Fuera de partidos puede ser 30-60 minutos.
