# Corrección de actualización automática — 18 de julio de 2026

## Problema corregido

- El workflow se ejecutaba cada 15 minutos durante todo el año.
- Se consultaba `worldcup26.ir/get/games` como fuente sin llave, pero ese servicio ahora exige autenticación.
- El paso `git push` se ejecutaba incluso cuando no había cambios y cualquier rechazo convertía la ejecución en fallo, generando correos repetidos.
- M089 y M090 estaban intercambiados respecto a los IDs oficiales.
- El calendario estaba detenido en octavos y no había actualizado cuartos ni semifinales.

## Solución aplicada

- Resultados actualizados y protegidos hasta M102.
- M103: Francia vs Inglaterra.
- M104: España vs Argentina.
- Fuente con autenticación eliminada.
- Consultas con timeout y reintentos.
- Workflow limitado a las fechas 18–20 de julio y una ejecución por hora.
- No se intenta crear un commit cuando no hay cambios.
- Un rechazo de permisos al hacer push queda como advertencia y no genera correo de fallo cada hora.
- Se añadió `scripts/validate-calendar.js` para validar 104 partidos, IDs, cruces y las tres copias JSON.
- Se corrigió la inversión local/visitante: si una fuente devuelve el partido al revés, también se invierte el marcador antes de fusionarlo.

## Ajuste necesario en GitHub

Para que la acción pueda guardar cambios automáticamente:

`Settings → Actions → General → Workflow permissions → Read and write permissions`
