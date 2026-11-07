# ADR 0006: interfaz del solucionador y aislamiento por escenario

Fecha: 2026-11-06  
Estado: aceptada para Fase 3D

## Contexto

El laboratorio tiene cuatro espacios locales, controles físicos persistentes y Canvas 2D.
El solver de 3B corre en un Web Worker cancelable de 3C. Una solución obtenida
con otra configuración física no puede aplicarse al espacio actual.

## Decisiones

1. Extraer la construcción de SimulationInput al módulo simulation-input.ts.
   Canvas, trayectoria principal, comparación y Worker comparten la geometría,
   el ID workspace-target, radio 10 u, gravedad, viento, integrador y paso temporal.
2. La firma se deriva de la serialización del SimulationInput completo.
   Un cambio físico invalida el resultado. Nombre de espacio y comparación
   meramente visual no alteran esa firma.
3. Montar el panel por clave de workspace y firma. El desmontaje libera
   suscripciones, termina el Worker y descarta el resultado transitorio.
   No se almacena estado del Worker en IndexedDB. No se conservan resultados
   anteriores al regresar a una configuración previa.
4. React consume el controlador estable mediante useSyncExternalStore.
   La búsqueda siempre se ejecuta fuera del hilo principal.
5. Al seleccionar se reconstruye solo esa trayectoria con simulateProjectile.
   Al comparar dos arcos se reconstruyen exactamente esos dos candidatos.
6. Aplicar esta solución requiere impacto verificado en el objetivo elegido
   y revalidación completa con el escenario vigente. Después usa
   updateActiveSimulation para actualizar únicamente ángulo y potencia
   sin alterar los otros espacios ni su mecanismo de persistencia.
7. El protocolo comprueba objetos de impacto y proximidad, rangos numéricos,
   contadores coherentes y campos obligatorios antes de aceptar respuestas.
8. Vite incluye el harness instrumental solo en el modo worker-e2e;
   el build normal de producción no expone esa página HTML.

## Consecuencias y limitaciones

La barra de progreso representa presupuesto usado, no avance exacto.
Una distancia superficial de cero sin impacto físico sigue siendo aproximación.
La política descarta resultados al cambiar de espacio, incluso si volver
a él conservaría una configuración compatible; puede añadirse una caché
efímera firmada más adelante si demuestra utilidad.
La búsqueda no bloquea React; reconstruir una o dos trayectorias completas
seleccionadas sí tiene un coste puntual en el hilo principal, especialmente
con pasos físicos extremos. Deberá perfilarse en hardware objetivo.
El proyecto continúa independiente del cliente comercial y sin automatización.
