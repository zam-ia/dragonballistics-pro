# Roadmap

Estados: Pendiente · En desarrollo · En pruebas · Completado · Bloqueado.

| Fase                    | Estado     | Alcance                                                 | Puerta de salida                               |
| ----------------------- | ---------- | ------------------------------------------------------- | ---------------------------------------------- |
| 0. Investigacion y plan | Completado | referencias, arquitectura, modelos, riesgos y pruebas   | documentos revisables y decisiones registradas |
| 1. Base del software    | Completado | monorepo, UI, rutas, persistencia, CI y contratos       | lint, TS, unitarias, build y E2E aprobados     |
| 2. Motor fisico         | Pendiente  | RK4, Euler, fuerzas, trayectoria, colision y resultados | casos analiticos dentro de tolerancia          |
| 3. Solucionador         | Pendiente  | muestreo, ranking y refinamiento                        | escenarios sinteticos reproducibles            |
| 4. Moviles              | Pendiente  | perfiles con fuente y tipos de disparo                  | nombres/constantes verificados                 |
| 5. Ambiente             | Pendiente  | viento vectorial y perfiles de gravedad                 | cambios explicables y probados                 |
| 6. UI/UX avanzada       | Pendiente  | inspeccion, zoom, comparacion e historial               | pruebas de teclado y rendimiento               |
| 7. Imagenes guardadas   | Pendiente  | recorte, anotacion y deteccion con confianza            | fixtures y correccion manual                   |
| 8. Calibracion          | Pendiente  | datasets, optimizacion y evaluacion                     | mejora fuera de muestra o rechazo              |
| 9. Espacios completos   | Pendiente  | duplicar, reiniciar, escenario e historial              | migraciones y exportacion integral             |
| 10. Metricas            | Pendiente  | RMSE, percentiles y segmentacion                        | separacion entrenamiento/evaluacion            |
| 11. Windows/Tauri       | Pendiente  | ejecutable e instalador offline                         | instalacion limpia sin admin                   |
| 12. Calidad final       | Pendiente  | rendimiento, seguridad y documentacion                  | matriz completa de aceptacion                  |

## Riesgos activos

| Riesgo                                      | Mitigacion                                                |
| ------------------------------------------- | --------------------------------------------------------- |
| No existen constantes oficiales verificadas | perfiles vacios/provisionales con fuente obligatoria      |
| Confundir pixeles y unidades                | transformacion explicita y prueba de ida/vuelta           |
| Solucionador costoso                        | motor puro primero; medir antes de introducir Web Workers |
| Sobreajuste de calibracion                  | particiones separadas y reportes versionados              |
| Dependencia de codigo sin licencia          | motor propio; referencias sin copia                       |
| Deriva hacia asistencia en vivo             | limite arquitectonico y AGENTS.md                         |

## Siguiente incremento autorizado

Despues de verificar Fase 1, la siguiente propuesta es Fase 2A: contratos de simulacion, solucion
analitica de referencia, integrador RK4 y pruebas sin viento/terreno. No se inicia automaticamente.

## Verificacion de Fase 1

Ejecutada el 2026-11-05 en Windows con Node 24.14.1 y pnpm 11.25.0:

- `pnpm install`: instalacion del monorepo y lockfile completados.
- `pnpm format:check`: todos los archivos conformes con Prettier.
- `pnpm lint`: 0 errores y 0 advertencias.
- `pnpm typecheck`: `tsc -b` aprobado con TypeScript 6.0.3.
- `pnpm test`: 6 archivos y 12 pruebas unitarias aprobadas.
- `pnpm build`: Vite 8.3.6, 2,178 modulos transformados y build aprobado.
- `pnpm test:e2e`: 2 recorridos Chromium aprobados.
- QA visual: 1440 × 900 y 390 × 844; el solapamiento movil encontrado fue corregido y revisado.

No se observaron errores de pagina en los recorridos. Los avisos `NO_COLOR` emitidos por el entorno de
Playwright no afectan el resultado ni provienen del codigo de la aplicacion.
