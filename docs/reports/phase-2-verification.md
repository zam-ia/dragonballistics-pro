# Informe de verificacion de Fase 2

Fecha: 2026-11-05  
Rama: `feature/physics-engine`  
Base estable: `bb39c51ff034de33dc5c81b90a1120f34f5593e6`

## Alcance entregado

La Fase 2 incorpora un motor fisico determinista e independiente de React, su integracion con el
Canvas y contratos persistentes por espacio de trabajo. No se inicio ningun componente de la Fase 3.

El motor incluye:

- integracion Runge-Kutta de cuarto orden (RK4);
- Euler semimplicito como integrador de comparacion;
- velocidad inicial derivada de una relacion lineal de potencia, identificada y configurable;
- gravedad configurable y aceleracion adicional;
- viento vectorial directo y arrastre lineal hacia la velocidad del aire;
- tiempo de vuelo, alcance horizontal, altura maxima y apice;
- interseccion continua del segmento de cada paso con suelo, terreno, objetivos circulares y limites;
- seleccion del primer impacto dentro del paso;
- terminaciones tipadas por impacto, limites, tiempo, iteraciones, estado numerico o entrada invalida;
- validacion de entradas finitas, paso temporal positivo y presupuesto maximo de 250,000 iteraciones.

## Contratos y arquitectura

El paquete `@dragonballistics/physics` no importa React ni estado de interfaz. Expone entradas,
estados, muestras, impactos, mensajes, resultados y razones de terminacion tipados. Las coordenadas de
mundo permanecen separadas de la conversion mundo/pantalla.

`SimulationControlsSchema` conserva por cada uno de los cuatro espacios: angulo, potencia, gravedad,
viento, integrador, `dt` y parametros de comparacion. El valor predeterminado de Zod permite abrir y
normalizar registros IndexedDB creados por la Fase 1 sin perder sus datos. La importacion y exportacion
versionadas incluyen estos controles.

La pagina de trabajo calcula los resultados con funciones puras memorizadas y entrega al Canvas solo
datos de trayectoria. Ningun boton decorativo se presenta como una funcion terminada: los controles
visibles actualizan el motor, la persistencia o la navegacion real.

## Archivos creados

- `packages/physics/src/analytic.ts`
- `packages/physics/src/collisions.ts`
- `packages/physics/src/collisions.test.ts`
- `packages/physics/src/defaults.ts`
- `packages/physics/src/forces.ts`
- `packages/physics/src/integrators.ts`
- `packages/physics/src/integrators.test.ts`
- `packages/physics/src/power.ts`
- `packages/physics/src/simulation.ts`
- `packages/physics/src/simulation.test.ts`
- `packages/physics/src/types.ts`
- `packages/physics/src/validation.ts`
- `packages/physics/src/wind.ts`
- `packages/physics/src/wind.test.ts`
- `docs/reports/phase-2-verification.md`

## Archivos principales modificados

- `packages/physics/src/index.ts`
- `packages/shared/src/schemas.ts`
- `packages/shared/src/defaults.ts`
- `packages/shared/src/schemas.test.ts`
- `apps/web/src/store/lab-store.ts`
- `apps/web/src/pages/WorkbenchPage.tsx`
- `apps/web/src/features/workbench/GeometryCanvas.tsx`
- `apps/web/src/styles/index.css`
- `tests/end-to-end/app.spec.ts`
- `docs/specifications/physics-model.md`
- `docs/specifications/data-model.md`
- `docs/architecture/overview.md`
- `docs/testing/test-strategy.md`
- `docs/roadmap.md`
- `README.md`, `CHANGELOG.md` y manifiestos de version del monorepo.

## Resultados matematicos concretos

Todos los casos son sinteticos y reproducibles; no se usan numeros aleatorios.

| Caso                                | Resultado numerico                                                 | Comprobacion                                              |
| ----------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------- |
| RK4, 30 u/s, 35 grados, 2 s         | `(51.14912265733945, 24.794586181062787)`                          | solucion cerrada `(51.14912265733951, 24.79458618106276)` |
| Error absoluto RK4                  | X `6.394884621840902e-14`, Y `2.842170943040401e-14`               | ambos menores que `1e-9`                                  |
| 40 u/s, 30 vs 60 grados             | alcances `141.24739564548955` y `141.24765340592887`               | diferencia `0.0002577604393252386`                        |
| Apice 30 vs 60 grados               | `20.38735983690112` vs `61.162079510703286`                        | el tiro alto alcanza mayor altura                         |
| Viento horizontal -1 / 0 / +1 u/s^2 | `112.14311284283977` / `124.87218354009669` / `137.60125423735442` | orden monotono correcto                                   |
| Euler, `dt=0.2` vs `dt=0.05`        | errores Y `1.9619999999999962` y `0.49050000000002925`             | relacion `0.2500000000000154`                             |

La suite tambien prueba viento vertical, alturas iniciales distintas, gravedad cero, potencia cero,
suelo, terreno segmentado, objetivos circulares, limites, tiempo maximo, iteraciones maximas, entradas
no finitas, desbordamiento numerico y conversion mundo/pantalla.

## Puerta de calidad local

Entorno: Windows, Node 24.14.1, pnpm 11.25.0.

| Comando             | Resultado                                          |
| ------------------- | -------------------------------------------------- |
| `pnpm format`       | completado                                         |
| `pnpm format:check` | todos los archivos conformes                       |
| `pnpm lint`         | aprobado, sin advertencias                         |
| `pnpm typecheck`    | aprobado                                           |
| primer `pnpm test`  | 10 archivos, 37/37 pruebas aprobadas               |
| `pnpm build`        | aprobado, Vite 8.3.6 y 2,188 modulos transformados |
| segundo `pnpm test` | 10 archivos, 37/37 pruebas aprobadas               |
| `pnpm test:e2e`     | 3/3 recorridos Chromium aprobados                  |

## Problemas detectados y corregidos

- El trabajo preliminar estaba en `stash@{0}` sobre `main`; se inspecciono y aplico con
  `git stash apply` en una rama nueva, sin conflictos y sin borrar el respaldo.
- Los espacios guardados por Fase 1 no contenian controles de simulacion; se agrego un valor
  predeterminado validado y normalizacion al cargar para mantener compatibilidad.
- La etiqueta visible seguia mostrando Fase 1 despues de integrar el motor; se actualizo a version
  `0.2.0` y Fase 2.
- La comparacion necesitaba distinguirse sin duplicar controles opacos; se agrego una trayectoria
  violeta discontinua, apice e impacto propios y controles explicitos.
- Playwright emite avisos ambientales porque `FORCE_COLOR` prevalece sobre `NO_COLOR`; no son errores
  de la aplicacion y los tres recorridos concluyeron correctamente.

## Limitaciones y pendientes

- No hay constantes oficiales de DragonBound incorporadas; la relacion potencia/velocidad se muestra
  como modelo independiente y configurable, no como dato oficial.
- La aerodinamica disponible es aceleracion directa o arrastre lineal. Arrastre cuadratico, densidad
  del aire y perfiles verificados requieren datos con fuente.
- La colision es continua sobre la cuerda de cada paso; curvas muy cerradas requieren reducir `dt`.
- No existe todavia solucionador inverso, ranking de tiros ni refinamiento: pertenecen a Fase 3.
- El Pull Request debe aprobar GitHub Actions y ser revisado antes de cualquier merge.

La fase se considera implementada localmente y lista para revision; no autoriza iniciar Fase 3.
