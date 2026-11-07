# ADR 0005: ejecucion del solucionador en Web Worker y cancelacion por terminacion

Fecha: 2026-11-06
Estado: implementado en Fase 3C, sujeto a validacion CI

## Contexto

La implementacion 3B de `solveProjectile` es sincrona. El hilo del Worker
no puede procesar `CANCEL` mientras la llamada ocupa su event loop.
Un controlador que solo publique el mensaje CANCEL ofreceria una cancelacion falsa.

## Decision

- Un Web Worker de modulo Vite por busqueda (no ejecuta nunca el solucionador en React).
- Protocolo serializable `START`, `PROGRESS`, `CANCEL`, `RESULT`, `ERROR`,
  siempre asociado a un identificador `jobId`.
- El controlador envia `CANCEL` como aviso y llama inmediatamente
  `terminate()` para detener el hilo activo. Un inicio posterior crea un
  Worker nuevo. No se pretende procesar el CANCEL desde un calculo sincrono.
- Las respuestas se aceptan solo cuando coinciden la instancia y el `jobId`
  actuales. Los eventos viejos se ignoran. El resultado termina y libera al Worker.
- El controlador es independiente de React, ofrece `start`, `subscribe`,
  `getSnapshot`, `cancel`, `dispose` y mediciones basicas.
- Se valida la estructura de mensajes antes de usar el motor; los rangos,
  presupuestos y fisica mantienen la validacion numerica del solver.
- Progreso a lo sumo por etapa, 16 evaluaciones o aproximadamente cada 50 ms,
  sin spam por cada evaluacion.
- No hay acceso al cliente de juego, captura, inyeccion, ni automatizacion.

## Garantias y limitaciones

La terminacion evita que A publique cambios sobre B, y libera la capacidad
de crear otro Worker. La llamada `terminate()` no representa una confirmacion
sincrona de que el sistema operativo haya detenido toda actividad ni cancela
retroactivamente una simulacion ya concluida. Se mide el costo observado de
solicitar la cancelacion, no se promete una latencia de parada universal.

El contador de impactos del progreso enumera solo verificaciones completas.
Se reserva una fraccion limitada del presupuesto de evaluaciones para
`simulateProjectile`; un impacto sin verificacion nunca se marca exitoso.
La eleccion de reserva puede dejar evaluaciones sin utilizar cuando no se
hallan candidatos provisionales: la busqueda finita no demuestra imposibilidad.

El archivo `solver-worker-harness.html` es una entrada tecnica para pruebas
Playwright, no una interfaz de busqueda ni Fase 3D. Se integra con Vite para
probar un Worker real empaquetado, con pruebas unitarias que simulan errores,
cancelaciones y respuestas obsoletas.

## Siguiente incremento propuesto (requiere autorizacion)

Fase 3D: UI para seleccionar rangos, suscribirse mediante
`useSyncExternalStore`, representar estados, conservar aislamiento por
espacio de trabajo y seleccionar solo soluciones fisicamente verificadas.
Si se necesita progreso parcial mas fino, evaluar conversion del solver a
un iterador cooperativo en un incremento separado y con pruebas de paridad.
