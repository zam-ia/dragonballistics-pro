# Informe técnico — DragonBallistics Pro Fase 3D

Fecha de trabajo: 2026-11-06  
Rama: feature/inverse-solver  
Pull request: https://github.com/zam-ia/dragonballistics-pro/pull/2

## Alcance entregado

La pantalla de laboratorio incorpora SOLUCIONADOR INVERSO sin crear una app separada.
Hay selección del objetivo configurado, ΔX, ΔY, radio, rangos de ángulo y potencia,
cantidad de soluciones y presupuestos de tiempo y evaluaciones. Se visualiza el
estado del Worker, fase, progreso real, tiempos y resultados ordenados.
El usuario puede iniciar, cancelar, reiniciar, seleccionar, ocultar, comparar
arcos bajo y alto y aplicar explícitamente una solución físicamente confirmada.

## Arquitectura y archivos

- apps/web/src/features/workbench/InverseSolverPanel.tsx: interfaz y suscripción.
- apps/web/src/features/workbench/inverse-solver-model.ts: validación y estados.
- apps/web/src/features/workbench/simulation-input.ts: escenario físico y firma.
- apps/web/src/features/workbench/inverse-solver.css: diseño responsive aislado.
- apps/web/src/features/workbench/GeometryCanvas.tsx: overlay inverso y radio real.
- apps/web/src/pages/WorkbenchPage.tsx: integración con simulador y persistencia.
- apps/web/src/workers/solver-protocol.ts: validación profunda de resultados.
- apps/web/vite.config.ts: harness limitado al modo worker-e2e.
- playwright.config.ts: build instrumental solo para Playwright.
- tests/end-to-end/inverse-solver-ui.spec.ts: validación y capturas visuales.
- tests/end-to-end/inverse-solver-flow.spec.ts: búsqueda, arcos, aplicar y espacios.
- tests/end-to-end/inverse-solver-resilience.spec.ts: cancelación y recuperación.
- apps/web/src/features/workbench/inverse-solver.test.ts: contratos y vigencia.

## Aislamiento

Cada panel está asociado a la ID del espacio y a una firma serializada del
SimulationInput. La firma incluye lanzamiento, objetivo, modelo de potencia,
viento, gravedad, terreno, límites, integrador, tiempo y parámetros iniciales.
Al cambiar de espacio o escenario se desmonta el panel, se termina el Worker,
se descarta el progreso y se invalida la selección. No se mezclan candidatos
de espacios distintos; resultados transitorios no se guardan en IndexedDB.
La comparación visual y el nombre del espacio no afectan la firma física.

## Visualización física y seguridad de aplicación

La reconstrucción de la trayectoria se ejecuta bajo demanda al seleccionar
un candidato; la comparación simultánea requiere una acción explícita y
calcula solo dos candidatos. El Canvas distingue principal (turquesa),
comparación existente (violeta), inversa (coral) y segundo arco (amarillo).
El radio dibujado procede del radio real de las colisiones; no se infla
a un mínimo visual arbitrario. Se marca impacto o aproximación sin equipararlos.
Aplicar solo está habilitado para hit=true con verificación completa,
terminación por objetivo y targetId vigente. Antes de aplicar se vuelve
a comprobar con simulateProjectile y luego se persisten solo ángulo y potencia
en el espacio activo mediante el store existente.

## Pruebas verificadas

GitHub Actions: https://github.com/zam-ia/dragonballistics-pro/actions/runs/42314778122

- Prettier, ESLint, TypeScript y build de producción: correctos.
- Vitest: 129/129 pruebas; 18 archivos.
- Playwright real Chromium: 11/11 pruebas; incluye las pruebas anteriores.
- Benchmark inverso: 6/6 escenarios sintéticos exitosos.
- Pruebas E2E: estado inicial, entrada inválida, búsqueda real, progreso,
  dos arcos, superposiciones, ocultación, aplicación voluntaria, cancelación,
  recuperación tras error, cambio de espacio y cambio de objetivo.
- Responsive a 1440×900 y 390×844: sin overflow horizontal detectado.

## Evidencias de escritorio y móvil

Capturas automáticas del panel:
https://github.com/zam-ia/dragonballistics-pro/actions/runs/42314778122/artifacts/13548864714

Archivos almacenados: solver-desktop.png y solver-mobile.png.
Los tests verifican visibilidad y ausencia de desbordamiento. La revisión
editorial visual manual de esas capturas sigue siendo recomendable.

## Rendimiento observado

En Chromium del runner de GitHub, el benchmark instrumentado del Worker real
registró: creación 0.2 ms, primer progreso 115.4 ms, trabajo completo
371.3 ms, cuatro impactos verificados y 73 ticks del temporizador principal.
La cancelación registró 0 ms redondeados de coste local, reinicio 0.2 ms,
y 129 ticks durante búsqueda de alta resolución más sustitución.
Los valores reflejan ese runner y resolución del reloj, no garantizan
latencia universal ni el instante exacto de terminación interna del hilo.

El benchmark numérico 3B bajo esa ejecución registró estos tiempos:

- Sin viento, radio 5: 153 evaluaciones, 288.30 ms.
- Sin viento, radio 0.8: 137 evaluaciones, 198.43 ms.
- Viento horizontal, radio 5: 150 evaluaciones, 207.57 ms.
- Viento horizontal, radio 0.8: 137 evaluaciones, 183.82 ms.
- Viento vertical, radio 5: 149 evaluaciones, 220.07 ms.
- Viento vertical, radio 0.8: 136 evaluaciones, 208.37 ms.

## Problemas resueltos y limitaciones

- Se corrigió el acoplamiento de radio de Canvas con las colisiones.
- Se separaron helpers de componentes React para Fast Refresh.
- Se endureció el protocolo de mensajes Worker contra campos inválidos.
- Se ajustaron fixtures de progreso para contadores matemáticamente coherentes.
- Se hicieron exactos los selectores de potencia de Playwright, sin
  debilitar la comprobación del control principal.
- Una búsqueda finita no demuestra imposibilidad matemática.
- Las trayectorias completas seleccionadas se dibujan bajo demanda en
  React; en alta resolución puede haber un coste puntual en el hilo principal.
- El flujo no conserva resultados en una caché al volver a un espacio.
- Se mantiene la independencia respecto al cliente comercial.

No se ha hecho merge. El PR continúa draft. No se autoriza avanzar
automáticamente a una fase posterior.
