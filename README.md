# Calendario Mundial 2026 Core

Este ZIP contiene primero el núcleo limpio del calendario, separado de la app de picks/apuestas.

## Archivos

- `index.html`: interfaz visual.
- `style.css`: estilos.
- `app.js`: carga, filtros y render del calendario.
- `worldcup_calendar_2026.json`: fuente de datos principal.
- `README.md`: estas notas.

## Qué incluye

- 104 partidos.
- Fase de grupos completa.
- Round of 32 / dieciseisavos.
- Octavos.
- Cuartos.
- Semifinales.
- Tercer lugar.
- Final.
- Filtros por ronda y grupo.
- Buscador por equipo, ronda, sede o fecha.

## Por qué está separado

Primero conviene dejar el calendario perfecto.
Después se conecta:
- picks,
- créditos ficticios,
- ranking,
- sincronización API,
- panel admin.

## Actualización futura

La app lee `worldcup_calendar_2026.json`.
Cuando haya backend/API, solo se reemplaza ese JSON por una ruta como:

```js
https://tu-backend.com/api/worldcup/calendar
```

Manteniendo el mismo formato.
