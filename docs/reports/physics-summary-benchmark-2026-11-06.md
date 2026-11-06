# Benchmark full vs summary - 2026-11-06

## Objetivo y metodo

Comparar `simulateProjectile` (`full`) con `evaluateProjectileSummary` (`summary`) despues de extraer
el nucleo compartido de Fase 3A. Ambos modos usan las mismas ecuaciones, integradores, fuerzas,
colisiones adaptativas y criterios de terminacion.

Comando reproducible:

```text
pnpm benchmark:physics
```

El proceso se ejecuta con `--expose-gc`. Cada modo recibe tres calentamientos. El escenario normal
realiza 20 evaluaciones y el de alta resolucion cinco. Se registran duraciones individuales, promedio,
mediana, percentil 95, evaluaciones por segundo, iteraciones, puntos y memoria aproximada.

La memoria tiene dos lecturas:

- `heapUsed` antes, pico observado y despues de solicitar GC, que sigue sujeto al comportamiento de V8;
- bytes del resultado serializado, una aproximacion reproducible al payload que el llamador retendria.

## Entorno

- Windows 11 Pro 64 bits, version 10.0.26300.
- Intel Core i3-1215U, 6 nucleos y 8 procesadores logicos.
- Memoria visible: aproximadamente 15.73 GiB.
- Node 24.14.1.
- pnpm 11.25.0.
- Vitest 5.1.0, un worker Node.

## Resultados

| Escenario                  | Modo    |   Promedio |    Mediana |        P95 | Eval/s | Iteraciones | Puntos retenidos | Payload serializado |
| -------------------------- | ------- | ---------: | ---------: | ---------: | -----: | ----------: | ---------------: | ------------------: |
| `dt=0.02`                  | full    |  13.853 ms |  13.539 ms |  15.589 ms |  72.19 |         608 |              609 |            94,812 B |
| `dt=0.02`                  | summary |  13.083 ms |  12.736 ms |  15.038 ms |  76.43 |         608 |                0 |             1,505 B |
| `dt=0.001`, vuelo completo | full    | 262.185 ms | 268.782 ms | 271.811 ms |  3.814 |      12,154 |           12,155 |         1,874,617 B |
| `dt=0.001`, vuelo completo | summary | 251.631 ms | 251.308 ms | 263.577 ms |  3.974 |      12,154 |                0 |             1,501 B |

Mejora temporal observada:

- normal: `1.059x` (`5.56 %` menos tiempo promedio);
- alta resolucion: `1.042x` (`4.03 %` menos tiempo promedio).

Reduccion del payload serializado:

- normal: `98.41 %`;
- alta resolucion: `99.92 %`.

En la pasada registrada, el aumento retenido aproximado de heap despues de GC fue `10.85 MB` para
full y no hubo aumento neto para summary en el escenario normal. En alta resolucion fue `27.81 MB`
para full y `1.07 MB` para summary. Los picos transitorios no fueron monotonicamente menores porque V8
puede diferir la recoleccion de objetos internos; por eso no se usan como criterio unico.

## Paridad observada

Ambos modos terminaron con el mismo motivo, tiempo de vuelo e iteraciones:

- normal: `ground-impact`, `12.153969476386967 s`, 608 iteraciones;
- alta resolucion: `ground-impact`, `12.15396947638392 s`, 12,154 iteraciones.

Las pruebas unitarias amplian esta comparacion a gravedad, viento, arrastre, suelo, terreno, objetivos
pequenos, curvas, tangencias, limites, contactos iniciales y estados invalidos.

## Perfilado cuando no se alcanzo 2x

Se capturo un perfil CPU dentro del worker de Vitest sobre 80 evaluaciones summary. Las funciones con
mas muestras propias fueron:

| Funcion                    | Archivo          | Muestras |
| -------------------------- | ---------------- | -------: |
| `rungeKutta4Step`          | `integrators.ts` |       70 |
| `stateAtFraction`          | `simulation.ts`  |       65 |
| campo de aceleracion       | `forces.ts`      |       38 |
| `flattenInterval`          | `collisions.ts`  |       31 |
| `windAccelerationAt`       | `wind.ts`        |       29 |
| `findFirstTrajectoryEvent` | `collisions.ts`  |       26 |

El costo dominante es integrar estados parciales para aplanar y refinar colisiones curvas. La captura
de puntos completos consume memoria retenida, pero representa una parte pequena del tiempo. Reducir
subdivisiones solo para summary cambiaria el contrato fisico y fue rechazado en esta fase.

## Presupuestos realistas

Los limites de evaluaciones y tiempo son independientes. Con el throughput summary medido, sin incluir
overhead futuro de ranking, mensajes o Worker:

| Escenario       | En 2 s (teorico) | En 5 s (teorico) | Tiempo para 1,024 |
| --------------- | ---------------: | ---------------: | ----------------: |
| normal          |             ~153 |             ~382 |           ~13.4 s |
| alta resolucion |               ~7 |              ~19 |          ~257.7 s |

Por tanto, 1,024 sigue siendo el maximo predeterminado de evaluaciones, no una promesa de trabajo
completado dentro de dos segundos. El solver debe detenerse por el primer limite alcanzado y devolver
`budget-exhausted` con resultados parciales. Completar una malla finita sin impacto tampoco demuestra
matematicamente que no exista una solucion continua.

Para Fase 3B se recomienda comenzar con lotes de 4 a 16 evaluaciones o un quantum maximo cercano a
25 ms, medir el costo del Worker y comprobar cancelacion entre lotes antes de ajustar el tamano.
