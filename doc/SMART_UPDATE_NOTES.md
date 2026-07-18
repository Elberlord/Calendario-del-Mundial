# Actualización inteligente cada 5 minutos

Esta versión agrega GitHub Actions para actualizar el calendario automáticamente, pero solo durante horario de partido.

## Cómo funciona

El workflow corre cada 5 minutos:

```yaml
cron: "*/5 * * * *"
```

Pero el script revisa `worldcup_calendar_2026.json` primero.

Solo llama la API si hay un partido:

- 30 minutos antes de empezar.
- Durante el partido.
- Hasta 150 minutos después del inicio.

Fuera de ese rango no consume API.

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
