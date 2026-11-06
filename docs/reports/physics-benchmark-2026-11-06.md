# Benchmark del motor fisico - 2026-11-06

## Objetivo y metodo

Medir el costo actual antes de diseñar el solucionador de Fase 3, sin optimizar ni cambiar el motor. El
comando reproducible es:

```text
pnpm benchmark:physics
```

Cada escenario realiza 2 calentamientos y luego 10 evaluaciones completas de `simulateProjectile` en
un unico worker Node. Se acumulan tiempo de pared, iteraciones principales, puntos de trayectoria y
memoria `heapUsed`. La memoria es aproximada: el recolector de basura y el estado previo del worker
pueden cambiarla entre ejecuciones; no representa memoria retenida por una sola trayectoria.

## Entorno

- Windows 11 Pro 64 bits, version 10.0.26300.
- Intel Core i3-1215U, 6 nucleos y 8 procesadores logicos.
- Memoria visible: aproximadamente 15.73 GiB.
- Node 24.14.1.
- pnpm 11.25.0.
- Vitest 5.1.0 con entorno Node.

## Resultados observados

| Escenario                      | Evaluaciones | Tiempo total | Tiempo/evaluacion | Iteraciones/evaluacion | Puntos/evaluacion | Terminacion          | Tiempo fisico | Aumento pico aproximado de heap |
| ------------------------------ | -----------: | -----------: | ----------------: | ---------------------: | ----------------: | -------------------- | ------------: | ------------------------------: |
| Defaults, `dt=0.02`            |           10 |   200.510 ms |         20.051 ms |                    608 |               609 | `ground-impact`      |   12.153969 s |                        3.44 MiB |
| Solo `dt=0.001`                |           10 | 1,533.368 ms |        153.337 ms |                  5,000 |             5,001 | `maximum-iterations` |    5.000000 s |                       28.52 MiB |
| `dt=0.001`, presupuesto 30,000 |           10 | 9,003.800 ms |        900.380 ms |                 12,154 |            12,155 | `ground-impact`      |   12.153969 s |                       31.86 MiB |

## Interpretacion

- El escenario predeterminado completa aproximadamente 49.87 trayectorias por segundo en este equipo.
- Cambiar solamente `dt` a `0.001` no completa el vuelo: el limite predeterminado de 5,000 iteraciones
  lo detiene a los 5 segundos. Es un comportamiento de seguridad esperado y debe considerarse al
  configurar evaluaciones de alta resolucion.
- Completar el mismo vuelo con `dt=0.001` es unas 44.9 veces mas lento que el default observado. El
  aumento supera la relacion de pasos porque cada paso tambien evalua la trayectoria adaptativa para
  colisiones y genera un punto persistido.
- La trayectoria completa de alta resolucion contiene 12,155 puntos. Antes de Fase 3 conviene medir por
  separado simulaciones que no necesiten conservar todas las muestras, pero este informe no propone ni
  implementa esa optimizacion.

Los tiempos son una linea base local, no un SLA. Deben compararse en el mismo equipo y comando cuando
se introduzcan cambios de rendimiento.
