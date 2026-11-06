# Fase 3B: solucionador inverso determinista

Estado: implementación en rama `feature/inverse-solver`, pendiente de puerta de calidad.

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
