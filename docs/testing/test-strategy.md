# Estrategia de pruebas

## Objetivo

Demostrar propiedades matematicas, contratos, persistencia y recorridos de usuario. Una prueba aprobada
no convierte parametros provisionales en datos oficiales.

## Piramide

### Unitarias

Vitest ejecuta funciones puras y esquemas:

- geometria 3-4-5, direccion y conversion mundo/pantalla;
- validacion de cuatro espacios y rechazo de `NaN`;
- procedencia obligatoria de perfiles;
- residuos de calibracion;
- tipos/tamaños de imagen;
- importacion/exportacion versionada.
- RK4 frente a solucion analitica de aceleracion constante;
- Euler semimplicito y convergencia al reducir `dt`;
- descomposicion polar y modelos de viento;
- angulos complementarios, alturas y gravedad cero;
- colision continua con suelo, segmentos y objetivos circulares;
- primer impacto, salida de limites y limites de tiempo/iteraciones;
- colision sobre curva con `dt=1`, rechazo del falso positivo de cuerda y contacto tangencial;
- contacto inicial con terreno: impacto al entrar y separacion permitida al salir;
- objetivos de radio `0.01`, impactos al inicio y estabilidad con diferentes `dt`;
- salida y reentrada curva de limites con ambos extremos del paso dentro;
- arrastre lineal frente a su solucion analitica exponencial;
- potencia cero, entradas no finitas y estados numericos invalidos.

### Integracion

Zustand, Dexie y Zod se prueban con IndexedDB emulado. Los casos cubren migracion de un registro de
Fase 1, recuperacion individual cuando falta o falla uno de cuatro registros y persistencia ordenada de
ediciones rapidas en los cuatro espacios. El recorrido E2E comprueba ademas que los cambios sobreviven
una recarga real del navegador.

### End-to-end

Playwright en Chromium verifica:

1. apertura de la aplicacion;
2. navegacion a Investigacion y Ajustes;
3. cambio de espacio y coordenada;
4. recarga con persistencia IndexedDB;
5. ruta desconocida con recuperacion;
6. controles principales sin errores de pagina.
7. recalculo al cambiar angulo, potencia y viento;
8. comparacion de dos trayectorias;
9. persistencia del modelo de viento y parametros de comparacion.

## Calidad estatica

- ESLint con reglas TypeScript que usan informacion de tipos.
- `tsc -b` con `strict`, `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes`.
- Prettier para formato reproducible.
- Vite build como comprobacion del grafo y assets de produccion.

## CI

GitHub Actions usa Node 24 y pnpm 11, instala con lockfile congelado y ejecuta `pnpm check`, cuyo primer
control es `pnpm format:check`, antes de lint, TypeScript, unitarias y build. Despues instala Chromium y
corre E2E. Una falla impide considerar la revision verificable.

## Datos de prueba

- Fixtures sinteticos deben identificarse como tales.
- Casos analiticos viven separados de observaciones experimentales.
- Fase 8 separara entrenamiento, validacion y evaluacion por identificadores persistentes.
- No se generan resultados aleatorios para afirmar precision.

## Presupuestos iniciales

Fase 2 medira por separado simulacion unica, lote del solucionador y render del Canvas. Objetivos
preliminares: interaccion menor de 100 ms y render cercano a 60 FPS en el equipo de referencia. No se
marcan cumplidos hasta capturar mediciones repetibles.

## Evidencia de esta entrega

La verificacion de Fase 1 del 2026-11-05 aprobo 12 pruebas unitarias en 6 archivos y 2 recorridos E2E.
La primera entrega de Fase 2 alcanzo 37 pruebas en 10 archivos. La revision tecnica del PR #1 eleva la
suite a 49 pruebas en 11 archivos y mantiene 3 recorridos E2E. Los resultados numericos y comandos
finales estan registrados en `docs/reports/phase-2-verification.md`.
