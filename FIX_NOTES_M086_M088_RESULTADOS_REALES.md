# Fix M086/M088: resultados reales y protección del actualizador

## Problema
La fuente pública devolvió o conservó marcadores incompletos para dos eliminatorias:

- M086 aparecía como Argentina 1-1 Cabo Verde.
- M088 aparecía como Australia 1-1 Egipto.

Eso dejaba la llave sin ganador real y trababa M095.

## Corrección aplicada

- M086: Argentina 3-2 Cabo Verde, status complete, winner Argentina.
- M088: Australia 1-1 Egipto, Egipto gana 4-2 en penales. En el JSON queda `1-1 (2-4)` porque Australia es local y Egipto visitante.

## Protección
Se agregaron M086 y M088 a `VERIFIED_RESULT_FIXES` en `scripts/update-worldcup-public.js` para que el actualizador automático no vuelva a reemplazar el resultado real con datos incompletos.

## Resultado esperado
M095 debe resolverse automáticamente como:

Argentina vs Egipto
