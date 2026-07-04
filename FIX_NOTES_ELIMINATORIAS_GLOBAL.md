# Fix global: eliminatorias con ganador obligatorio

## Problema
Desde la fase eliminatoria, un empate simple como `1-1` ya no es un resultado final suficiente.
En fase de grupos un empate puede cerrar un partido, pero en eliminatorias siempre debe existir un ganador.

## Cambio aplicado
Se actualizó `scripts/update-worldcup-public.js` para que proteja todos los partidos eliminatorios:

- Si el partido no tiene `group`, se considera eliminatoria.
- Si el marcador está empatado y no hay penales ni `winner`, el resultado se considera incompleto.
- Si una fuente pública intenta marcarlo como `complete`, se degrada a `live` para que el bracket no avance mal.
- Si la fuente trae penales en el marcador, por ejemplo `1-1 (2-4)`, se acepta.
- Si la fuente trae `winner`, se acepta.
- Si ya existe un resultado verificado con ganador, el actualizador no lo reemplaza por una versión incompleta.

## Resultados protegidos agregados
- M086: Argentina 3-2 Cabo Verde, ganador Argentina.
- M088: Australia 1-1 Egipto, Egipto gana 4-2 en penales. En el JSON se guarda como `1-1 (2-4)` porque Australia está como local.

## Regla nueva
En eliminatorias:

```txt
empate sin penales ni winner = resultado incompleto
```

Esto evita que próximos partidos como M089, M090, M091, etc. queden finalizados con empate simple y bloqueen el árbol.
