# Analisis de repositorios de referencia

Fecha de revision: 2026-11-05  
Metodo: inspeccion del arbol y archivos publicos en GitHub; no se ejecuto codigo de terceros.  
Resultado: ningun repositorio se incorpora como dependencia de ejecucion y no se copio codigo.

## Matriz ejecutiva

| Repositorio                                                                                   | Revision inspeccionada | Lenguaje   | Licencia comprobada | Uso decidido                               |
| --------------------------------------------------------------------------------------------- | ---------------------- | ---------- | ------------------- | ------------------------------------------ |
| [remcostoeten/Gunbound](https://github.com/remcostoeten/Gunbound)                             | `3e807036f444`         | TypeScript | MIT                 | Inspiracion arquitectonica con atribucion  |
| [SanjoSolutions/gunbound-aimbot](https://github.com/SanjoSolutions/gunbound-aimbot)           | `cab943ce0a6a`         | Python     | Unlicense           | Conceptos matematicos; excluir integracion |
| [RxFaX/Aimbot-DragonBound](https://github.com/RxFaX/Aimbot-DragonBound)                       | `f9b8769a439d`         | JavaScript | No publicada        | No reutilizar                              |
| [fsbertelli/gunbound-advanced-aimbot](https://github.com/fsbertelli/gunbound-advanced-aimbot) | `001f507907e0`         | Python     | No publicada        | No reutilizar; validar ideas desde cero    |
| [wZVanG/dragonbound-helper](https://github.com/wZVanG/dragonbound-helper)                     | `3043b9559929`         | JavaScript | No publicada        | Referencia visual historica, no reutilizar |

La ausencia de una licencia publicada no equivale a permiso de uso. Esos tres repositorios se tratan
como “todos los derechos reservados” para fines de incorporacion al producto.

## A. remcostoeten/Gunbound

URL: <https://github.com/remcostoeten/Gunbound>  
Rama: `master`  
Actividad revisada: commit del 2026-05-29.  
Licencia: MIT, archivo `LICENSE`; exige conservar aviso de copyright y permiso en copias sustanciales.

### Arquitectura observada

Aplicacion TypeScript/React de juego multijugador con servidor SpacetimeDB. La logica del cliente se
organiza por funciones dentro de `src/features/game`; los archivos relevantes separan `physics.ts`,
`collision.ts`, `terrain.ts` y `wind.ts`. El repositorio tambien contiene autenticacion, lobbies,
audio, arte, estado multijugador y servidor, elementos innecesarios para este laboratorio local.

### Funciones relevantes

- Estado de proyectil actualizado por pasos.
- Fuerzas de viento y gravedad aplicadas en el motor.
- Barrido entre posiciones para colision con terreno y jugadores.
- Terreno y render separados de la actualizacion fisica.
- TypeScript y pruebas E2E en un producto web reciente.

### Limitaciones

Sus constantes (`530`, coeficientes de viento y escalas) son decisiones de ese juego, no mediciones de
DragonBound. Su fisica esta integrada con entidades, clima, tecnicas de tiro y red del producto. Copiar
el modulo arrastraria supuestos y tipos ajenos.

### Decision

Adoptar la separacion conceptual de modulos y la deteccion de colision por segmento. Implementar
ecuaciones, tipos y pruebas propios. Si en el futuro se incorpora un fragmento sustancial, registrar
archivo/commit y agregar su aviso MIT; en Fase 1 no se incorporo ninguno.

## B. SanjoSolutions/gunbound-aimbot

URL: <https://github.com/SanjoSolutions/gunbound-aimbot>  
Rama: `main`  
Actividad revisada: commit del 2026-09-16.  
Licencia: Unlicense en `LICENSE`.

### Arquitectura observada

Aplicacion Python 3.8 centrada en `main.py`, con una ventana PyQt5 transparente y dependencias Windows.
No presenta separacion limpia entre adquisicion de datos, calculo, visualizacion y control.

### Funciones relevantes

- Representacion historica de posicion, angulo, viento y parametros por movil.
- Busqueda o evaluacion de potencia y dibujo de una trayectoria.
- Ventana transparente siempre visible como antecedente de UX.

### Componentes excluidos

`main.py` importa `pymem`, captura por `mss`, acceso a pixels, hotkeys, `pyautogui` y pulsacion de
teclas. Lee valores desde memoria de proceso y controla entrada. La carpeta `interception` agrega una
dependencia de controladores. Todo esto queda fuera del alcance y no se copia, aunque la licencia sea
permisiva.

### Decision

Usar solo conocimiento matematico general que tambien puede derivarse de fuentes academicas. La nueva
aplicacion solicita entradas manuales o archivos guardados y nunca accede al proceso del juego.

## C. RxFaX/Aimbot-DragonBound

URL: <https://github.com/RxFaX/Aimbot-DragonBound>  
Rama: `main`  
Actividad revisada: commit del 2022-03-21.  
Licencia: no existe archivo de licencia ni identificador SPDX.

### Arquitectura observada

Extension Chrome Manifest V2 con scripts de fondo, recursos inyectados y un `script.js` de unas 1,400
lineas. Parte del codigo esta ofuscado o minificado y modifica la interfaz/contexto de una pagina de
juego.

### Conceptos observables

El calculo historico recibe posicion inicial, componentes de velocidad/aceleracion, angulo, movil y
viento, y produce posiciones o marcas de potencia. Esto confirma las categorias de entrada/salida,
pero no valida sus constantes.

### Limitaciones y decision

Manifest V2 esta obsoleto, no hay licencia y la extension intercepta o sustituye scripts del juego.
No se incorpora codigo, recursos, constantes ni tecnicas de inyeccion. Solo se conserva la conclusion
abstracta de que los contratos de simulacion deben separar estado inicial, ambiente y resultado.

## D. fsbertelli/gunbound-advanced-aimbot

URL: <https://github.com/fsbertelli/gunbound-advanced-aimbot>  
Rama: `main`  
Actividad revisada: un unico commit del 2025-07-12.  
Licencia: no publicada.

### Arquitectura observada

Separa `core/ballistics.py`, `core/detection.py`, `core/ml_engine.py`, `ui/hud.py` y utilidades. Declara
OpenCV, Tesseract, mss, PyAutoGUI, scikit-learn, SciPy y PyQt5.

### Funciones relevantes

- Capas nominales para balistica, deteccion, aprendizaje y HUD.
- Registro de observaciones y separacion de prediccion respecto de presentacion.
- Interpolacion y regresion como alternativas que requeririan evaluacion.

### Limitaciones verificadas

- No publica licencia.
- Un solo commit limita trazabilidad y madurez.
- El arbol no incluye conjuntos de datos, modelos entrenados ni plantillas que el codigo espera.
- El modulo balistico mezcla tablas, correcciones heuristicas y una parabola simplificada; no demuestra
  equivalencia con un juego.
- El ML no aporta por si mismo particiones independientes, informe de generalizacion o evidencia de
  mejora.
- Captura, OCR y automatizacion en vivo quedan fuera del limite del producto.

### Decision

Mantener la separacion de paquetes, pero definir contratos y pruebas propios. Solo evaluar ML despues
de disponer de suficientes observaciones validadas y un conjunto de prueba separado.

## E. wZVanG/dragonbound-helper

URL: <https://github.com/wZVanG/dragonbound-helper>  
Rama: `master`  
Actividad revisada: commit del 2025-02-03.  
Licencia: no publicada.

### Arquitectura observada

Extension Chrome Manifest V2 con HTML/CSS/jQuery, constantes, imagenes de moviles y mapas, y un helper
que organiza controles de angulo, viento, movil, mapa y potencia. Su manifest solicita acceso a un
dominio externo de calculo.

### Aporte conceptual

La interfaz compacta y la agrupacion de entradas son utiles como referencia de densidad. La aplicacion
nueva conserva controles exactos y cuatro espacios, pero usa componentes propios, accesibles y sin
imagenes o estilos del repositorio.

### Limitaciones y decision

No hay licencia y el flujo depende de un servicio historico que el propio proyecto marca como fuera de
servicio. No se usan su API, recursos o codigo. DragonBallistics Pro funciona localmente.

## Referencia local: Trayectoria Lab Overlay

Se inspecciono el fuente local `TrayectoriaLabOverlay.cs`. Aporta requisitos ya validados por uso:
ventana compacta, cuatro espacios, puntos manuales, perfiles por tiro, regla PX/U y atajos. Se conserva
el ejecutable anterior y se migran solamente los conceptos de cuatro espacios, medicion exacta y
persistencia. No se modifica el binario en esta fase.

## Decision final

El motor sera original, determinista y probado contra soluciones analiticas. Datos provenientes de un
juego comercial entraran solo como conjuntos versionados, con fuente y estado de calibracion. La
arquitectura prohibe adquisicion en vivo, lectura de memoria, inyeccion y control de entrada.
