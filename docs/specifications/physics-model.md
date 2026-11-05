# Especificacion del modelo fisico

Estado: diseño para Fase 2; no implementado en Fase 1.

## Sistema de coordenadas

- Mundo: cartesiano 2D, origen configurable, `+X` a la derecha y `+Y` hacia arriba.
- Pantalla: origen arriba a la izquierda, `+Y` hacia abajo.
- Unidad interna de longitud: unidad de mundo (`u`), nunca pixel.
- Tiempo: segundos.
- Angulo: radianes en el nucleo, grados solo en entrada y presentacion.
- Masa: kilogramo solo si el modelo seleccionado la necesita.
- Fuerzas/aceleraciones: unidades coherentes por segundo cuadrado.

`packages/physics` ya prueba que `worldToScreen` y `screenToWorld` son inversas. La escala y la camara
pertenecen al renderizador, no al estado del proyectil.

## Estado minimo propuesto

```ts
interface ProjectileState {
  position: Vec2;
  velocity: Vec2;
  elapsedSeconds: number;
}

interface SimulationEnvironment {
  gravity: Vec2;
  windAcceleration: Vec2;
  timeStepSeconds: number;
  maxTimeSeconds: number;
  worldBounds: Bounds;
}
```

Todos los campos se validaran como finitos y dentro de limites documentados antes de simular.

## Ecuaciones base

Para aceleracion constante sin resistencia:

```text
dx/dt = vx
dy/dt = vy
dvx/dt = ax
dvy/dt = ay
```

La velocidad inicial se obtiene de una magnitud `v0` y un angulo `theta`:

```text
vx0 = v0 cos(theta)
vy0 = v0 sin(theta)
```

Viento no significa automaticamente velocidad del aire. Cada modelo ambiental debe declarar si su
entrada es aceleracion directa o si se usa un modelo de arrastre. No se mezclaran ambos significados.

## Integrador principal

Se implementara Runge-Kutta de cuarto orden (RK4) como integrador general por su error global de orden
cuatro y comportamiento estable con aceleraciones dependientes del estado. Euler semimplicito se
implementara como referencia simple y para comparar costo/error. El paso temporal sera configurable y
no se redondearan estados intermedios.

Para el caso analitico de aceleracion constante se comparara la simulacion con:

```text
x(t) = x0 + vx0 t + 1/2 ax t²
y(t) = y0 + vy0 t + 1/2 ay t²
```

## Terminacion y colision

Cada corrida termina por una causa tipada:

- impacto con terreno;
- impacto con objetivo;
- salida de limites;
- tiempo maximo;
- estado numerico invalido.

Se usara barrido entre la posicion anterior y la nueva para evitar atravesar terreno con pasos grandes.
Un maximo de iteraciones derivado de `maxTime / dt` impide bucles infinitos.

## Solucionador futuro

1. Muestreo grueso del dominio permitido.
2. Simulacion determinista de cada candidato.
3. Error euclidiano entre impacto y objetivo.
4. Conservacion de maximos locales prometedores para arcos alto y bajo.
5. Refinamiento sin redondeo interno.
6. Resultado con restricciones activas y razon de invalidez.

## Validacion

- gravedad constante contra solucion cerrada;
- ausencia de viento;
- simetria de alcance para angulos complementarios en alturas iguales;
- `dt` decreciente debe converger;
- viento opuesto cambia el alcance con signo correcto;
- colision no omite segmentos finos;
- entradas no finitas y limites invalidos se rechazan.

Ninguna constante del juego se incorporara a estas pruebas sin un conjunto de evidencia versionado.
