# Fase 3B: solucionador inverso determinista

Estado: implementación en rama `feature/inverse-solver`, quality gate aprobada en GitHub Actions.

## Arquitectura

- `packages/physics/src/solver/types.ts`: contratos, límites y progreso tipado.
- `packages/physics/src/solver/solve.ts`: validación, exploración, ranking, refinamiento, verificación y presupuestos.
- `packages/physics/src/solver/solve.test.ts`: escenarios sintéticos y pruebas de corte.
- `benchmarks/inverse-solver.benchmark.test.ts`: mediciones reproducibles en Node.
- Exportación pública desde `@dragonballistics/physics`.

El solver llama exclusivamente a `evaluateProjectileSummary` para búsqueda y a `simulateProjectile` para verificar impactos. No modifica ecuaciones físicas, colisiones ni constantes.

## Estrategia de búsqueda

La exploración usa rejillas cartesianas anidadas de 3×3, 5×5, 9×9, etc., con extremos y punto medio. Se omiten exactamente los pares de parámetros ya evaluados. Se reservan semillas competitivas en bandas angulares independientes y se refinan mediante un patrón de hasta ocho vecinos por ronda, con pasos de ángulo y potencia que se reducen a la mitad cuando no hay progreso.

El ranking prioriza los impactos al objetivo seleccionado. Sin impacto, compara la distancia superficial mínima; desempata por potencia, tiempo y ángulo. No se utiliza distancia al centro como sustituto de impacto. Un impacto a otro objetivo o al terreno no es éxito.

Los arcos se etiquetan solo si hay al menos dos grupos de impactos confirmados, separados angularmente y con diferencia medible entre apices. Una trayectoria aislada queda `undetermined`.

## Presupuestos y garantías

Por defecto: 1024 evaluaciones y 2000 ms, con máximos duros independientes de 4096 y 5000 ms. Son techos, no promesas de capacidad. El plan de exploración gruesa no excede 128 evaluaciones con `dt > 0.002`, ni 48 con `dt <= 0.002`, para dejar espacio temporal al refinamiento, siguiendo las mediciones de 3A.1.

Se comprueba tiempo y cancelación entre simulaciones; un paso físico individual no es interrumpible, por lo que el tiempo final puede superar ligeramente el límite exactamente en la duración de la última evaluación. El conteo de evaluaciones incluye las verificaciones completas. La cancelación devuelve candidatos parciales. `no-solution` indica únicamente que la búsqueda discreta completada no observó impactos.

## Benchmarks

Ejecutar `pnpm benchmark:solver` después de `pnpm install --frozen-lockfile`. Reporta JSON `INVERSE_SOLVER_BENCHMARK` para seis escenarios no ajustados a posteriori: dos radios de objetivo, sin viento, viento horizontal y viento vertical. Incluye evaluaciones/segundo, tiempos de búsqueda gruesa y refinamiento, verificaciones, impactos, distancia de fallo, terminación y variación aproximada del heap.

Los datos de rendimiento deben registrarse desde la ejecución del comando; el documento no inventa resultados.

## Limitaciones para 3C

- La ejecución es sincrónica: solo debe usarse fuera del hilo de UI cuando se integre el Worker.
- No se interrumpe una integración física en curso.
- Un muestreo finito no demuestra ausencia de soluciones continuas, especialmente con objetivos muy pequeños.
- Las etiquetas de arco dependen de la existencia de impactos confirmados en cuencas claramente separadas.
- La proximidad superficial puede ser cero sin impacto si un obstáculo previo detuvo el vuelo.
- El Worker 3C deberá encapsular mensajes por `jobId`, cancelación cooperativa, progreso limitado y descarte de respuestas obsoletas.

## Resultados verificados en GitHub Actions

Workflow `Quality`, ejecución [42304481394](https://github.com/zam-ia/dragonballistics-pro/actions/runs/42304481394), Ubuntu / Node 24:

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build`: correctos.
- Vitest: **114/114** pruebas, **16/16** archivos.
- Playwright: **3/3** recorridos correctos.
- `pnpm benchmark:solver`: **1/1** benchmark reproducible correcto.

| Escenario | Radio | Evaluaciones | Tiempo real (ms) | Eval/s | Impactos confirmados | Estado |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Sin viento, grande | 5 | 153 | 364.44 | 419.83 | 21 | succeeded |
| Sin viento, pequeño | 0.8 | 137 | 267.56 | 512.04 | 5 | succeeded |
| Viento horizontal, grande | 5 | 150 | 265.82 | 564.29 | 18 | succeeded |
| Viento horizontal, pequeño | 0.8 | 137 | 242.04 | 566.03 | 5 | succeeded |
| Viento vertical, grande | 5 | 149 | 284.40 | 523.91 | 17 | succeeded |
| Viento vertical, pequeño | 0.8 | 136 | 270.35 | 503.04 | 4 | succeeded |

Cada escenario realizó **128 evaluaciones gruesas**, **4 evaluaciones nuevas de refinamiento** y entre **4 y 21 verificaciones completas**. Los tiempos de exploración gruesa fueron de **226.41 a 310.72 ms** y los de refinamiento de **7.38 a 7.93 ms**. Tasa de éxito en este conjunto: **6/6 (100 %)**. No implica garantía de éxito en otros escenarios.

Ninguno alcanzó el límite de 320 evaluaciones del benchmark ni los 2000 ms. La variación de heap observada fue de aproximadamente **-2.90 a +5.44 MB**; puede ser negativa por recolección de basura y **no** representa una medición confiable de memoria pico. Los resultados corresponden al runner de GitHub y no deben extrapolarse al equipo local del usuario.

La prueba analítica de ángulos complementarios y la prueba de restricción a un solo arco pasaron, al igual que los casos de viento, arrastre, obstáculos, objetivo pequeño, ausencia observada de solución, límites, cancelación y revalidación por simulación completa. Los presupuestos y casos de error se comprobaron en Vitest.
