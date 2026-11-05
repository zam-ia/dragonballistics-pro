# Requisitos de producto

## Proposito

DragonBallistics Pro permite construir y evaluar modelos balisticos 2D independientes. Su salida es
una prediccion de un modelo configurable, no una afirmacion de equivalencia con DragonBound,
GunBound u otro juego comercial.

## Usuarios y tareas

- Investigador: define escenarios reproducibles y compara integradores.
- Calibrador: registra impactos observados y ajusta parametros con evidencia.
- Usuario manual: mide geometria rapidamente y conserva cuatro contextos locales.
- Desarrollador: agrega modelos sin acoplar UI, almacenamiento y matematicas.

## Alcance de Fase 0 y Fase 1

### Obligatorio y entregado

- Arquitectura, modelo de datos, modelo fisico propuesto, investigacion y estrategia de pruebas.
- Aplicacion web instalable, navegable, responsive y sin botones falsos.
- Rutas `/`, `/research` y `/settings`, mas recuperacion de rutas desconocidas.
- Cuatro espacios locales con nombre, lanzamiento y objetivo.
- Canvas cartesiano interactivo y mediciones geometricas exactas.
- Preferencias de tema, densidad, cuadricula y movimiento reducido.
- Importacion/exportacion JSON transaccional y validada.
- Lint, TypeScript estricto, pruebas unitarias, pruebas E2E, build y CI.

### Fuera de alcance de esta entrega

- Trayectorias de proyectil, gravedad, viento, solucionador o colisiones.
- Perfiles numericos de moviles.
- Deteccion de elementos dentro de imagenes.
- Calibracion numerica o aprendizaje automatico.
- Historial de experimentos y metricas.
- Empaquetado Tauri.

La interfaz no presenta esos elementos como disponibles.

## Requisitos funcionales futuros

### RF-02 Motor fisico

Simular un proyectil desde un estado inicial, con fuerzas y limites explicitamente versionados. Debe
devolver puntos, impacto, tiempo, distancia y causa de terminacion.

### RF-03 Solucionador

Buscar varias soluciones dentro de intervalos de angulo y potencia, ordenar por error y explicar la
ausencia de solucion.

### RF-04 Perfiles

Registrar nombres y parametros con fuente, estado de calibracion y version. Nunca completar un perfil
con constantes inventadas.

### RF-05 Imagenes guardadas

Importar PNG/JPEG/WebP, medir y anotar con correccion manual. No hay captura continua ni integracion
con clientes comerciales.

### RF-06 Evidencia

Cada observacion conserva motor, perfil, condiciones, prediccion, impacto observado, confianza y
estado de validacion.

## Requisitos no funcionales

- RNF-01: funciones fisicas puras y reproducibles.
- RNF-02: TypeScript estricto sin `any` implicito.
- RNF-03: ningun calculo intensivo bloqueara interacciones por mas de 100 ms en el equipo de prueba.
- RNF-04: importaciones limitadas, versionadas y validadas; no se ejecuta contenido importado.
- RNF-05: operacion local y sin telemetria.
- RNF-06: controles utilizables por teclado y contraste visible.
- RNF-07: ninguna funcion se marca completa sin prueba y acceso desde la aplicacion.

## Criterio de aceptacion de Fase 1

Instalacion limpia, inicio de desarrollo, rutas navegables, recarga con persistencia, TypeScript,
lint, pruebas, build y recorrido E2E deben finalizar correctamente. El roadmap solo puede cambiar a
“Completado” despues de registrar esos resultados.
