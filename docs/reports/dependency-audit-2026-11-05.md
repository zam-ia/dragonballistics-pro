# Auditoria de dependencias - 2026-11-05

## Alerta identificada

| Campo                               | Valor                                                           |
| ----------------------------------- | --------------------------------------------------------------- |
| Paquete                             | `minimatch`                                                     |
| Version instalada antes de corregir | `10.2.6`                                                        |
| Aviso                               | `GHSA-g3hv-75wg-m249` / CWE-405                                 |
| Severidad                           | Moderada                                                        |
| Descripcion                         | amplificacion de `globparts` con posible denegacion de servicio |
| Rango vulnerable                    | `>=7.0.0 <11.0.1`                                               |
| Primera version corregida           | `11.0.1`                                                        |
| Alcance                             | dependencia transitiva de desarrollo                            |
| Rutas principales                   | `eslint`, `@eslint/config-array` y `typescript-eslint`          |
| Dependabot                          | alerta #1 en la rama por defecto                                |

## Riesgo para este proyecto

`minimatch` no forma parte del bundle web ni procesa entradas de usuarios en produccion. Se ejecuta en
herramientas locales y CI para resolver patrones del repositorio. Por ello el riesgo de explotacion en
la aplicacion publicada es bajo; el riesgo relevante era consumo excesivo de CPU en desarrollo o CI
si se introducia un patron glob adversarial. La alerta no se ignoro pese a ese alcance limitado.

## Correccion y compatibilidad

`pnpm-workspace.yaml` aplica un override global a `minimatch 11.0.1`, porque ESLint 10.14.0 aun declara
el rango vulnerable `^10.2.6`. Tras regenerar el lockfile:

- `pnpm why minimatch` muestra una sola version: `11.0.1`;
- `pnpm audit --json` informa 0 vulnerabilidades;
- ESLint completa sin errores ni advertencias;
- las pruebas, TypeScript y el build verifican la compatibilidad efectiva del override.

Dependabot seguira mostrando la alerta sobre `main` mientras el PR #1 no se fusione. Debe comprobarse
su cierre despues de un merge aprobado; este documento no autoriza el merge.
