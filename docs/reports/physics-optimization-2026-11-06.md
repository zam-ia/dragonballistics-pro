# Optimizacion controlada del motor fisico - 2026-11-06

## Alcance y metodo

Esta medicion corresponde a Fase 3A.1. Compara en el mismo proceso la deteccion adaptativa publicada
en Fase 3A (`legacy-subdivision`) con la politica optimizada (`polynomial-safe`). Se ejecutaron cuatro
rondas por escenario, alternando el orden de las cuatro variantes para reducir sesgos de calentamiento
y recoleccion de basura. El escenario normal realiza 48 evaluaciones por variante y el de
`dt=0.001`, 8 por variante.

Comando reproducible:

```text
pnpm benchmark:physics
```

El equipo de referencia es Windows 11 Pro, Intel Core i3-1215U, 15.73 GiB de RAM, Node 24.14.1,
pnpm 11.25.0 y Vitest 5.1.0 con un worker. Los tiempos de CPU y heap de V8 varian entre ejecuciones;
los contadores de trabajo, los puntos retenidos y el payload serializado son las medidas de memoria
comparables mas estables.

## Cuellos de botella confirmados

El problema principal no era conservar el arreglo de trayectoria. Cada llamada de
`flattenInterval` solicitaba estados parciales y repetia RK4 para fracciones ya calculadas. En alta
resolucion, la politica anterior hizo 765,731 integraciones parciales y creo aproximadamente 3,111,540
estados internos por trayectoria, frente a 12,154 pasos principales.

Los costos se concentraron en RK4 parcial, objetos intermedios, trigonometria repetida del campo de
fuerzas, aplanamiento obligatorio a hojas de `1/16` y aproximacion minima al objetivo.

## Optimizaciones aplicadas

1. RK4 conserva sus cuatro evaluaciones y pesos, pero calcula estados intermedios directamente y
   elimina objetos de derivada redundantes. Una prueba lo compara con la implementacion de referencia
   para un campo no lineal.
2. El campo de fuerzas precomputa gravedad, aceleracion adicional, vector polar y coeficientes de
   arrastre. `sin` y `cos` se ejecutan al crear el campo, no en cada derivada.
3. Cada paso integra solo las fracciones `1/4`, `1/2` y `3/4`, reconstruye la posicion RK4 como curva
   de Bernstein de grado cuatro y reutiliza esa curva para todas las consultas geometricas. Con los
   modelos soportados (aceleracion constante o lineal en velocidad), es algebraicamente equivalente;
   Euler semimplicito queda contenido como grado menor.
4. Un limite de desviacion basado en la envolvente convexa de la curva de Bernstein permite aceptar
   una hoja solo cuando toda la curva esta dentro de la tolerancia de la cuerda. No usa solo los
   extremos ni una muestra puntual. Por debajo de `1/16` conserva la comprobacion adaptativa anterior.
5. El cache de estados sigue produciendo el estado completo integrado para impacto, apice y salida.
   La curva reconstruida se usa para geometria; no sustituye la velocidad final.
6. La proximidad solo examina hojas anteriores al primer impacto o salida y usa la misma tolerancia
   espacial declarada por colisiones.

No se implementaron formulas cerradas separadas, broad phase por cuerda, tolerancias mas amplias,
WebAssembly, GPU ni un motor simplificado. Duplicarian la fuente fisica, no son validas con todos los
modelos o podian omitir tangencias, objetivos pequenos y salidas curvas.

## Resultados A/B

| Escenario  | Variante          |   Promedio |    Mediana |        P95 | Eval/s | Iteraciones | Puntos |
| ---------- | ----------------- | ---------: | ---------: | ---------: | -----: | ----------: | -----: |
| `dt=0.02`  | legacy full       |  13.176 ms |  11.583 ms |  19.751 ms |  75.89 |         608 |    609 |
| `dt=0.02`  | legacy summary    |  12.196 ms |  11.466 ms |  16.777 ms |  81.99 |         608 |      0 |
| `dt=0.02`  | optimized full    |   9.025 ms |   8.347 ms |  13.715 ms | 110.80 |         608 |    609 |
| `dt=0.02`  | optimized summary |  11.446 ms |   8.975 ms |  21.534 ms |  87.37 |         608 |      0 |
| `dt=0.001` | legacy full       | 263.100 ms | 241.960 ms | 365.054 ms |   3.80 |      12,154 | 12,155 |
| `dt=0.001` | legacy summary    | 259.659 ms | 219.635 ms | 415.632 ms |   3.85 |      12,154 |      0 |
| `dt=0.001` | optimized full    |  29.301 ms |  27.786 ms |  38.254 ms |  34.13 |      12,154 | 12,155 |
| `dt=0.001` | optimized summary |  28.462 ms |  24.718 ms |  42.124 ms |  35.13 |      12,154 |      0 |

La aceleracion frente a legacy en la misma ejecucion fue `1.460x` full y `1.066x` summary en normal,
y `8.979x` full y `9.123x` summary con `dt=0.001`.

Contra el benchmark publicado en Fase 3A (`13.853/13.083 ms` normal y `262.185/251.631 ms` alta
resolucion), la mejora final de esta pasada es `1.535x/1.143x` para full/summary normal y
`8.948x/8.841x` para full/summary de alta resolucion. Esta comparacion incluye variacion entre
procesos; el A/B alternado es la referencia mas controlada.

El promedio y P95 muestran variacion por carga, planificacion y GC aun alternando el orden; la mediana
summary mejora `1.277x` en normal y `8.885x` en alta resolucion. El presupuesto usa el promedio, no la
mediana ni el mejor resultado. El objetivo aspiracional de 2x no se alcanza en normal y no se fuerza.

El payload no cambio: 94,812 B full y 1,505 B summary en normal; aproximadamente 1,874,621 B full y
1,501 B summary en alta resolucion. La reduccion de summary sigue entre `98.41 %` y `99.92 %`.

## Contadores por trayectoria summary

| Metrica                        | Legacy normal | Optimized normal | Legacy alta | Optimized alta |
| ------------------------------ | ------------: | ---------------: | ----------: | -------------: |
| RK4 principal                  |           608 |              608 |      12,154 |         12,154 |
| RK4 parcial                    |        38,333 |            1,826 |     765,731 |         36,464 |
| `stateAtFraction`              |        57,830 |            1,825 |   1,154,700 |         36,463 |
| `flattenInterval`              |        18,848 |           18,848 |     376,774 |         12,162 |
| Subdivisiones                  |         9,120 |            9,120 |     182,310 |              4 |
| Hojas aceptadas                |         9,728 |            9,728 |     194,464 |         12,158 |
| Estados integrados aproximados |       155,764 |            9,736 |   3,111,540 |        194,472 |

La integracion parcial bajo 95.24 % en ambos escenarios. En normal la curvatura exige el mismo numero
de hojas, pero ya no reintegra cada consulta. En alta resolucion, el limite cuartico acepto 12,156
intervalos completos y la comprobacion de geometria obligo cuatro subdivisiones cerca del suelo.

Los cronometros instrumentados de una trayectoria optimizada registraron aproximadamente `0.346 ms`
en integraciones, `8.366 ms` en eventos y `1.447 ms` en proximidad para normal; en alta resolucion,
`9.464 ms`, `19.332 ms` y `3.148 ms`. Son contadores solapados e incluyen la sobrecarga de
`performance.now()`, por lo que no deben sumarse ni compararse directamente con el benchmark sin
instrumentacion.

## Paridad y tolerancias

Once escenarios ejecutados en full y summary comparan ambas politicas: gravedad cero, suelo,
terreno segmentado, objetivo pequeno en curva, tangencia, salida curva con extremos dentro, viento,
arrastre lineal, paso pequeno y contactos de terreno/limites dentro del tubo proximo a la tolerancia.
Coinciden estado, terminacion, impacto, iteraciones y resultados
cinematicos. La tolerancia A/B es `1e-8 s` y `1e-7 u`, el piso numerico ya documentado. El mayor
residuo fue una tangencia reconstruida con aproximadamente `2.1e-9 s` y `2.1e-8 u`. Las pruebas
analiticas existentes mantienen sus tolerancias originales mas estrictas.

## Presupuesto recomendado para Fase 3B

Los limites contractuales permanecen independientes: 1,024 evaluaciones y 2 s por defecto; 4,096 y
5 s como maximos. Al throughput summary observado, sin overhead del solver:

| Escenario  | En 2 s teorico | En 5 s teorico | Tiempo para 1,024 |
| ---------- | -------------: | -------------: | ----------------: |
| normal     |           ~174 |           ~436 |          ~11.72 s |
| `dt=0.001` |            ~70 |           ~175 |          ~29.15 s |

Para planificar exploracion se recomienda reservar margen y esperar inicialmente unas 128
evaluaciones normales o 48 de alta resolucion dentro de 2 s. El solver debe conservar semillas de
arco alto y bajo, devolver parciales con `budget-exhausted` y no confundir una malla agotada con una
prueba de `no-solution`.

El lote debe adaptarse: con P95 de `21.534 ms`, un quantum de 25 ms admite una evaluacion normal de
forma conservadora; con P95 de `42.124 ms`, una sola evaluacion de alta resolucion ya puede exceder el
quantum. La cancelacion debe comprobarse entre evaluaciones/lotes. Si una evaluacion futura supera el
quantum, hara falta cancelacion cooperativa dentro del simulador o terminacion del Worker.
