import {
  Activity,
  Camera,
  Download,
  Eye,
  FileVideo2,
  Pause,
  Play,
  ScanEye,
  Square,
  Target,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  normalizedRegion,
  VISION_KINDS,
  type VisionFrameRequest,
  type VisionFrameResult,
  type VisionKind,
  type VisionRegion,
} from '../features/vision/vision-model';
import '../features/vision/vision.css';

type Source = 'none' | 'capture' | 'video' | 'image';

function download(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function VisionPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const samplingCanvas = useRef<HTMLCanvasElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileUrlRef = useRef<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const sessionRef = useRef(0);
  const frameRef = useRef(0);
  const inFlightRef = useRef(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const nextRegionId = useRef(0);

  const [source, setSource] = useState<Source>('none');
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [regions, setRegions] = useState<VisionRegion[]>([]);
  const [regionKind, setRegionKind] = useState<VisionKind>('wind');
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<ReturnType<typeof normalizedRegion> | null>(null);
  const [paused, setPaused] = useState(false);
  const [frame, setFrame] = useState<VisionFrameResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL('../features/vision/vision.worker.ts', import.meta.url), {
      type: 'module',
      name: 'dragonballistics-vision',
    });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<VisionFrameResult>) => {
      const result = event.data;
      if (result?.type !== 'FRAME_RESULT' || result.sessionId !== sessionRef.current) return;
      inFlightRef.current = false;
      setFrame(result);
    };
    worker.onerror = () => {
      inFlightRef.current = false;
      setProblem('El procesador visual encontró un error. Detén y reinicia la fuente.');
    };
    return () => {
      sessionRef.current += 1;
      worker.terminate();
      workerRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    };
  }, []);

  function stopSource(): void {
    sessionRef.current += 1;
    inFlightRef.current = false;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
      video.removeAttribute('src');
      video.load();
    }
    if (imageRef.current) imageRef.current.removeAttribute('src');
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    fileUrlRef.current = null;
    setSource('none');
    setDimensions({ width: 0, height: 0 });
    setFrame(null);
    setPaused(false);
    setDraft(null);
    setDrawing(false);
  }

  async function shareTab(): Promise<void> {
    stopSource();
    setProblem(null);
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setProblem('La captura necesita Chrome actualizado y localhost o HTTPS.');
      return;
    }
    const session = sessionRef.current;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 10, max: 15 } },
        audio: false,
      });
      if (session !== sessionRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      track?.addEventListener('ended', () => {
        if (session === sessionRef.current) stopSource();
      });
      setSource('capture');
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        try {
          await video.play();
        } catch {
          setProblem('No se inició la vista previa. Revisa el permiso de la pestaña.');
        }
      }
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'No fue posible compartir la pestaña.');
    }
  }

  function importFile(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['video/mp4', 'video/webm', 'image/png', 'image/jpeg'].includes(file.type)) {
      setProblem('Formato no compatible. Utiliza PNG, JPEG, MP4 o WebM.');
      return;
    }
    stopSource();
    setProblem(null);
    const url = URL.createObjectURL(file);
    fileUrlRef.current = url;
    if (file.type.startsWith('video/')) {
      setSource('video');
      if (videoRef.current) {
        videoRef.current.src = url;
        videoRef.current.load();
      }
    } else {
      setSource('image');
      if (imageRef.current) imageRef.current.src = url;
    }
  }

  useEffect(() => {
    if (source === 'none' || paused || dimensions.width < 1 || dimensions.height < 1) return;
    const interval = window.setInterval(() => {
      if (inFlightRef.current || !workerRef.current || !samplingCanvas.current) return;
      const element = source === 'image' ? imageRef.current : videoRef.current;
      if (!element) return;
      if (source !== 'image' && (element as HTMLVideoElement).readyState < 2) return;
      const width = Math.min(640, dimensions.width);
      const height = Math.max(1, Math.round((dimensions.height / dimensions.width) * width));
      const canvas = samplingCanvas.current;
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;
      try {
        context.drawImage(element, 0, 0, width, height);
        const pixels = context.getImageData(0, 0, width, height).data;
        const request: VisionFrameRequest = {
          type: 'FRAME',
          sessionId: sessionRef.current,
          frameId: ++frameRef.current,
          width,
          height,
          pixels,
          regions,
        };
        inFlightRef.current = true;
        workerRef.current.postMessage(request, [pixels.buffer as ArrayBuffer]);
      } catch {
        inFlightRef.current = false;
        setProblem('No se pudo leer el fotograma de esta fuente.');
      }
    }, 200);
    return () => window.clearInterval(interval);
  }, [dimensions, paused, regions, source]);

  function pointer(event: ReactPointerEvent<SVGSVGElement>) {
    const rectangle = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - rectangle.left) / rectangle.width,
      y: (event.clientY - rectangle.top) / rectangle.height,
    };
  }

  function startDrawing(event: ReactPointerEvent<SVGSVGElement>): void {
    if (!drawing || source === 'none') return;
    dragStart.current = pointer(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraft(normalizedRegion(dragStart.current, dragStart.current));
  }

  function moveDrawing(event: ReactPointerEvent<SVGSVGElement>): void {
    if (!dragStart.current) return;
    setDraft(normalizedRegion(dragStart.current, pointer(event)));
  }

  function finishDrawing(event: ReactPointerEvent<SVGSVGElement>): void {
    if (!dragStart.current) return;
    const geometry = normalizedRegion(dragStart.current, pointer(event));
    dragStart.current = null;
    setDraft(null);
    if (geometry.width < 0.012 || geometry.height < 0.012) return;
    const label = VISION_KINDS.find((item) => item.value === regionKind)?.label ?? 'Región';
    const id = String(++nextRegionId.current);
    setRegions((previous) => [
      ...previous.slice(-23),
      { id, kind: regionKind, label, ...geometry },
    ]);
    setDrawing(false);
  }

  function exportData(): void {
    download(
      'dragonballistics-vision-analysis.json',
      new Blob(
        [
          JSON.stringify(
            {
              schema: 'dragonballistics-vision-mvp-1',
              exportedAt: new Date().toISOString(),
              source,
              dimensions,
              regions,
              metrics: frame?.regions ?? [],
              note: 'Datos visuales sin calibración física. No son mediciones confirmadas de viento o posición.',
            },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      ),
    );
  }

  function saveFrame(): void {
    const element = source === 'image' ? imageRef.current : videoRef.current;
    if (!element || !dimensions.width || !dimensions.height) return;
    const canvas = document.createElement('canvas');
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(element, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) download('vision-frame.png', blob);
    }, 'image/png');
  }

  return (
    <div className="vision-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">VISIÓN COMPUTACIONAL · MVP</p>
          <h1>DragonBallistics Vision</h1>
          <p>
            Captura consentida, fotogramas y diagnóstico visual local. Los detectores físicos aún
            necesitan calibración.
          </p>
        </div>
        <div className="phase-badge">
          <ScanEye size={17} aria-hidden="true" />
          <span>
            <strong>Laboratorio visual</strong>Sin conexión al cliente del juego
          </span>
        </div>
      </header>

      <section className="vision-toolbar panel" aria-label="Controles de captura">
        <button className="button primary" type="button" onClick={() => void shareTab()}>
          <Camera size={16} aria-hidden="true" /> Compartir pestaña
        </button>
        <button className="button ghost" type="button" onClick={() => fileInput.current?.click()}>
          <Upload size={16} aria-hidden="true" /> Importar imagen o video
        </button>
        <input
          ref={fileInput}
          className="visually-hidden"
          type="file"
          accept="image/png,image/jpeg,video/mp4,video/webm,.png,.jpg,.jpeg,.mp4,.webm"
          onChange={importFile}
        />
        <button
          className="button ghost"
          type="button"
          disabled={source === 'none'}
          onClick={() => {
            setPaused((p) => !p);
            if (source === 'video') {
              if (paused) void videoRef.current?.play();
              else videoRef.current?.pause();
            }
          }}
        >
          {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
          {paused ? 'Continuar análisis' : 'Pausar análisis'}
        </button>
        <button
          className="button ghost"
          type="button"
          disabled={source === 'none'}
          onClick={stopSource}
        >
          <Square size={15} aria-hidden="true" /> Detener
        </button>
        <span className="vision-live-state" data-active={source !== 'none'}>
          {source === 'none'
            ? 'SIN FUENTE'
            : source === 'capture'
              ? 'CAPTURA CON PERMISO'
              : 'ARCHIVO LOCAL'}
        </span>
      </section>

      {problem ? (
        <p role="alert" className="vision-error">
          {problem}
        </p>
      ) : null}

      <section className="vision-layout">
        <div className="panel vision-stage-panel">
          <div className="vision-stage-header">
            <strong>
              <Eye size={15} aria-hidden="true" /> Fuente visual
            </strong>
            <span>
              {dimensions.width && dimensions.height
                ? dimensions.width + ' × ' + dimensions.height + ' px'
                : 'Sin señal'}{' '}
              · 5 FPS máximo
            </span>
          </div>
          <div
            className="vision-stage"
            style={{
              aspectRatio:
                dimensions.width && dimensions.height
                  ? String(dimensions.width) + '/' + String(dimensions.height)
                  : '16/9',
            }}
          >
            <video
              ref={videoRef}
              className="vision-media"
              hidden={source !== 'video' && source !== 'capture'}
              muted
              playsInline
              controls={source === 'video'}
              onLoadedMetadata={(event) =>
                setDimensions({
                  width: event.currentTarget.videoWidth,
                  height: event.currentTarget.videoHeight,
                })
              }
            />
            <img
              ref={imageRef}
              className="vision-media"
              hidden={source !== 'image'}
              alt="Fotograma importado para análisis visual"
              onLoad={(event) =>
                setDimensions({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })
              }
            />
            {source === 'none' ? (
              <div className="vision-empty">
                <ScanEye size={35} aria-hidden="true" />
                <strong>No hay imágenes</strong>
                <span>Comparte una pestaña o importa una grabación para comenzar.</span>
              </div>
            ) : null}
            <svg
              className="vision-overlay"
              viewBox="0 0 1000 1000"
              preserveAspectRatio="none"
              role="img"
              aria-label="Regiones de análisis visual"
              data-drawing={drawing}
              onPointerDown={startDrawing}
              onPointerMove={moveDrawing}
              onPointerUp={finishDrawing}
              onPointerCancel={() => {
                dragStart.current = null;
                setDraft(null);
              }}
            >
              {regions.map((region) => (
                <g key={region.id}>
                  <rect
                    x={region.x * 1000}
                    y={region.y * 1000}
                    width={region.width * 1000}
                    height={region.height * 1000}
                    className="vision-region"
                  />
                  <text
                    x={region.x * 1000 + 6}
                    y={region.y * 1000 + 20}
                    className="vision-region-label"
                  >
                    {region.label}
                  </text>
                </g>
              ))}
              {draft ? (
                <rect
                  x={draft.x * 1000}
                  y={draft.y * 1000}
                  width={draft.width * 1000}
                  height={draft.height * 1000}
                  className="vision-region vision-region-draft"
                />
              ) : null}
            </svg>
          </div>
          <canvas ref={samplingCanvas} hidden aria-hidden="true" />
          <div className="vision-stage-footer">
            <span>
              <Activity size={14} aria-hidden="true" />{' '}
              {frame
                ? 'Fotograma ' + frame.frameId + ' · análisis ' + frame.elapsedMs.toFixed(1) + ' ms'
                : 'Esperando fotogramas'}
            </span>
            <div>
              <button
                type="button"
                className="button ghost"
                disabled={source === 'none'}
                onClick={saveFrame}
              >
                <Camera size={14} aria-hidden="true" /> PNG
              </button>
              <button
                type="button"
                className="button ghost"
                disabled={source === 'none'}
                onClick={exportData}
              >
                <Download size={14} aria-hidden="true" /> JSON
              </button>
            </div>
          </div>
        </div>

        <aside className="panel vision-inspector">
          <div className="vision-inspector-header">
            <h2>
              <Target size={17} aria-hidden="true" /> Regiones de análisis
            </h2>
            <p>
              Marca manualmente una zona del HUD o del escenario. El Worker calcula métricas
              visuales, no valores físicos.
            </p>
          </div>
          <label className="vision-control">
            <span>Tipo de región</span>
            <select
              value={regionKind}
              onChange={(event) => setRegionKind(event.target.value as VisionKind)}
            >
              {VISION_KINDS.map((kind) => (
                <option key={kind.value} value={kind.value}>
                  {kind.label}
                </option>
              ))}
            </select>
          </label>
          <div className="vision-inspector-actions">
            <button
              type="button"
              className="button primary"
              disabled={source === 'none'}
              aria-pressed={drawing}
              onClick={() => setDrawing((value) => !value)}
            >
              <Target size={14} aria-hidden="true" />{' '}
              {drawing ? 'Cancelar marcado' : 'Marcar región'}
            </button>
            <button
              type="button"
              className="button ghost"
              disabled={regions.length === 0}
              onClick={() => setRegions([])}
            >
              <Trash2 size={14} aria-hidden="true" /> Limpiar
            </button>
          </div>
          {drawing ? (
            <p className="vision-instruction" role="status">
              Arrastra sobre la imagen para delimitar la región.
            </p>
          ) : null}
          <div className="vision-region-list">
            {regions.length === 0 ? (
              <p className="vision-muted">
                No hay regiones marcadas. Puedes empezar por el indicador del viento.
              </p>
            ) : null}
            {regions.map((region) => {
              const metric = frame?.regions.find((item) => item.regionId === region.id);
              return (
                <article className="vision-region-card" key={region.id}>
                  <div className="vision-region-card-head">
                    <strong>
                      {region.label} #{region.id}
                    </strong>
                    <button
                      type="button"
                      aria-label={'Eliminar región ' + region.id}
                      onClick={() =>
                        setRegions((items) => items.filter((item) => item.id !== region.id))
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="vision-metrics">
                    <span>
                      Brillo <b>{metric ? (metric.meanBrightness * 100).toFixed(1) + '%' : '—'}</b>
                    </span>
                    <span>
                      Bordes <b>{metric ? (metric.edgeActivity * 100).toFixed(1) + '%' : '—'}</b>
                    </span>
                    <span>
                      Cambio visual{' '}
                      <b>
                        {metric?.motionActivity == null
                          ? '—'
                          : (metric.motionActivity * 100).toFixed(1) + '%'}
                      </b>
                    </span>
                  </div>
                  <small>Lectura física: pendiente de calibración</small>
                </article>
              );
            })}
          </div>
          <div className="vision-disclaimer">
            <strong>Qué reconoce esta versión</strong>
            <p>
              Procesa imágenes y mide actividad en zonas que marques. Todavía no interpreta la
              magnitud del viento, identifica vehículos ni calcula el efecto físico de remolinos.
              Necesitamos ejemplos reales etiquetados.
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
}
