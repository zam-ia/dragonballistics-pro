# Informe de verificacion de Fase 0 y Fase 1

Fecha: 2026-11-05  
Plataforma: Windows  
Node: 24.14.1  
pnpm: 11.25.0  
TypeScript: 6.0.3

## Resultado

Fase 0 y Fase 1 cumplen la puerta de salida definida. La aplicacion inicia desde el build de
produccion, las rutas principales funcionan, los datos externos se validan, TypeScript compila, las
pruebas pasan y no hay controles visibles que simulen funciones futuras.

## Funciones verificadas

- Ruta `/`: laboratorio geometrico real con Canvas 2D, coordenadas editables, arrastre y mediciones.
- Ruta `/research`: cinco referencias, licencias y decisiones visibles.
- Ruta `/settings`: tema, densidad, cuadricula y movimiento reducido persistentes.
- Ruta desconocida: pagina de recuperacion con enlace funcional.
- Cuatro espacios: valores independientes y selector operativo.
- Persistencia: una coordenada editada permanece despues de recargar el navegador.
- Importar: limite de 1 MB, MIME/JSON y esquema version 1 validados antes de una transaccion.
- Exportar: descarga JSON real con los cuatro espacios y preferencias.
- Responsive: revision visual de escritorio 1440 × 900 y movil 390 × 844.

## Contratos verificados

- `Vec2`, `Workspace`, `AppPreferences` y `ExportBundle` en `packages/shared`.
- `ViewportTransform` y geometria pura en `packages/physics`.
- `MobileProfile` con estado, version y procedencia obligatoria; registro vacio para no inventar datos.
- `ExperimentObservation` y error observado en `packages/calibration`.
- `ImageMetadata` con MIME y limite de 20 MiB en `packages/vision`.

## Comandos y resultados

| Comando             | Resultado                                             |
| ------------------- | ----------------------------------------------------- |
| `pnpm install`      | correcto; 7 proyectos del workspace y lockfile creado |
| `pnpm format:check` | correcto; todos los archivos conformes                |
| `pnpm lint`         | correcto; 0 errores, 0 advertencias                   |
| `pnpm typecheck`    | correcto; `tsc -b` sin errores                        |
| `pnpm test`         | correcto; 6 archivos, 12 pruebas                      |
| `pnpm build`        | correcto; 2,178 modulos transformados                 |
| `pnpm test:e2e`     | correcto; 2 pruebas Chromium                          |

## Auditoria de controles

- Importar y Exportar ejecutan operaciones reales.
- El selector de espacio cambia estado real.
- Los campos de coordenadas y el Canvas actualizan y persisten datos.
- Los enlaces de navegacion cambian rutas reales.
- Los ajustes modifican la interfaz y se guardan.
- No se muestran botones para simular, resolver, calibrar, detectar o empaquetar porque esas funciones
  no existen todavia.

La etiqueta “Motor fisico pendiente” hace explicito el limite de esta entrega.

## Incidencias corregidas durante QA

1. React detecto una sincronizacion de estado redundante en el nombre del espacio; se reemplazo por un
   remount controlado por identidad/nombre.
2. TypeScript estricto exigio declarar el override del estado del Error Boundary.
3. En 390 px, el texto de Importar/Exportar se superponia; en movil ahora se muestran botones de icono
   con etiquetas accesibles heredadas del contenido.

## Pendiente

- Todo el motor de Fase 2: contratos de simulacion, integradores, fuerzas, colisiones y pruebas
  analiticas.
- Solucionador, perfiles numericos verificados, viento, vision, calibracion, historial y metricas.
- Presupuestos de rendimiento medidos con el motor real.
- Tauri, ejecutable e instalador Windows.

No se inicio ninguna de estas fases.
