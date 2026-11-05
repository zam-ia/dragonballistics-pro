# Modelo de datos

## Principios

- Zod valida toda entrada externa y cada registro persistido.
- Los tipos TypeScript se infieren desde el esquema cuando sea posible.
- Los documentos exportados incluyen discriminador y version.
- Fechas se guardan como ISO 8601 UTC.
- Valores no finitos no son validos.

## Entidades implementadas

### `Vec2`

```text
{ x: number finito, y: number finito }
```

No expresa pixeles; su unidad depende del contexto tipado. Fase 2 introducira tipos de marca si una
revision demuestra que son necesarios para evitar mezclas.

### `Workspace`

```text
id          workspace-1 | workspace-2 | workspace-3 | workspace-4
name        1..48 caracteres
launch      Vec2
target      Vec2
updatedAt   ISO 8601 UTC
```

### `AppPreferences`

Tema (`dark`, `light`, `system`), densidad (`comfortable`, `compact`), cuadricula y movimiento
reducido.

### `ExportBundle` version 1

Contiene exactamente cuatro espacios, espacio activo, preferencias y fecha de generacion. Se valida
completo antes de una escritura atomica en IndexedDB.

### `MobileProfile`

Exige identificador, nombre, descripcion, estado, version, fuente y disparos. La fuente contiene una
etiqueta obligatoria y URL/fecha opcionales. El registro de produccion esta vacio en Fase 1.

### `ExperimentObservation`

Contrato inicial para motor, perfil, disparo, impacto predicho y observado, confianza, validacion y
fecha. El calculo de error conserva residuos X/Y con signo y magnitud euclidiana.

### `ImageMetadata`

Nombre maximo 255, tamaño positivo maximo 20 MiB y MIME PNG, JPEG o WebP. Validar metadatos no
reemplaza la futura inspeccion de firma binaria y dimensiones.

## Migraciones

Dexie inicia en version 1. Toda ampliacion debe:

1. agregar una version de esquema;
2. transformar registros existentes dentro de la migracion;
3. conservar exportacion de la version anterior o emitir un error explicito;
4. tener prueba de actualizacion y rollback por exportacion.

## Datos futuros

Fase 2 agregara `SimulationInput`, `SimulationResult`, `TrajectoryPoint` y `TerminationReason`. Fases de
calibracion agregaran `ParameterSet`, `DatasetSplit`, `CalibrationRun` y `EvaluationReport`. Estos
contratos no se declaran prematuramente como terminados.
