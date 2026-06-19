# Mundial Calendar API Connected

Esta versión conecta el calendario y la tabla de grupos a un backend proxy.

## Por qué backend proxy

No se deben poner API keys en el navegador. El navegador llama:

```txt
/api/worldcup/calendar
```

Y el backend decide si usa:

- calendario local,
- API-Football,
- una API personalizada.

## Instalación

```bash
npm install
cp .env.example .env
npm start
```

Abre:

```txt
http://localhost:3000
```

## Modo local

Funciona sin API key:

```env
DATA_PROVIDER=local
```

Usa:

```txt
public/worldcup_calendar_2026.json
```

## Modo API-Football

En `.env`:

```env
DATA_PROVIDER=api-football
API_FOOTBALL_KEY=TU_KEY
API_FOOTBALL_LEAGUE_ID=ID_DEL_MUNDIAL_EN_TU_CUENTA
API_FOOTBALL_SEASON=2026
```

El ID de la competición debes confirmarlo en tu cuenta/documentación del proveedor.

## Modo custom

Si ya tienes otro proveedor o backend que devuelve el formato de esta app:

```env
DATA_PROVIDER=custom
CUSTOM_CALENDAR_URL=https://tu-backend.com/api/worldcup/calendar
```

## Endpoints

```txt
GET /api/health
GET /api/worldcup/calendar
```

## Importante

Esto solo sincroniza calendario, resultados y standings deportivos.
No conecta pagos, apuestas, cuotas ni retiro de dinero.
