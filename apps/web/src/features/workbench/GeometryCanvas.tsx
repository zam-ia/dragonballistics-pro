import { screenToWorld, worldToScreen, type ViewportTransform } from '@dragonballistics/physics';
import type { Vec2 } from '@dragonballistics/shared';
import { useEffect, useMemo, useRef, useState } from 'react';

interface GeometryCanvasProps {
  launch: Vec2;
  target: Vec2;
  showGrid: boolean;
  targetRadius: number;
  inversePath: readonly Vec2[];
  inverseImpact: Vec2 | null;
  inverseApex: Vec2 | null;
  inverseComparisonPath: readonly Vec2[];
  inverseComparisonImpact: Vec2 | null;
  inverseComparisonApex: Vec2 | null;
  primaryPath: readonly Vec2[];
  comparisonPath: readonly Vec2[];
  primaryImpact: Vec2 | null;
  comparisonImpact: Vec2 | null;
  primaryApex: Vec2;
  comparisonApex: Vec2 | null;
  onPointChange: (kind: 'launch' | 'target', point: Vec2) => void;
}

type DragTarget = 'launch' | 'target' | null;

const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 400;
const PADDING = 38;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function distanceInPixels(a: Vec2, b: Vec2) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function GeometryCanvas({
  launch,
  target,
  showGrid,
  targetRadius,
  inversePath,
  inverseImpact,
  inverseApex,
  inverseComparisonPath,
  inverseComparisonImpact,
  inverseComparisonApex,
  primaryPath,
  comparisonPath,
  primaryImpact,
  comparisonImpact,
  primaryApex,
  comparisonApex,
  onPointChange,
}: GeometryCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragTarget>(null);
  const [size, setSize] = useState({ width: 900, height: 480 });

  const transform: ViewportTransform = useMemo(
    () => ({
      origin: { x: PADDING, y: PADDING },
      pixelsPerUnit: Math.max(
        0.25,
        Math.min(
          (size.width - PADDING * 2) / WORLD_WIDTH,
          (size.height - PADDING * 2) / WORLD_HEIGHT,
        ),
      ),
      heightPixels: size.height,
    }),
    [size],
  );

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({
        width: Math.max(320, Math.floor(entry.contentRect.width)),
        height: Math.max(320, Math.floor(entry.contentRect.height)),
      });
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(size.width * ratio);
    canvas.height = Math.floor(size.height * ratio);
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, size.width, size.height);

    const style = getComputedStyle(document.documentElement);
    const gridColor = style.getPropertyValue('--canvas-grid').trim() || '#263244';
    const textColor = style.getPropertyValue('--text-muted').trim() || '#9caabd';
    const surfaceColor = style.getPropertyValue('--canvas-surface').trim() || '#0d1420';
    context.fillStyle = surfaceColor;
    context.fillRect(0, 0, size.width, size.height);

    if (showGrid) {
      context.strokeStyle = gridColor;
      context.lineWidth = 1;
      context.font = '11px Inter, system-ui, sans-serif';
      context.fillStyle = textColor;
      for (let x = 0; x <= WORLD_WIDTH; x += 50) {
        const from = worldToScreen({ x, y: 0 }, transform);
        const to = worldToScreen({ x, y: WORLD_HEIGHT }, transform);
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y);
        context.stroke();
        if (x % 100 === 0) context.fillText(String(x), from.x + 4, from.y - 8);
      }
      for (let y = 0; y <= WORLD_HEIGHT; y += 50) {
        const from = worldToScreen({ x: 0, y }, transform);
        const to = worldToScreen({ x: WORLD_WIDTH, y }, transform);
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y);
        context.stroke();
        if (y > 0 && y % 100 === 0) context.fillText(String(y), from.x + 5, from.y - 6);
      }
    }

    const launchScreen = worldToScreen(launch, transform);
    const targetScreen = worldToScreen(target, transform);
    context.setLineDash([7, 7]);
    context.strokeStyle = '#668196';
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(launchScreen.x, launchScreen.y);
    context.lineTo(targetScreen.x, targetScreen.y);
    context.stroke();
    context.setLineDash([]);

    drawPath(context, primaryPath, transform, '#3dd6d0', false);
    if (comparisonPath.length > 0) {
      drawPath(context, comparisonPath, transform, '#a78bfa', true);
    }
    if (inversePath.length > 0) drawPath(context, inversePath, transform, '#fb7185', false);
    if (inverseComparisonPath.length > 0) {
      drawPath(context, inverseComparisonPath, transform, '#facc15', true);
    }

    drawTargetRadius(context, targetScreen, targetRadius * transform.pixelsPerUnit);
    drawApex(context, worldToScreen(primaryApex, transform), '#3dd6d0');
    if (comparisonApex) {
      drawApex(context, worldToScreen(comparisonApex, transform), '#a78bfa');
    }
    if (inverseApex) drawApex(context, worldToScreen(inverseApex, transform), '#fb7185');
    if (inverseComparisonApex)
      drawApex(context, worldToScreen(inverseComparisonApex, transform), '#facc15');
    if (primaryImpact) {
      drawImpact(context, worldToScreen(primaryImpact, transform), '#3dd6d0');
    }
    if (comparisonImpact) {
      drawImpact(context, worldToScreen(comparisonImpact, transform), '#a78bfa');
    }
    if (inverseImpact) drawImpact(context, worldToScreen(inverseImpact, transform), '#fb7185');
    if (inverseComparisonImpact)
      drawImpact(context, worldToScreen(inverseComparisonImpact, transform), '#facc15');

    drawPoint(context, launchScreen, '#3dd6d0', 'LANZAMIENTO');
    drawPoint(context, targetScreen, '#f4b860', 'OBJETIVO');
  }, [
    comparisonApex,
    comparisonImpact,
    comparisonPath,
    inverseApex,
    inverseImpact,
    inversePath,
    inverseComparisonApex,
    inverseComparisonImpact,
    inverseComparisonPath,
    targetRadius,
    launch,
    primaryApex,
    primaryImpact,
    primaryPath,
    showGrid,
    size,
    target,
    transform,
  ]);

  function getPointerPosition(event: React.PointerEvent<HTMLCanvasElement>): Vec2 {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const pointer = getPointerPosition(event);
    const launchScreen = worldToScreen(launch, transform);
    const targetScreen = worldToScreen(target, transform);
    const launchDistance = distanceInPixels(pointer, launchScreen);
    const targetDistance = distanceInPixels(pointer, targetScreen);
    dragRef.current = launchDistance <= targetDistance ? 'launch' : 'target';
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPointer(pointer);
  }

  function updateFromPointer(pointer: Vec2) {
    if (!dragRef.current) return;
    const world = screenToWorld(pointer, transform);
    onPointChange(dragRef.current, {
      x: Number(clamp(world.x, 0, WORLD_WIDTH).toFixed(1)),
      y: Number(clamp(world.y, 0, WORLD_HEIGHT).toFixed(1)),
    });
  }

  return (
    <div ref={frameRef} className="geometry-canvas-frame">
      <canvas
        ref={canvasRef}
        data-inverse-overlay={inversePath.length > 0 ? 'visible' : 'hidden'}
        data-inverse-comparison={inverseComparisonPath.length > 0 ? 'visible' : 'hidden'}
        className="geometry-canvas"
        aria-label="Plano cartesiano interactivo; arrastra el punto de lanzamiento o el objetivo"
        onPointerDown={handlePointerDown}
        onPointerMove={(event) => updateFromPointer(getPointerPosition(event))}
        onPointerUp={() => {
          dragRef.current = null;
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
      />
      <span className="canvas-hint">ARRASTRA LOS PUNTOS · MUNDO 800 × 400 U</span>
    </div>
  );
}

function drawPoint(context: CanvasRenderingContext2D, point: Vec2, color: string, label: string) {
  context.save();
  context.shadowColor = color;
  context.shadowBlur = 14;
  context.fillStyle = color;
  context.beginPath();
  context.arc(point.x, point.y, 7, 0, Math.PI * 2);
  context.fill();
  context.shadowBlur = 0;
  context.fillStyle = color;
  context.font = '600 10px Inter, system-ui, sans-serif';
  context.fillText(label, point.x + 13, point.y - 11);
  context.restore();
}

function drawPath(
  context: CanvasRenderingContext2D,
  path: readonly Vec2[],
  transform: ViewportTransform,
  color: string,
  dashed: boolean,
) {
  const first = path[0];
  if (!first) return;
  context.save();
  context.strokeStyle = color;
  context.lineWidth = 2.2;
  context.shadowColor = color;
  context.shadowBlur = 5;
  if (dashed) context.setLineDash([8, 5]);
  const start = worldToScreen(first, transform);
  context.beginPath();
  context.moveTo(start.x, start.y);
  for (let index = 1; index < path.length; index += 1) {
    const point = path[index];
    if (!point) continue;
    const screen = worldToScreen(point, transform);
    context.lineTo(screen.x, screen.y);
  }
  context.stroke();
  context.restore();
}

function drawTargetRadius(context: CanvasRenderingContext2D, point: Vec2, radius: number) {
  context.save();
  context.strokeStyle = 'rgba(244, 184, 96, 0.55)';
  context.lineWidth = 1;
  context.setLineDash([3, 3]);
  context.beginPath();
  context.arc(point.x, point.y, Math.max(0, radius), 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function drawApex(context: CanvasRenderingContext2D, point: Vec2, color: string) {
  context.save();
  context.translate(point.x, point.y);
  context.rotate(Math.PI / 4);
  context.fillStyle = color;
  context.fillRect(-4, -4, 8, 8);
  context.restore();
  context.fillStyle = color;
  context.font = '700 8px Inter, system-ui, sans-serif';
  context.fillText('APEX', point.x + 8, point.y - 8);
}

function drawImpact(context: CanvasRenderingContext2D, point: Vec2, color: string) {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(point.x - 6, point.y - 6);
  context.lineTo(point.x + 6, point.y + 6);
  context.moveTo(point.x + 6, point.y - 6);
  context.lineTo(point.x - 6, point.y + 6);
  context.stroke();
  context.restore();
}
