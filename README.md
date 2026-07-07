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


## Botón WhatsApp

Se agregó un botón `Ver` junto a cada partido del calendario.
El botón abre WhatsApp al número `+506 6430 5227` con el mensaje:

```txt
como puedo ver el partido
```


## Flujo Suscripción → Ver partido online

El botón `Ver` abre un modal.

Dentro del modal:
1. Se muestra `Suscribirse al canal`.
2. Al tocar ese botón, aparece `Ver partido online`.
3. El botón `Ver partido online` apunta por defecto a `https://www.youtube.com/@Elberlord`.

Para cambiar el link final, edita en `app.js`:

```js
const WATCH_ONLINE_URL = "https://www.youtube.com/@Elberlord";
```

Nota: la web no puede verificar por sí sola si la persona completó la suscripción; solo desbloquea el botón después del clic.


## Dónde poner tu link para ver el partido online

Abre el archivo:

```txt
app.js
```

Busca esta línea:

```js
const WATCH_ONLINE_URL = "PON_AQUI_TU_LINK_DEL_PARTIDO_ONLINE";
```

Y reemplázala por tu link final, por ejemplo:

```js
const WATCH_ONLINE_URL = "https://tu-link-final.com";
```

No toques el link de YouTube si solo quieres cambiar el destino final del botón `Ver partido online`.

El link de suscripción está aquí:

```js
const YOUTUBE_SUBSCRIBE_URL = "https://www.youtube.com/@Elberlord?sub_confirmation=1";
```


# Actualización inteligente cada hora

Esta versión agrega GitHub Actions para actualizar el calendario automáticamente, pero solo durante horario de partido.

## Cómo funciona

El workflow corre cada hora, aunque no haya partido activo:

```yaml
cron: "0 * * * *"
```

El script consulta fuentes públicas sin API key, aplica resultados verificados cuando una fuente falla o devuelve datos incompletos, y guarda cambios solo si el calendario cambió realmente.

## Archivos agregados

```txt
.github/workflows/update-worldcup.yml
scripts/update-worldcup-smart.js
```

## Secrets necesarios en GitHub

En tu repositorio ve a:

```txt
Settings → Secrets and variables → Actions → New repository secret
```

Crea:

```txt
API_FOOTBALL_KEY
API_FOOTBALL_LEAGUE_ID
```

## Dónde ajustar los minutos

En `.github/workflows/update-worldcup.yml`:

```yaml
UPDATE_BEFORE_MINUTES: "30"
UPDATE_AFTER_MINUTES: "150"
```

## Importante

Si no hay partido en horario activo, el script termina sin llamar la API.
Eso protege el plan gratis.


# Actualización sin API key

Se eliminó la dependencia de API-Football.

## Qué cambia

Ya no necesitas estos secrets:

```txt
API_FOOTBALL_KEY
API_FOOTBALL_LEAGUE_ID
```

El workflow ahora usa fuentes públicas sin llave:

```txt
https://worldcup26.ir/get/games
https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json
```

## Cómo funciona

Corre cada hora y consulta fuentes públicas siempre. Además, la página abierta recarga el JSON una vez por hora para recibir el archivo más nuevo sin tocar diseño ni estado visual principal.

## Archivos importantes

```txt
.github/workflows/update-worldcup.yml
scripts/update-worldcup-public.js
```

## Importante

`openfootball/worldcup.json` no requiere API key, pero su README aclara que no es live en tiempo real; funciona más como datos abiertos actualizados manualmente. Por eso el script intenta primero `worldcup26.ir/get/games` y deja `openfootball` como respaldo.


## Ajuste del modal de suscripción

El modal ahora usa un texto más claro para usuarios nuevos y usuarios que ya están suscritos:

- Botón: `Suscribirse / confirmar`
- Mensaje: si ya está suscrito, puede tocar el botón como confirmación.
- Después aparece `Ver partido online`.

El link final del botón `Ver partido online` sigue configurable en `app.js`:

```js
const WATCH_ONLINE_URL = "PON_AQUI_TU_LINK_DEL_PARTIDO_ONLINE";
```


## Ajuste de mensaje del modal

El modal ya no se presenta como verificación estricta de suscripción.

Ahora usa un lenguaje más honesto:

- Título: `Apoya mi canal`
- Botón: `Apoyar mi canal`
- Mensaje: si ya está suscrito, puede tocarlo como confirmación.
- Luego aparece `Ver partido online`.


## Partidos finalizados sin botón Ver

Los partidos con `status: "complete"` ya no abren el modal.

En el calendario ahora muestran:

```txt
Finalizado
```

El botón queda desactivado y no permite acceder al flujo de `Ver partido online`.


## Corrección de error Maximum call stack size exceeded

Se corrigió la función `watchButtonHtml(match)`.

Antes el botón pendiente se llamaba a sí mismo por error:

```js
return `${watchButtonHtml(match)}`;
```

Ahora devuelve correctamente el botón:

```js
return `<button class="watch-btn" type="button">Ver</button>`;
```
