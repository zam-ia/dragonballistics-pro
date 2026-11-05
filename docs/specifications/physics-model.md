# Especificacion del modelo fisico

Estado: implementado y en validacion para Fase 2
Version del motor: 0.2.0
Fecha: 2026-11-05

## Alcance y limite

El motor simula proyectiles 2D en un mundo independiente. Sus unidades y constantes son configurables;
no afirma reproducir DragonBound, GunBound ni otro producto comercial. La configuracion inicial es un
caso de laboratorio claramente identificado, no un perfil de juego.

## Sistema de coordenadas y unidades

- Mundo: cartesiano 2D, `+X` a la derecha y `+Y` hacia arriba.
- Pantalla: origen arriba a la izquierda, `+Y` hacia abajo.
- Longitud: unidad de mundo (`u`), nunca pixel.
- Tiempo: segundo (`s`).
- Velocidad: `u/s`.
- Aceleracion: `u/s²`.
- Angulo: grados en entrada/UI y radianes dentro de funciones trigonometricas.
- Viento polar: 0° apunta a `+X`, 90° a `+Y`, 180° a `-X` y 270° a `-Y`.

`worldToScreen` y `screenToWorld` son funciones de borde reversibles. El integrador nunca recibe
pixeles, escala o tamaño del Canvas.

## Potencia y velocidad inicial

La version 0.2.0 implementa una transformacion lineal configurable:

```text
v0 = baseSpeed + power × speedPerPowerUnit
vx0 = v0 cos(theta)
vy0 = v0 sin(theta)
```

La configuracion inicial usa `baseSpeed = 0` y `speedPerPowerUnit = 1`, por lo que una potencia de 75
produce 75 u/s. Esta equivalencia facilita pruebas y no es una constante verificada de un juego.
`minimumPower` y `maximumPower` forman parte del contrato y se validan antes de simular.

## Estado diferencial

```text
dx/dt = vx
dy/dt = vy
dvx/dt = ax
dvy/dt = ay
```

El estado contiene posicion, velocidad y tiempo transcurrido. El campo de aceleracion suma gravedad,
aceleracion adicional y el modelo de viento activo.

## Integradores

### Runge-Kutta de orden 4

RK4 evalua cuatro derivadas por paso y combina sus pendientes con pesos `1, 2, 2, 1`. Es el integrador
predeterminado porque mantiene error global de orden cuatro y admite aceleraciones dependientes de la
velocidad, como el arrastre lineal. Para aceleracion constante coincide con la solucion analitica hasta
precision de punto flotante.

### Euler semimplicito

Euler actualiza primero velocidad y despues posicion:

```text
v(n+1) = v(n) + a(n) dt
x(n+1) = x(n) + v(n+1) dt
```

Es mas economico y se conserva como referencia comparativa. Su error de posicion es de primer orden;
al dividir `dt` por cuatro, el error observado en el escenario de convergencia tambien se redujo a una
cuarta parte.

## Gravedad, aceleracion y viento

`gravity` es una magnitud no negativa aplicada en `-Y`. `additionalAcceleration` permite un vector
externo independiente.

Hay tres estados/modelos de viento:

1. `none`: aceleracion cero.
2. `acceleration`: la magnitud se interpreta explicitamente como `u/s²` y se descompone en X/Y.
3. `linear-drag`: la magnitud se interpreta como velocidad del aire `u/s`; la aceleracion es:

```text
aWind = dragCoefficientPerSecond × (airVelocity - projectileVelocity)
```

El segundo modelo no pretende ser aerodinamica completa: es un arrastre lineal configurable y
documentado. No se mezclan silenciosamente velocidad de aire y aceleracion directa.

## Colisiones continuas

Cada paso analiza el segmento entre la posicion anterior y la siguiente:

- suelo horizontal mediante interseccion con `groundY`;
- terreno mediante interseccion segmento-segmento;
- objetivos mediante interseccion segmento-circulo;
- limites del mundo mediante el primer cruce de frontera.

Se selecciona la fraccion de paso mas temprana. El tiempo, posicion e impacto se interpolan dentro del
paso para evitar que un proyectil atraviese superficies u objetivos por discretizacion. Los objetivos
tienen prioridad si dos contactos coinciden numericamente.

## Altura maxima

Ademas de comparar muestras, el motor detecta el cambio de signo de `vy`. Integra un paso parcial hasta
la fraccion estimada del cruce y registra ese estado como `apexPoint`. Con aceleracion constante el
resultado es analiticamente exacto para RK4; con fuerzas no lineales es una estimacion de orden del paso.

## Terminacion segura

Cada simulacion finaliza por una razon tipada:

- `ground-impact`;
- `terrain-impact`;
- `target-impact`;
- `out-of-bounds`;
- `maximum-time`;
- `maximum-iterations`;
- `invalid-numeric-state`;
- `invalid-input`.

El paso debe estar en `(0, 1]`, el tiempo maximo en `(0, 600]` y las iteraciones entre 1 y 250,000.
Todos los escalares/vectores deben ser finitos. Un estado `NaN`/infinito se detecta y termina sin bucle.

## Resultado

`SimulationResult` incluye estado, motivo, trayectoria completa, posicion final, impacto opcional,
tiempo de vuelo, alcance horizontal, altura maxima, apice, iteraciones, advertencias, errores y una
copia de los parametros utilizados con velocidad inicial derivada.

## Validacion numerica reproducible

| Caso                               | Resultado del motor                          | Referencia / criterio                                     |
| ---------------------------------- | -------------------------------------------- | --------------------------------------------------------- |
| RK4, 30 u/s, 35°, 2 s              | `(51.14912265733945, 24.794586181062787)`    | solucion cerrada `(51.14912265733951, 24.79458618106276)` |
| Error absoluto RK4                 | X `6.39e-14`, Y `2.84e-14`                   | menor que `1e-9`                                          |
| 40 u/s, 30° vs 60°                 | alcances `141.247396` y `141.247653` u       | diferencia `0.000258` u                                   |
| Apice 30° vs 60°                   | `20.387360` vs `61.162080` u                 | el arco alto supera al bajo                               |
| Viento horizontal -1 / 0 / +1 u/s² | `112.143113` / `124.872184` / `137.601254` u | orden monotono correcto                                   |
| Euler `dt=0.2` vs `dt=0.05`        | errores Y `1.962` y `0.4905` u               | relacion `0.25`                                           |

Las pruebas tambien cubren viento vertical, alturas iniciales, suelo, terreno, circulos, potencia cero,
gravedad cero, parametros invalidos, limite de iteraciones y conversion mundo/pantalla.

## Limitaciones pendientes

- El Canvas usa suelo horizontal y objetivo circular; el motor admite segmentos, pero aun no existe un
  editor visual de terreno.
- No hay resistencia cuadratica, densidad atmosferica, rotacion, proyectiles multiples ni eventos por
  tipo de disparo.
- El punto de apice con fuerzas no lineales usa una fraccion basada en velocidades de los extremos.
- El solucionador inverso de angulo/potencia pertenece a Fase 3 y no se implementa aqui.
