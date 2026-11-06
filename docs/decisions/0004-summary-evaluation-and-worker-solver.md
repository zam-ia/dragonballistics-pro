# ADR 0004: evaluacion resumen y solucionador en Worker

Estado: propuesta
Fecha: 2026-11-06

## Contexto

El solucionador inverso necesita evaluar cientos o miles de pares angulo/potencia. La simulacion de
Fase 2 conserva todos los puntos porque alimenta el Canvas. El benchmark de referencia mide ~20 ms y
609 puntos por trayectoria predeterminada; `dt=0.001` completo mide ~900 ms y 12,155 puntos.

Ejecutar lotes con ese contrato en React bloquearia el hilo principal y crearia asignaciones que el
ranking no necesita.

## Decision propuesta

1. Extraer un nucleo de simulacion compartido con politicas `full` y `summary`.
2. Mantener `simulateProjectile` como fachada compatible de modo `full`.
3. Construir el solver puro sobre `summary`, sin duplicar ecuaciones ni colisiones.
4. Ejecutar la busqueda por lotes en un Web Worker de la aplicacion.
5. Recalcular en modo `full` unicamente las soluciones elegidas para visualizacion.
6. Aplicar limites de evaluaciones, tiempo y cancelacion en todos los jobs.

## Alternativas descartadas

- Reutilizar directamente `SimulationResult` completo: conserva demasiados puntos por candidato.
- Duplicar un motor simplificado: introduce deriva fisica y dos fuentes de verdad.
- Ejecutar el solver sincrono en React: una sola evaluacion ya puede exceder un frame.
- Introducir WebAssembly/GPU ahora: no existe un perfil que justifique su complejidad.

## Consecuencias

- El nucleo fisico requiere una refactorizacion con pruebas estrictas de paridad.
- El modo resumen agrega un contrato pequeño y medible, pero no cambia la fisica.
- El Worker agrega mensajes, progreso y cancelacion que necesitan pruebas de integracion.
- La UI permanece responsiva aunque el job tarde segundos.
- Los resultados parciales y presupuestos agotados se vuelven estados explicitos.

La decision pasa a `aceptada` solo despues de validar la paridad y el benchmark del primer incremento.
