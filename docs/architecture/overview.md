# Arquitectura de DragonBallistics Pro

Estado: aprobada para Fase 1  
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

Funciones puras, deterministas y sin dependencia del DOM. Fase 1 incluye geometria y transformaciones
reversibles. Fase 2 agregara estado de proyectil, fuerzas, RK4, colisiones y resultados tipados.

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

La importacion acepta como maximo 1 MB, exige JSON version 1 y valida el documento completo con Zod
antes de escribir una transaccion. La exportacion no incluye credenciales ni datos de juegos.

## Manejo de errores

- Error Boundary captura fallos de render y ofrece recarga.
- La hidratacion local degrada a defaults y expone un aviso si IndexedDB falla.
- Los esquemas rechazan valores no finitos, archivos incompatibles y documentos de otra version.
- Las rutas desconocidas muestran una pagina real de recuperacion.

## Rendimiento

Canvas ajusta su backing store al `devicePixelRatio` y redibuja solo ante cambios de geometria,
preferencias o tamaño. El integrador y el solucionador futuros se moveran a Web Workers cuando una
medicion reproducible muestre bloqueo del hilo principal; no se introduce esa complejidad antes.

## Distribucion Windows

Tauri se pospone hasta estabilizar el motor web. El entorno tiene Rust disponible, pero empaquetar en
Fase 1 agregaria superficie de permisos sin aportar validacion matematica.
