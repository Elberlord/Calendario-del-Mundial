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

Corre cada 5 minutos, pero solo consulta fuentes públicas si hay partido cerca o en curso.

Ventana activa:

```txt
30 minutos antes
180 minutos después del inicio
```

## Archivos importantes

```txt
.github/workflows/update-worldcup.yml
scripts/update-worldcup-public.js
```

## Importante

`openfootball/worldcup.json` no requiere API key, pero su README aclara que no es live en tiempo real; funciona más como datos abiertos actualizados manualmente. Por eso el script intenta primero `worldcup26.ir/get/games` y deja `openfootball` como respaldo.
