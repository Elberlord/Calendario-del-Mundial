# Calendario Mundial 2026 Core + Grupos

Esta versión corrige el faltante principal: ahora puedes ver los grupos y puntos.

## Incluye

- Calendario completo de 104 partidos.
- Fase de grupos.
- Round of 32 / dieciseisavos.
- Octavos.
- Cuartos.
- Semifinales.
- Tercer lugar.
- Final.
- Tabla de grupos automática.
- Puntos.
- PJ, G, E, P.
- GF, GC, DG.
- Filtros por grupo y ronda.
- Buscador por selección, grupo, ronda, sede o fecha.

## Cómo calcula puntos

Desde `worldcup_calendar_2026.json`:

- Victoria: 3 puntos.
- Empate: 1 punto.
- Derrota: 0 puntos.

Orden actual:

1. Puntos.
2. Diferencia de goles.
3. Goles a favor.
4. Nombre del equipo.

## Visual

- Verde lateral: top 2 del grupo.
- Azul lateral: tercer lugar en observación.
- Sin marca: cuarto lugar.

## Nota

Después podemos agregar:
- tabla de mejores terceros,
- bracket visual,
- avance automático de clasificados,
- actualización desde API,
- picks/pronósticos.


## Limpieza pública

Se eliminaron de la interfaz pública los bloques:
- Criterio usado para ordenar.
- Fuente de datos.

Esa información queda como lógica interna del proyecto.
