# ADR 0003: simulador independiente y adquisicion manual

Estado: aceptada  
Fecha: 2026-11-05

## Decision

El producto acepta entradas manuales y, en una fase posterior, imagenes guardadas que el usuario elige
explicitamente. No observa o controla un juego en ejecucion.

## Componentes prohibidos

- lectura de memoria o procesos;
- captura continua o deteccion de objetivos en vivo;
- inyeccion o sustitucion de scripts;
- pulsacion de teclas, mouse o automatizacion de disparos;
- evasion de anti-cheat.

## Consecuencias

El overlay WinForms anterior se conserva como utilidad manual, pero no se amplifica con adquisicion
automatica. La exactitud se evalua mediante escenarios sinteticos y observaciones importadas con fuente.
