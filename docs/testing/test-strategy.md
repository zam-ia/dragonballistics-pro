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

Fase 2 añadira soluciones analiticas, convergencia de integrador, limites y terminacion.

### Integracion

En Fase 1 la integracion principal es estado Zustand + Dexie + esquemas. El recorrido E2E comprueba que
un cambio de coordenadas sobrevive una recarga. Futuras pruebas uniran perfil, motor, solucionador y
persistencia sin depender de la UI.

### End-to-end

Playwright en Chromium verifica:

1. apertura de la aplicacion;
2. navegacion a Investigacion y Ajustes;
3. cambio de espacio y coordenada;
4. recarga con persistencia IndexedDB;
5. ruta desconocida con recuperacion;
6. controles principales sin errores de pagina.

## Calidad estatica

- ESLint con reglas TypeScript que usan informacion de tipos.
- `tsc -b` con `strict`, `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes`.
- Prettier para formato reproducible.
- Vite build como comprobacion del grafo y assets de produccion.

## CI

GitHub Actions usa Node 24 y pnpm 11, instala con lockfile congelado, ejecuta `pnpm check`, instala
Chromium y corre E2E. Una falla impide considerar la revision verificable.

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

La verificacion del 2026-11-05 aprobo 12 pruebas unitarias en 6 archivos y 2 recorridos E2E en
Chromium. Lint, TypeScript, formato y build tambien aprobaron. El detalle reproducible esta en
`docs/reports/phase-0-1-verification.md` y en la seccion “Verificacion” del roadmap.
