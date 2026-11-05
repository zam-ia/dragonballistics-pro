# DragonBallistics Pro

Laboratorio independiente y local para estudiar geometria, trayectorias y calibracion balistica 2D.
No se conecta a clientes comerciales, no lee memoria o procesos y no automatiza controles.

## Estado actual

Version `0.2.0`: Fase 0, Fase 1 y motor de Fase 2.

- Investigacion y decisiones de arquitectura documentadas.
- Monorepo TypeScript estricto con paquetes separados.
- Aplicacion React/Vite navegable y responsive.
- Banco geometrico interactivo con cuatro espacios persistentes.
- Importacion y exportacion JSON validada.
- Preferencias locales reales.
- Contratos iniciales para fisica, moviles, calibracion y vision.
- Motor balistico determinista con RK4 y Euler semimplicito.
- Gravedad, viento vectorial, arrastre lineal, suelo, terreno y objetivos circulares.
- Trayectoria, impacto, apice y comparacion visual de dos simulaciones.

El solucionador inverso y los parametros verificados de moviles no estan implementados todavia. El
motor usa unidades de laboratorio configurables y no afirma reproducir un juego comercial.

## Requisitos

- Node.js 22.12 o superior (se valido con Node 24).
- pnpm 11.25 o compatible.

Rust/Tauri no es necesario para las Fases 0–2. Se evaluara despues de estabilizar la aplicacion web.

## Desarrollo

```powershell
pnpm install
pnpm dev
```

Abrir `http://localhost:5173`.

## Verificacion

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

El atajo `pnpm check` ejecuta lint, TypeScript, pruebas unitarias y compilacion de produccion.

## Estructura

```text
apps/web                 aplicacion React, Canvas, rutas y persistencia
packages/shared          contratos Zod y tipos compartidos
packages/physics         integradores, fuerzas, colisiones y simulacion tipada
packages/mobiles         esquema de perfiles; registro intencionalmente vacio
packages/calibration     contratos y calculo de error observado
packages/vision          validacion de imagenes guardadas
docs                     arquitectura, investigacion, especificaciones y pruebas
tests/end-to-end         recorridos de navegador
```

Consulta [docs/roadmap.md](docs/roadmap.md) para el estado verificable de cada fase.
