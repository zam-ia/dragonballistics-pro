# Diseño del solucionador inverso

Estado: propuesta tecnica previa a implementacion
Fase: 3
Fecha: 2026-11-06

## Objetivo

Encontrar combinaciones de angulo y potencia que alcancen un objetivo configurado dentro del
simulador independiente. El solucionador reutilizara el motor de Fase 2 y nunca incorporara constantes
de juegos comerciales sin una fuente verificada.

Esta entrega documenta el diseño. No implementa todavia la busqueda completa ni publica un PR.

## Limites arquitectonicos

- `packages/physics` conserva ecuaciones, integradores, fuerzas y colisiones como unica fuente fisica.
- El solucionador sera puro, determinista y ajeno a React, Canvas, IndexedDB y pixeles.
- La aplicacion web solo adaptara controles, ejecutara el trabajo fuera del hilo principal y mostrara
  resultados tipados.
- El resultado no afirmara que existe una solucion cuando el presupuesto termine antes de demostrarlo.
- Angulos y potencias se mantienen sin redondear durante calculo; la UI redondeara solo al presentar.

## Flujo propuesto

```text
SolverInput validado
        |
        v
evaluacion rapida compartida con simulation.ts
        |
        v
muestreo grueso determinista
        |
        v
seleccion diversa de semillas por cuenca/arco
        |
        v
refinamiento local con pasos decrecientes
        |
        v
ranking, deduplicacion y SolverResult tipado
```

## Modo de evaluacion rapida

El benchmark del 2026-11-06 muestra que la simulacion predeterminada completa conserva 609 puntos y
tarda aproximadamente 20.051 ms por evaluacion en el equipo de referencia. Una busqueda de cientos de
candidatos no debe crear todas esas colecciones.

Se propone extraer el bucle actual a un nucleo compartido con dos politicas de captura:

1. `full`: comportamiento publico actual de `simulateProjectile`; conserva toda la trayectoria.
2. `summary`: conserva solo estado inicial/final, impacto, apice, punto de mayor aproximacion al
   objetivo, tiempo, iteraciones, terminacion y diagnosticos numericos.

`simulateProjectile` seguira delegando al nucleo en modo `full`. El solver usara una funcion nueva de
resumen. No se copiaran ecuaciones, fuerzas, integradores ni logica de colision.

Contrato preliminar:

```ts
interface EvaluationSummary {
  status: SimulationStatus;
  terminationReason: SimulationTerminationReason;
  impact: ImpactResult | null;
  finalState: TrajectoryPoint;
  apexPoint: TrajectoryPoint;
  closestApproach: {
    point: Vec2;
    elapsedSeconds: number;
    centerDistance: number;
    surfaceDistance: number;
  };
  flightTimeSeconds: number;
  iterations: number;
  errors: SimulationMessage[];
}
```

La paridad entre `full` y `summary` sera una puerta obligatoria: mismas terminaciones, tiempos,
impactos, apices y errores dentro de las tolerancias existentes.

## Entrada y salida del solver

Contratos preliminares:

```ts
interface SolverInput {
  simulation: SimulationInput;
  targetId: string;
  angleRange: { minimum: number; maximum: number };
  powerRange: { minimum: number; maximum: number };
  requestedSolutions: number;
  budgets: SolverBudgets;
}

interface SolverBudgets {
  maximumEvaluations: number;
  maximumWallTimeMs: number;
  coarseFraction: number;
  refinementRounds: number;
}

type SolverStatus =
  'succeeded' | 'no-solution' | 'invalid-input' | 'budget-exhausted' | 'cancelled';

interface SolverCandidate {
  angleDegrees: number;
  power: number;
  arc: 'low' | 'high' | 'undetermined';
  hit: boolean;
  score: number;
  missDistance: number;
  closestApproach: EvaluationSummary['closestApproach'];
  impact: ImpactResult | null;
  flightTimeSeconds: number;
  maximumHeight: number;
  terminationReason: SimulationTerminationReason;
}

interface SolverResult {
  status: SolverStatus;
  solutions: SolverCandidate[];
  evaluatedCandidates: number;
  elapsedMilliseconds: number;
  exhaustedBudget: 'evaluations' | 'time' | null;
  messages: SimulationMessage[];
}
```

Todos los rangos, presupuestos y escalares se validaran con Zod o validadores puros antes de evaluar.

## Funcion de puntuacion

La clasificacion primaria sera geometrica y explicable:

1. Un `target-impact` contra `targetId` tiene `missDistance = 0`.
2. En los demas casos, `missDistance` es la distancia minima continua desde la trayectoria al borde
   del objetivo circular, limitada inferiormente a cero.
3. Estados invalidos no compiten con candidatos validos y conservan su motivo.
4. Penalizaciones por limites o terreno se registran por separado; no sustituyen la distancia fisica.
5. Empates se resuelven deterministicamente por menor error, menor potencia, menor tiempo y angulo.

La primera implementacion no mezclara pesos opacos. Si se agrega una funcion compuesta, cada termino y
unidad debera estar documentado y probado.

## Busqueda gruesa

- Muestreo cartesiano estratificado sobre los rangos permitidos de angulo y potencia.
- Resolucion derivada del presupuesto, no de una constante de un juego.
- Inclusiones obligatorias de extremos y centro de cada rango.
- Orden determinista y sin numeros aleatorios.
- Conservacion de los mejores candidatos por bandas angulares, evitando que una sola cuenca consuma
  todas las semillas.
- Corte inmediato cuando se alcanza presupuesto de evaluaciones, tiempo o cancelacion.

La asignacion inicial sera 75 % del presupuesto para exploracion gruesa y 25 % para refinamiento. La
proporcion sera configurable dentro de limites validados.

## Refinamiento

Se usara busqueda de patron bidimensional, adecuada para objetivos con colisiones y discontinuidades:

1. Seleccionar hasta cuatro semillas diversas por cuenca de arco.
2. Evaluar vecinos `+/- pasoAngulo` y `+/- pasoPotencia` sin salir de los rangos.
3. Moverse solo si mejora la puntuacion con una tolerancia definida.
4. Reducir ambos pasos a la mitad al no mejorar.
5. Terminar por tolerancia, rondas, presupuesto, tiempo o cancelacion.

No se usaran gradientes numericos hasta demostrar continuidad suficiente. Cada par angulo/potencia se
normalizara como clave exacta para no evaluarlo dos veces.

## Arco alto y arco bajo

Los candidatos se agruparan por cuencas angulares y por altura maxima relativa a lanzamiento/objetivo.
Cuando existan dos soluciones fisicamente distintas, el ranking conservara al menos la mejor de cada
cuenca antes de llenar posiciones adicionales.

La etiqueta `low` o `high` solo se asignara cuando dos grupos validos esten separados por una brecha
angular y de apice superior a tolerancias declaradas. Un unico grupo se marca `undetermined`; no se
inventara un segundo arco.

## Presupuestos iniciales

| Presupuesto             | Default propuesto | Limite duro inicial | Motivo                                |
| ----------------------- | ----------------: | ------------------: | ------------------------------------- |
| Evaluaciones totales    |             1,024 |               4,096 | evita busquedas no acotadas           |
| Tiempo de pared del job |          2,000 ms |            5,000 ms | respuesta interactiva y cancelable    |
| Rondas de refinamiento  |                 6 |                  10 | convergencia acotada                  |
| Soluciones solicitadas  |                 4 |                  16 | salida legible y deduplicable         |
| Semillas por cuenca     |                 2 |                   4 | diversidad sin explosion combinatoria |

Se aplica el primer limite alcanzado. `budget-exhausted` devuelve candidatos parciales y explica el
limite; no equivale a `no-solution`.

## Rendimiento y Web Worker

El benchmark existente justifica ejecutar la busqueda fuera del hilo principal: una sola trayectoria
completa cuesta ~20 ms y ya supera un frame de 16.7 ms; 1,024 evaluaciones completas serian
inaceptables en React.

Plan:

- el solver puro vive en `packages/physics/src/solver/`;
- un Worker de `apps/web` recibe estructuras serializables con `jobId`;
- emite progreso como maximo cada 50 ms o cada 16 evaluaciones;
- comprueba cancelacion entre evaluaciones y lotes de refinamiento;
- la UI nunca ejecuta el lote sincrono en el hilo principal;
- la trayectoria completa se recalcula solo para las soluciones finales seleccionadas.

Antes del solver se medira el evaluador `summary`. Criterios para avanzar:

- paridad funcional completa con `full`;
- cero puntos de trayectoria acumulados en modo resumen;
- al menos 50 % menos tiempo por evaluacion predeterminada en el mismo benchmark;
- aumento pico de heap claramente inferior al modo completo;
- si no se alcanza la mejora, perfilar antes de implementar busqueda masiva.

Los umbrales son puertas de diseño, no resultados ya obtenidos.

## Incrementos de implementacion

1. Extraer nucleo compartido y crear `summary`, con pruebas de paridad y benchmark.
2. Definir contratos/validacion del solver y puntuacion de aproximacion.
3. Implementar muestreo grueso determinista con presupuestos.
4. Agregar refinamiento, deduplicacion y diversidad de arcos.
5. Integrar Worker, progreso y cancelacion.
6. Integrar UI y recalcular trayectorias completas solo para soluciones finales.

Cada incremento tendra commit y puerta de calidad propios. No se implementara toda la Fase 3 en un
unico cambio.

## Fuera de alcance inmediato

- parametros o nombres no verificados de juegos comerciales;
- aprendizaje automatico;
- calibracion de perfiles;
- captura de pantalla, lectura de procesos o control de entradas;
- optimizacion GPU o WebAssembly sin perfiles que la justifiquen.
