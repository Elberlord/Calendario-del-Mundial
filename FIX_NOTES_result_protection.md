# Corrección de resultados con penales y protección del actualizador

Cambios aplicados:

- M074 queda como Alemania 1-1 Paraguay, penales 3-4, ganador Paraguay.
- M075 queda como Países Bajos 1-1 Marruecos, penales 2-3, ganador Marruecos.
- M076 queda como Brasil 2-1 Japón, ganador Brasil.
- `parseScore()` ahora entiende marcadores con penales en formato `1-1 (3-4)`.
- `getAdvancedTeam()` respeta primero el campo `winner` cuando existe.
- El actualizador público ya no sobrescribe un resultado verificado de eliminatoria con una versión más pobre sin penales.

Motivo:

El feed público estaba devolviendo/mezclando marcadores incompletos para eliminatorias. En partidos con penales, eso rompe el ganador del bracket aunque el estado diga finalizado.
