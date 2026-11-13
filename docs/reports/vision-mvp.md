# DragonBallistics Vision — primer módulo funcional

Rama: `feature/vision-analysis`, basada en `feature/inverse-solver`.

## Alcance implementado

- Nueva vista /vision, independiente de los cuatro espacios del laboratorio.
- Captura de pestaña/pantalla autorizada con `getDisplayMedia`.
- Importación local de PNG, JPEG, MP4 y WebM por URL de objeto.
- Muestreo de fotogramas a 5 FPS como máximo y análisis en un Web Worker.
- Regiones manuales arrastrables y etiquetas viento, móviles, terreno y efectos.
- Telemetría reproducible por región: brillo, actividad de bordes y cambio temporal.
- Exportación JSON de regiones/mediciones y PNG del fotograma visible.
- Fin de pistas de MediaStream, revocación de URL de objetos y terminación del Worker.

## Límite técnico explícito

Las mediciones de brillo, bordes y movimiento **no** reconocen aún la magnitud
ni dirección del viento, el tipo de móvil, la física de un tornado o las
coordenadas del mundo. Estos detectores necesitan muestras etiquetadas,
calibración de resoluciones y pruebas de precisión. Nunca se presentan métricas
de imagen como datos físicos confirmados.

Este módulo es para el análisis visual y la calibración con capturas o sesiones
autorizadas. No modifica el motor balístico ni automatiza el juego.

## Verificación pendiente para el usuario

1. Ejecutar `pnpm install --frozen-lockfile` y `pnpm dev`.
2. Abrir /vision, importar una imagen PNG/JPEG y marcar una región.
3. Verificar métricas por región y exportación local.
4. Probar "Compartir pestaña" en Chrome, conceder el permiso y detenerlo.
5. Ejecutar `pnpm check` y `pnpm test:e2e` y comprobar permisos del navegador.

El permiso de pantalla debe activarse manualmente; pruebas automáticas no
deben simular que existe consentimiento real.
