# Plan de pruebas del solucionador inverso

Estado: propuesta previa a implementacion
Fecha: 2026-11-06

## Objetivos

- demostrar que el modo rapido conserva la fisica de Fase 2;
- encontrar soluciones sinteticas conocidas sin depender de datos comerciales;
- conservar soluciones de arco alto y bajo cuando existan;
- distinguir entrada invalida, ausencia de solucion y presupuesto agotado;
- mantener determinismo, cancelacion y limites de rendimiento.

## 1. Evaluador rapido

Pruebas de paridad `full` contra `summary` para:

- gravedad constante sin viento;
- viento por aceleracion positivo y negativo;
- arrastre lineal;
- suelo, terreno, objetivo circular y salida de limites;
- contacto inicial, tangencia y colision curva;
- `maximum-time`, `maximum-iterations`, entrada invalida y estado no finito.

Criterios: misma terminacion e impacto; tiempo, posicion, velocidad y apice dentro de las tolerancias de
Fase 2. `summary` no debe acumular un arreglo de trayectoria.

## 2. Casos analiticos

### Dos arcos con potencia fija

En gravedad constante, sin viento y con igual altura inicial/final:

```text
R = v^2 sin(2 theta) / g
```

Se elegira un alcance con `0 < Rg/v^2 < 1` y se restringira la potencia a un valor conocido. Las dos
soluciones complementarias deben recuperarse dentro de la tolerancia angular definida y clasificarse
en cuencas distintas.

### Solucion unica por restricciones

Se limitara el rango angular para contener solo uno de los arcos analiticos. El solver debe devolver una
solucion, no fabricar la alternativa excluida.

### Escenario generado hacia adelante

Se generara un objetivo con una simulacion conocida bajo viento y otro bajo arrastre lineal. El solver
debe recuperar un candidato cuyo error al volver a simular este dentro de la tolerancia del objetivo.

## 3. Ausencia de solucion e invalidez

- objetivo fuera del alcance por potencia maxima;
- rango angular que excluye todo impacto;
- terreno que bloquea los candidatos;
- rangos invertidos, `NaN`, presupuesto cero y objetivo inexistente;
- simulaciones que terminan por limites o iteraciones.

`no-solution` solo se permite cuando se completo el presupuesto planificado. Un corte anticipado usa
`budget-exhausted`; una entrada incorrecta usa `invalid-input`.

## 4. Presupuestos y determinismo

- nunca superar `maximumEvaluations`;
- detenerse al agotar tiempo y conservar parciales;
- cancelar entre evaluaciones sin publicar un resultado posterior como vigente;
- ejecutar dos veces la misma entrada y comparar orden/candidatos exactamente;
- no evaluar dos veces el mismo par normalizado de angulo/potencia;
- comprobar desempates estables.

## 5. Refinamiento y diversidad

- el mejor refinado no empeora su semilla;
- los pasos se reducen y respetan rangos;
- candidatos equivalentes se deduplican;
- dos cuencas analiticas conservan un arco alto y uno bajo;
- una sola cuenca permanece `undetermined` o unica, sin duplicado artificial.

## 6. Worker e integracion

- mensajes de entrada/salida validados y serializables;
- `jobId` impide que progreso antiguo actualice un job nuevo;
- progreso monotono y limitado en frecuencia;
- cancelacion y error del Worker dejan la UI recuperable;
- la seleccion de una solucion ejecuta una simulacion completa y muestra su trayectoria real;
- los cuatro espacios mantienen configuraciones y resultados independientes.

## 7. Rendimiento

Los tiempos no se afirmaran mediante tests unitarios fragiles. Habra un benchmark separado que registre:

- evaluaciones por segundo;
- iteraciones y terminaciones;
- puntos retenidos;
- heap antes/despues y pico aproximado;
- comparacion `full` contra `summary`;
- busqueda gruesa y refinamiento por separado.

Puertas iniciales en el equipo de referencia:

- `summary` al menos 2 veces mas rapido que `full` en el escenario predeterminado;
- ningun lote del solver ejecutado sincronicamente en React;
- presupuesto default de 1,024 y duro de 4,096 evaluaciones respetados;
- job default limitado a 2 s y limite duro de 5 s;
- build, lint, TypeScript, unitarias, E2E y CI aprobados.

Si el evaluador rapido no alcanza la mejora, se documentara el perfil antes de cambiar algoritmos o
introducir cache, Workers adicionales, WebAssembly o GPU.
