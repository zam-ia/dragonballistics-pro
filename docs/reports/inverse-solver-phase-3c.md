# Informe de Fase 3C: Web Worker y cancelacion

Fecha: 2026-11-06
Estado: implementacion publicada en `feature/inverse-solver`; PR #2 en draft.

## Arquitectura

- `apps/web/src/workers/solver-protocol.ts`: mensajes tipados y verificaciones de estructura.
- `apps/web/src/workers/inverse-solver.worker.ts`: solucionador 3B ejecutado en hilo dedicado.
- `apps/web/src/workers/solver-worker-controller.ts`: inicio, progreso, resultado, cancelacion,
  reemplazo, errores, suscripcion y liberacion. No depende de React.
- `apps/web/src/workers/solver-worker-controller.test.ts`: pruebas unitarias con Worker simulado.
- `apps/web/src/workers/solver-worker-harness.ts`: entrada de pruebas sin interfaz de usuario.
- `apps/web/solver-worker-harness.html`: pagina instrumental para Playwright con Worker real.
- `tests/end-to-end/solver-worker.spec.ts`: pruebas de integracion de navegador.
- `packages/physics/src/solver/solve.ts`: presupuestos reservados y progreso verificado.

## Protocolo y ejecucion

Todo mensaje lleva `jobId`. Las peticiones son `START` y `CANCEL`; las respuestas son
`PROGRESS`, `RESULT` y `ERROR`. La entrada se valida estructuralmente y el solucionador
aplica su validacion numerica. La salida rechaza impactos sin marca de verificacion completa.

La cancelacion no se basa en que el Worker atienda `CANCEL` durante una funcion sincrona.
El controlador envia la orden, ejecuta `terminate()`, invalida el trabajo anterior y crea
un Worker nuevo para la siguiente busqueda. Los eventos se filtran por objeto Worker y `jobId`.

El progreso indica exploracion, refinamiento o finalizacion, evaluaciones de cada etapa,
confirmaciones completas y tiempo transcurrido. No presenta impactos provisionales como verificados.

## Correcciones previas al Worker

- Reserva configurable derivada del presupuesto, con techo de evaluaciones para simulaciones completas.
- Reserva temporal conservadora: hasta 300 ms o 15 % del maximo, cuando existen impactos provisionales.
- Si la reserva temporal detiene la busqueda, el motivo es `time-limit` y se conserva el resultado parcial.
- La reserva es de mejor esfuerzo; una llamada fisica individual puede exceder su ventana.
- Prueba de refinamiento con potencia fija: la exploracion de 20, 30 y 40 grados no impacta,
  pero el patron local recupera un impacto aproximadamente a 32.42 grados para un objetivo
  construido alrededor de 32.5 grados y radio 0.2 unidades.
- Los impactos exitosos se vuelven a verificar con `simulateProjectile`.

## Pruebas y mediciones del navegador

Primera ejecucion completa verificada:
https://github.com/zam-ia/dragonballistics-pro/actions/runs/42308147448

- Prettier, ESLint, TypeScript y build correctos.
- Vitest: 124/124 pruebas en 17 archivos.
- Playwright: 6/6 escenarios, incluidos tres con Worker real.
- Benchmark numerico 3B: 6/6 escenarios con al menos un impacto.

Mediciones instrumentadas en Playwright Chromium, runner GitHub Linux:

- Tiempo de creacion del Worker: 1 ms (precision del reloj de Chromium).
- Primer progreso: 85 ms desde el inicio del controlador.
- Tiempo total de una busqueda real: 339.4 ms.
- Cuatro resultados verificados en esa busqueda.
- Actividad del temporizador principal: 67 ticks durante esa busqueda.
- Sobrecarga de llamada a `postMessage`: 0 ms redondeados (no es latencia de entrega).
- Coste local de `cancel()`: aproximadamente 0.1 ms.
- Coste local de cancelar y arrancar otro trabajo: aproximadamente 0.4 ms.
- Durante la prueba de alta resolucion y reemplazo: 162 ticks del temporizador principal.

Estas cifras son observaciones de una ejecucion y pueden variar con el dispositivo.
`terminate()` no ofrece acuse sincronico del hilo interno: la latencia medida es la de la
llamada local y la actualizacion del controlador, no tiempo certificado de muerte del hilo.

La cancelacion y recuperacion en fase de refinamiento se comprueban adicionalmente con
un Worker simulado; no se afirma una latencia fisica real para esa fase.

## Limitaciones y recomendacion

- El Worker actual ejecuta `solveProjectile` sincrono; la cancelacion efectiva
  depende de terminar la instancia. No hay lotes cooperativos.
- Al cancelar por terminacion se pierden candidatos aun no publicados.
- El fixture E2E forma parte del empaquetado multi-entrada, pero no es panel de Fase 3D.
- El tiempo depende del hardware, del radio del objetivo y de la resolucion fisica.
- Para 3D: usar las suscripciones tipadas, mostrar estados reales y seleccionar solo
  candidatos verificados; no ejecutar busquedas en el hilo de React.
