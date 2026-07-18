# Fix: actualización segura por equipos/fecha

Se ajustó `scripts/update-worldcup-public.js` para evitar que una fuente pública coloque marcadores en partidos equivocados.

## Problema
El actualizador priorizaba `externalId`. Algunas fuentes públicas usan IDs o índices diferentes, así que un marcador podía entrar en el partido local equivocado. El resultado visible era que equipos correctos del bracket recibían resultados de otro cruce.

## Cambio aplicado
Ahora el orden de emparejamiento es:

1. Equipos + fecha exacta.
2. Grupo + par de equipos, solo para fase de grupos.
3. `externalId` solamente si además coinciden equipos y fecha.

Si el `externalId` existe pero los equipos/fecha no coinciden, se ignora y se imprime un log:

```txt
ExternalId ignorado por no coincidir equipos/fecha
```

También se conserva la protección verificada de M082:

```txt
Bélgica 3-2 Senegal
```

## Archivo modificado

- `scripts/update-worldcup-public.js`
