# Roadmap

Estados: Pendiente · En desarrollo · En pruebas · Completado · Bloqueado.

| Fase                    | Estado        | Alcance                                                 | Puerta de salida                               |
| ----------------------- | ------------- | ------------------------------------------------------- | ---------------------------------------------- |
| 0. Investigacion y plan | Completado    | referencias, arquitectura, modelos, riesgos y pruebas   | documentos revisables y decisiones registradas |
| 1. Base del software    | Completado    | monorepo, UI, rutas, persistencia, CI y contratos       | lint, TS, unitarias, build y E2E aprobados     |
| 2. Motor fisico         | Completado    | RK4, Euler, fuerzas, trayectoria, colision y resultados | casos analiticos dentro de tolerancia          |
| 3. Solucionador         | En desarrollo | evaluacion resumen, muestreo, ranking y refinamiento    | escenarios sinteticos reproducibles            |
| 4. Moviles              | Pendiente     | perfiles con fuente y tipos de disparo                  | nombres/constantes verificados                 |
| 5. Ambiente             | Pendiente     | viento vectorial y perfiles de gravedad                 | cambios explicables y probados                 |
| 6. UI/UX avanzada       | Pendiente     | inspeccion, zoom, comparacion e historial               | pruebas de teclado y rendimiento               |
| 7. Imagenes guardadas   | Pendiente     | recorte, anotacion y deteccion con confianza            | fixtures y correccion manual                   |
| 8. Calibracion          | Pendiente     | datasets, optimizacion y evaluacion                     | mejora fuera de muestra o rechazo              |
| 9. Espacios completos   | Pendiente     | duplicar, reiniciar, escenario e historial              | migraciones y exportacion integral             |
| 10. Metricas            | Pendiente     | RMSE, percentiles y segmentacion                        | separacion entrenamiento/evaluacion            |
| 11. Windows/Tauri       | Pendiente     | ejecutable e instalador offline                         | instalacion limpia sin admin                   |
| 12. Calidad final       | Pendiente     | rendimiento, seguridad y documentacion                  | matriz completa de aceptacion                  |

## Riesgos activos

| Riesgo                                      | Mitigacion                                                |
| ------------------------------------------- | --------------------------------------------------------- |
| No existen constantes oficiales verificadas | perfiles vacios/provisionales con fuente obligatoria      |
| Confundir pixeles y unidades                | transformacion explicita y prueba de ida/vuelta           |
| Solucionador costoso                        | motor puro primero; medir antes de introducir Web Workers |
| Sobreajuste de calibracion                  | particiones separadas y reportes versionados              |
| Dependencia de codigo sin licencia          | motor propio; referencias sin copia                       |
| Deriva hacia asistencia en vivo             | limite arquitectonico y AGENTS.md                         |

## Fases del solucionador autorizadas y verificadas

Fase 3A y 3A.1: evaluador summary y optimizaciones aprobadas.
Fase 3B: solucionador inverso determinista puro verificado.
Fase 3C: ejecución mediante Worker, cancelación y aislamiento por jobId.
Fase 3D: interfaz integrada del laboratorio, selección de soluciones,
Canvas con arcos y aplicación voluntaria. La calidad automatizada
alcanzó 129 pruebas Vitest y 12 Playwright en GitHub Actions.
El PR #2 permanece abierto en draft y sin merge.
No existe autorización para avanzar automáticamente a otra fase.
Documentos de diseño:

- `docs/specifications/inverse-solver-design.md`;
- `docs/testing/inverse-solver-test-plan.md`;
- `docs/decisions/0004-summary-evaluation-and-worker-solver.md`;
- `docs/reports/physics-summary-benchmark-2026-11-06.md`.
- `docs/reports/physics-optimization-2026-11-06.md`.
- `docs/reports/inverse-solver-phase-3b.md`.
- `docs/decisions/0005-worker-isolation-and-hard-cancellation.md`.
- `docs/decisions/0006-inverse-ui-and-workspace-isolation.md`.
- `docs/reports/inverse-solver-phase-3d.md`.

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

## Verificacion de Fase 2

Ejecutada el 2026-11-05 en Windows con Node 24.14.1 y pnpm 11.25.0:

- `pnpm format` y `pnpm format:check`: todos los archivos conformes con Prettier.
- `pnpm lint`: 0 errores y 0 advertencias.
- `pnpm typecheck`: `tsc -b` aprobado.
- `pnpm test`: 10 archivos y 37 pruebas aprobadas antes del build.
- `pnpm build`: Vite 8.3.6, 2,188 modulos transformados y build aprobado.
- segundo `pnpm test`: 10 archivos y 37 pruebas aprobadas despues del build.
- `pnpm test:e2e`: 3 recorridos Chromium aprobados.
- QA visual: 1440 x 1000 y 390 x 844, incluida la comparacion de dos trayectorias.

La evidencia matematica, los archivos y las limitaciones se detallan en
`docs/reports/phase-2-verification.md`. La Fase 3 permanece pendiente y requiere aprobacion explicita.
