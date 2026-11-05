# ADR 0002: persistencia local con IndexedDB

Estado: aceptada  
Fecha: 2026-11-05

## Decision

Usar Dexie sobre IndexedDB para espacios y ajustes. El intercambio se realiza con JSON versionado y
validado por Zod.

## Razones

- La herramienta debe funcionar sin conexion.
- No existe requisito de cuenta, colaboracion o backend.
- Las transacciones evitan importaciones parciales.

## Consecuencias

El usuario debe exportar para respaldo entre equipos. Las futuras migraciones se versionan. No se
introducen Firebase, Supabase, telemetria ni servicios de pago.
