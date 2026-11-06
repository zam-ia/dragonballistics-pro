# Arquitectura de DragonBallistics Pro

Estado: implementada hasta Fase 2
Fecha: 2026-11-05  
Decision principal: monorepo local, TypeScript estricto y dependencias dirigidas.

## Contexto

La aplicacion evolucionara desde una calculadora manual de trayectoria hacia un laboratorio capaz de
simular, resolver y calibrar modelos balisticos. El overlay anterior, `Trayectoria Lab Overlay`, es una
aplicacion WinForms monolitica de un archivo. Se conserva sin cambios como herramienta previa y como
fuente de requisitos de interaccion: cuatro espacios, coordenadas exactas, uso compacto y persistencia.
No se reutiliza como base porque mezcla interfaz, calculo y almacenamiento y no permite probar los
modulos de forma aislada.

## Diagrama de dependencias

```text
                         apps/web
              UI · rutas · Canvas · Dexie
                 /       |       |       \
                v        v       v        v
          physics    mobiles  calibration  vision
                \        |       |        /
                         shared
                   tipos · Zod · defaults
```

Reglas:

1. `shared` no depende de ningun otro paquete interno.
2. Los paquetes de dominio pueden depender de `shared`, nunca de React o de la aplicacion web.
3. `apps/web` compone dominios y persistencia; no contiene ecuaciones balisticas.
4. `physics` nunca recibe pixeles. La conversion de mundo a pantalla es una funcion de borde.
5. Vision procesa solo archivos elegidos por el usuario y devuelve observaciones con confianza.

## Capas

### Aplicacion web

React 19, Vite 8, Tailwind 4 y React Router. Contiene el shell, rutas, Canvas 2D, controles,
accesibilidad, importacion/exportacion y adaptadores de persistencia. Zustand mantiene el estado de
sesion y Dexie guarda cuatro espacios y preferencias en IndexedDB.

### Fisica

Funciones puras, deterministas y sin dependencia del DOM. El paquete contiene contratos, validacion,
transformacion potencia/velocidad, fuerzas, viento, RK4, Euler semimplicito, colisiones continuas,
solucion analitica de referencia y orquestacion segura de simulaciones. Ningun modulo importa React.

```text
physics/
  analytic.ts       solucion cerrada para aceleracion constante
  collisions.ts     suelo, segmentos, circulos y limites
  forces.ts         composicion de gravedad, aceleracion y viento
  integrators.ts    RK4 y Euler semimplicito
  power.ts          potencia configurable a velocidad inicial
  simulation.ts     bucle, apice, impacto, terminacion y resultado
  types.ts          contratos publicos
  validation.ts     limites, finitud y mensajes
  wind.ts           polar, aceleracion directa y arrastre lineal
```

### Moviles

Contratos de perfiles y disparos. El registro esta vacio intencionalmente hasta verificar nombres y
constantes. Un perfil exige estado, version y fuente.

### Calibracion

Contratos de observacion y calculo de residuos. La optimizacion futura consumira conjuntos separados
de entrenamiento y evaluacion; no podra sobrescribir parametros base sin versionarlos.

### Vision

Valida tipos y tamanos de imagen. Las fases posteriores agregaran recorte, coordenadas, detecciones y
correccion manual, sin captura continua.

## Persistencia

IndexedDB contiene dos tablas versionadas:

- `workspaces`: clave `id`, cuatro registros con lanzamiento, objetivo y fecha de cambio.
- `settings`: clave constante `app`, espacio activo y preferencias visuales.

Cada workspace incluye controles de simulacion. El esquema Zod asigna defaults de Fase 2 al leer un
registro de Fase 1, de modo que coordenadas y nombres existentes se conservan sin una migracion
destructiva. La hidratacion valida y recupera cada ID por separado: un registro ausente o invalido se
repara con su default sin reemplazar sus tres hermanos validos. Los cambios se serializan en una cola
por workspace y los ajustes en otra cola, evitando que una escritura lenta de una edicion anterior
sobrescriba una edicion rapida posterior.

La importacion acepta como maximo 1 MB, exige JSON version 1 y valida el documento completo con Zod
antes de escribir una transaccion. La exportacion no incluye credenciales ni datos de juegos.

## Manejo de errores

- Error Boundary captura fallos de render y ofrece recarga.
- La hidratacion local degrada a defaults y expone un aviso si IndexedDB falla.
- Los esquemas rechazan valores no finitos, archivos incompatibles y documentos de otra version.
- Las rutas desconocidas muestran una pagina real de recuperacion.

## Rendimiento

Canvas ajusta su backing store al `devicePixelRatio`. React memoiza entradas y resultados, por lo que
la simulacion solo se repite cuando cambia el workspace o sus parametros. El Canvas recibe puntos ya
calculados y solo convierte mundo a pantalla. El solucionador futuro se movera a Web Workers si una
medicion reproducible muestra bloqueo; la simulacion individual actual no justifica ese costo.

## Integracion de Fase 2

`WorkbenchPage` adapta controles persistidos a `SimulationInput` y llama a `simulateProjectile` dentro
de `useMemo`. El Canvas dibuja trayectoria primaria, comparacion opcional, objetivo, impacto y apice.
Los cuatro espacios siguen siendo independientes; importar/exportar incluye los controles porque son
parte del workspace validado.

## Distribucion Windows

Tauri se pospone hasta estabilizar el motor web. El entorno tiene Rust disponible, pero empaquetar en
Fase 1 agregaria superficie de permisos sin aportar validacion matematica.
