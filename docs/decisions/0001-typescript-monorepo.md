# ADR 0001: monorepo TypeScript con paquetes de dominio

Estado: aceptada  
Fecha: 2026-11-05

## Decision

Usar pnpm workspaces y paquetes `shared`, `physics`, `mobiles`, `calibration` y `vision`, compuestos por
una aplicacion React/Vite. TypeScript estricto es el lenguaje comun del motor y la interfaz.

## Razones

- Permite probar matematicas sin React.
- Evita serializacion entre lenguajes durante las primeras fases.
- Facilita Web Workers y posterior empaquetado Tauri.
- Limita dependencias mediante referencias de proyecto.

## Consecuencias

El build web consume fuente de paquetes internos. Cambios de contrato rompen TypeScript temprano. Tauri
y Rust se posponen; solo se justificaran por necesidades de escritorio que el navegador no cubra.
