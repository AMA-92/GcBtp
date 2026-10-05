import { useEffect, useRef, useState } from "react";
import { modelColor, modelSpec, type ModelSpec } from "@shared/model-catalog";
import { cumulativeGridPositions } from "@shared/proportional-grid";
import {
  columnBaseElevation,
  elementElevation,
  levelElevation,
  levelHeight,
  postTopElevation,
} from "@shared/vertical-structure";
import {
  FOOTING_3D_HALF_X,
  FOOTING_3D_HALF_Y,
  FOOTING_3D_HEIGHT,
} from "@shared/footing-geometry";
import {
  decayRotationVelocity,
  hasVisibleInertia,
} from "@shared/rotation-inertia";

type ElementItem = {
  id: string;
  type: string;
  section: string;
  color?: string;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  xMid?: number;
  yMid?: number;
  stairGeometry?: {
    flight1?: { lowerA: Point; lowerB: Point; upperA: Point; upperB: Point; lowerLevelId: string; upperLevelId: string };
    flight2?: { lowerA: Point; lowerB: Point; upperA: Point; upperB: Point; lowerLevelId: string; upperLevelId: string };
    baseA?: Point; baseB?: Point; midA?: Point; midB?: Point; topA?: Point; topB?: Point; landingZ: number;
    absolute?: {
      flight1?: { lowerA: Point; lowerB: Point; upperA: Point; upperB: Point; lowerLevelId: string; upperLevelId: string };
      flight2?: { lowerA: Point; lowerB: Point; upperA: Point; upperB: Point; lowerLevelId: string; upperLevelId: string };
      baseA?: Point; baseB?: Point; midA?: Point; midB?: Point; topA?: Point; topB?: Point; landingZ: number;
    };
  };
  absoluteStairGeometry?: {
    flight1?: { lowerA: Point; lowerB: Point; upperA: Point; upperB: Point; lowerLevelId: string; upperLevelId: string };
    flight2?: { lowerA: Point; lowerB: Point; upperA: Point; upperB: Point; lowerLevelId: string; upperLevelId: string };
    baseA?: Point; baseB?: Point; midA?: Point; midB?: Point; topA?: Point; topB?: Point; landingZ: number;
  };
};
type Level = {
  id: string;
  label: string;
  elevation: string;
  height?: string;
  elements: ElementItem[];
};
type Props = {
  levels: Level[];
  modelCatalog?: ModelSpec[];
  xCount: number;
  yCount: number;
  xAxisDistances?: string[];
  yAxisDistances?: string[];
  gridDistance?: string;
  selectionEnabled?: boolean;
  selectedElementKey?: string | null;
  onElementSelect?: (levelId: string, item: ElementItem) => void;
  analysisValues?: Record<string, { gk: number; qk: number; nu: number; nser: number; moment?: number }>;
  criticalElementKeys?: string[];
  analysisScaleColors?: Record<string, string>;
  showAnalysisValues?: boolean;
  showAnalysisMoments?: boolean;
  loadVisuals?: Record<string, { gk: number; qk: number; nu: number; lineKnM?: number; areaKnM2?: number; critical?: boolean }>;
  showLoadValues?: boolean;
  meshedSurfaceIds?: string[];
  meshSizeM?: number;
  stairPlacementActive?: boolean;
  stairPlacementStart?: Point | null;
  stairLandingPoint?: Point | null;
  onStairPointSelect?: (point: Point) => void;
  stairNodePoints?: Point[];
  stairPolePoints?: Point[];
  stairPlacementStage?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  stairLandingZ?: number;
  stairLevelHeight?: number;
  stairArrivalBeams?: ElementItem[];
  stairPreviewBeam?: ElementItem | null;
  onStairBeamSelect?: (beam: ElementItem) => void;
  onStairBeamHover?: (beam: ElementItem | null) => void;
};
type Point = { x: number; y: number };

const colorOf = (item: ElementItem) =>
  item.color ?? modelColor(item.type, item.section);
const polygon = (points: Point[]) =>
  points.map(point => `${point.x},${point.y}`).join(" ");
const resolvedDimensions = (item: Pick<ElementItem, "type" | "section">, catalog: ModelSpec[] = []) => catalog.find(model => model.type === item.type && model.name === item.section)?.dimensions ?? modelSpec(item.type, item.section)?.dimensions ?? item.section;
const sectionValueMeters = (value: string, section: string) => {
  const numeric = Number(value.replace(",", "."));
  return /cm/i.test(section) ? numeric / 100 : /\bm\b/i.test(section) ? numeric : numeric > 2 ? numeric / 100 : numeric;
};
const sectionPair = (section: string | undefined, fallback: [number, number]) => {
  const source = section ?? "";
  const match = source.match(/(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)/i);
  return match
    ? [sectionValueMeters(match[1], source), sectionValueMeters(match[2], source)] as [number, number]
    : fallback;
};
const firstSectionValue = (section: string | undefined, fallback: number) => {
  const source = section ?? "";
  const match = source.match(/(\d+(?:[.,]\d+)?)/);
  return match ? sectionValueMeters(match[1], source) : fallback;
};

export default function Building3DView({
  levels,
  modelCatalog = [],
  xCount,
  yCount,
  xAxisDistances = [],
  yAxisDistances = [],
  gridDistance = "4",
  selectionEnabled = false,
  selectedElementKey = null,
  onElementSelect,
  analysisValues = {},
  criticalElementKeys = [],
  analysisScaleColors = {},
  showAnalysisValues = false,
  showAnalysisMoments = false,
  loadVisuals = {},
  showLoadValues = false,
  meshedSurfaceIds = [],
  meshSizeM = 0.75,
  stairPlacementActive = false,
  stairPlacementStart = null,
  stairLandingPoint = null,
  onStairPointSelect,
  stairNodePoints = [],
  stairPolePoints = [],
  stairPlacementStage = 1,
  stairLandingZ = 1.6,
  stairLevelHeight = 3.2,
  stairArrivalBeams = [],
  stairPreviewBeam = null,
  onStairBeamSelect,
  onStairBeamHover,
}: Props) {
  const [rotation, setRotation] = useState({ yaw: -28, pitch: 0 });
  const [zoom, setZoom] = useState(1);
  const [navigationMode, setNavigationMode] = useState<"rotate" | "pan">(
    "rotate"
  );
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    lastX: number;
    lastY: number;
    yaw: number;
    pitch: number;
    panX: number;
    panY: number;
    mode: "rotate" | "pan";
  } | null>(null);
  const velocityRef = useRef({ yaw: 0, pitch: 0 });
  const inertiaFrameRef = useRef<number | null>(null);
  const cell = 58;
  const origin = { x: 208, y: 330 };
  const xMetricPositions = cumulativeGridPositions(
    xAxisDistances.map(value => Number(String(value).replace(",", ".")) || 0.01),
    xCount
  );
  const yMetricPositions = cumulativeGridPositions(
    yAxisDistances.map(value => Number(String(value).replace(",", ".")) || 0.01),
    yCount
  );
  const averageGridSpacing = (positions: number[]) => {
    const spans = positions.slice(1).map((value, index) => value - positions[index]).filter(value => value > 0);
    return spans.length ? spans.reduce((sum, value) => sum + value, 0) / spans.length : Math.max(Number(String(gridDistance).replace(",", ".")) || 4, 0.01);
  };
  const horizontalScale = cell / Math.max((averageGridSpacing(xMetricPositions) + averageGridSpacing(yMetricPositions)) / 2, 0.01);
  const interpolateAxis = (value: number, positions: number[]) => {
    if (!positions.length) return value;
    if (value <= 0) return positions[0] ?? 0;
    const last = positions.length - 1;
    if (value >= last) {
      const span = Math.max((positions[last] ?? 0) - (positions[Math.max(0, last - 1)] ?? 0), 0.01);
      return (positions[last] ?? 0) + (value - last) * span;
    }
    const index = Math.floor(value);
    const ratio = value - index;
    return (positions[index] ?? 0) + ratio * ((positions[index + 1] ?? positions[index] ?? 0) - (positions[index] ?? 0));
  };
  const gridX = (index: number) => interpolateAxis(index, xMetricPositions);
  const gridY = (index: number) => interpolateAxis(index, yMetricPositions);
  const pivotXMetric = (xMetricPositions.at(-1) ?? 0) / 2;
  const pivotYMetric = (yMetricPositions.at(-1) ?? 0) / 2;
  const pivotZ = levels.reduce((max, level, index) => Math.max(max, postTopElevation(level, index)), 0) / 2;
  const projectMetric = (xMeters: number, yMeters: number, z: number): Point => {
    const localX = xMeters - pivotXMetric;
    const localY = yMeters - pivotYMetric;
    const localZ = z - pivotZ;
    const yaw = (rotation.yaw * Math.PI) / 180;
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    const rotatedX = localX * cosYaw - localY * sinYaw;
    const depth = localX * sinYaw + localY * cosYaw;
    const pitch = (Math.max(-88, Math.min(88, rotation.pitch)) * Math.PI) / 180;
    const vertical = localZ * horizontalScale * Math.cos(pitch) - depth * horizontalScale * 0.42 * Math.sin(pitch);
    return {
      x: origin.x + pan.x + rotatedX * horizontalScale * zoom,
      y: origin.y + pan.y - vertical * zoom,
    };
  };
  const project = (x: number, y: number, z: number): Point => projectMetric(gridX(x), gridY(y), z);
  const metricPoint = (x: number, y: number) => ({ x: gridX(x), y: gridY(y) });
  const stopInertia = () => {
    if (inertiaFrameRef.current !== null)
      cancelAnimationFrame(inertiaFrameRef.current);
    inertiaFrameRef.current = null;
    velocityRef.current = { yaw: 0, pitch: 0 };
  };
  const startInertia = () => {
    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const tick = () => {
      const velocity = velocityRef.current;
      if (!hasVisibleInertia(velocity)) {
        stopInertia();
        return;
      }
      setRotation(current => ({
        yaw: current.yaw + velocity.yaw,
        pitch: Math.max(-88, Math.min(88, current.pitch + velocity.pitch)),
      }));
      velocityRef.current = decayRotationVelocity(velocity);
      inertiaFrameRef.current = requestAnimationFrame(tick);
    };
    inertiaFrameRef.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => stopInertia(), []);
  const beginRotate = (event: React.PointerEvent<SVGSVGElement>) => {
    stopInertia();
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      yaw: rotation.yaw,
      pitch: rotation.pitch,
      panX: pan.x,
      panY: pan.y,
      mode: navigationMode,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const rotate = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.lastX;
    const dy = event.clientY - drag.lastY;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    if (drag.mode === "pan") {
      setPan({
        x: drag.panX + event.clientX - drag.x,
        y: drag.panY + event.clientY - drag.y,
      });
      return;
    }
    velocityRef.current = { yaw: dx * 0.68, pitch: dy * 0.42 };
    setRotation({
      yaw: drag.yaw + (event.clientX - drag.x) * 0.68,
      pitch: Math.max(
        -88,
        Math.min(88, drag.pitch + (event.clientY - drag.y) * 0.42)
      ),
    });
  };
  const endRotate = (event: React.PointerEvent<SVGSVGElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    startInertia();
  };
  const defaultAxisSpacing = Math.max(Number(String(gridDistance).replace(",", ".")) || 4, 0.01);
  const axisSpacing = (distances: string[], index: number) => Math.max(Number(String(distances[index] ?? distances[index - 1] ?? defaultAxisSpacing).replace(",", ".")) || defaultAxisSpacing, 0.01);
  const metricScale = (distances: string[], count: number) => {
    const segments = Math.max(count - 1, 1);
    const total = Array.from({ length: segments }, (_, index) => axisSpacing(distances, index)).reduce((sum, value) => sum + value, 0);
    return Math.max(total / segments, 0.01);
  };
  const maxX = Math.max(xCount - 1, 1);
  const maxY = Math.max(yCount - 1, 1);
  const projectRect = (
    x: number,
    y: number,
    x2: number,
    y2: number,
    z: number
  ) => [
    project(x, y, z),
    project(x2, y, z),
    project(x2, y2, z),
    project(x, y2, z),
  ];
  const displayLevelHeight = (levelIndex: number) =>
    levelIndex === 0
      ? 0
      : 3.2 +
        levels
          .slice(1, levelIndex)
          .reduce((sum, level) => sum + levelHeight(level), 0);
  const allItems = levels.flatMap(level => level.elements);
  const legend = Array.from(
    new Map(
      allItems.map(item => [
        item.section,
        { section: item.section, color: colorOf(item) },
      ])
    ).values()
  ).slice(0, 5);
  return (
    <div className="relative h-[510px] overflow-hidden rounded-[14px] border border-[#a7cde4] bg-[#c9e3f3]">
      <svg
        viewBox="0 0 430 510"
        className={`h-full w-full touch-none ${dragRef.current ? "cursor-grabbing" : "cursor-grab"}`}
        onPointerDown={beginRotate}
        onPointerMove={rotate}
        onPointerUp={endRotate}
        onPointerCancel={endRotate}
      >
        <defs>
          <filter id="soft-shadow">
            <feDropShadow
              dx="0"
              dy="4"
              stdDeviation="4"
              floodColor="#52788b"
              floodOpacity=".22"
            />
          </filter>
        </defs>
        {stairPlacementActive && (
          <g>
            {Array.from({ length: xCount }, (_, x) => Array.from({ length: yCount }, (_, y) => ({ x, y }))).flat().map(({ x, y }) => {
              const z = stairPlacementStage <= 2 ? 0 : stairPlacementStage <= 4 ? stairLandingZ : stairLevelHeight;
              const point = project(x, y, z);
              const active = (stairPlacementStage === 1 && stairPlacementStart?.x === x && stairPlacementStart?.y === y) || (stairPlacementStage === 3 && stairLandingPoint?.x === x && stairLandingPoint?.y === y);
              const label = active ? (stairPlacementStage <= 2 ? "Départ" : stairPlacementStage <= 4 ? "Palier Z" : "Arrivée") : null;
              return <g key={`rsa-target-${x}-${y}`}>
                <circle cx={point.x} cy={point.y} r={active ? 9 : 7} fill={active ? (stairPlacementStage <= 2 ? "#e53935" : "#f59e0b") : "#fff"} stroke="#e53935" strokeWidth="2" opacity=".96" onPointerDown={event => { event.stopPropagation(); onStairPointSelect?.({ x, y }); }} />
                {label && <text x={point.x + 11} y={point.y - 9} fontSize="10" fontWeight="700" fill="#9a4318" pointerEvents="none">{label}</text>}
              </g>;
            })}
            <text x="14" y="28" fontSize="11" fontWeight="700" fill="#315d70" pointerEvents="none">{stairPlacementStage <= 2 ? "Volée 1 · niveau bas" : stairPlacementStage <= 4 ? `Ligne temporaire Z = ${stairLandingZ.toFixed(2)} m` : "Volée 2 · niveau supérieur"}</text>
          </g>
        )}
        <g opacity=".45">
          {Array.from({ length: xCount }, (_, index) => {
            const a = project(index, 0, 0);
            const b = project(index, maxY, 0);
            return (
              <line
                key={`x-grid-${index}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="#7496a7"
                strokeWidth="1"
              />
            );
          })}
          {Array.from({ length: yCount }, (_, index) => {
            const a = project(0, index, 0);
            const b = project(maxX, index, 0);
            return (
              <line
                key={`y-grid-${index}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="#7496a7"
                strokeWidth="1"
              />
            );
          })}
        </g>
        {Array.from({ length: xCount }, (_, index) => {
          const p = project(index, 0, 0);
          return (
            <text
              key={`x-label-${index}`}
              x={p.x}
              y={p.y + 18}
              textAnchor="middle"
              className="fill-[#547687] text-[9px]"
            >
              {index + 1}
            </text>
          );
        })}
        {Array.from({ length: yCount }, (_, index) => {
          const p = project(0, index, 0);
          return (
            <text
              key={`y-label-${index}`}
              x={p.x - 14}
              y={p.y + 4}
              textAnchor="middle"
              className="fill-[#547687] text-[9px]"
            >
              {String.fromCharCode(65 + index)}
            </text>
          );
        })}
        <g filter="url(#soft-shadow)">
          {levels.map((level, levelIndex) => {
            const base = levelElevation(level, levelIndex);
            const height = levelHeight(level);
            const slab = projectRect(0, 0, maxX, maxY, base + height * 0.92);
            const rank = (item: ElementItem) =>
              item.type === "Semelle"
                ? 0
                : item.type === "Poteau"
                  ? 1
                  : item.type === "Poutre"
                    ? 2
                    : 3;
            return (
              <g key={level.id}>
                <polygon
                  points={polygon(slab)}
                  fill="#d8f0f5"
                  fillOpacity=".18"
                  stroke="#77a6b6"
                  strokeWidth="1.5"
                />
                {[...level.elements]
                  .sort((a, b) => rank(a) - rank(b))
                  .map(item => {
                    const z = elementElevation(level, levelIndex, item.type);
                    const start = project(item.x, item.y, z);
                    const end = project(
                      item.x2 ?? item.x,
                      item.y2 ?? item.y,
                      z
                    );
                    const analysisKey = `${level.id}:${item.id}`;
                    const analysis = analysisValues[analysisKey];
                    const critical = criticalElementKeys.includes(analysisKey);
                    const color = analysisScaleColors[analysisKey] ?? (critical ? "#ff1717" : colorOf(item));
                    if (item.type === "Escaliers") {
                      const stairLoad = loadVisuals[analysisKey];
                      const totalHeight = Math.max(levelHeight(level), 0.1);
                      const endX = item.x2 ?? item.x + 1;
                      const endY = item.y2 ?? item.y;
                      const midX = item.xMid ?? endX;
                      const midY = item.yMid ?? item.y;
                      const corner = Math.abs(endX - item.x) > 0.05
                        ? { x: endX, y: item.y }
                        : { x: item.x, y: endY };
                      const width = 1;
                      const stepCount = 8;
                      const flight = (from: { x: number; y: number }, to: { x: number; y: number }, z0: number, z1: number, prefix: string) => {
                        const fromMetric = metricPoint(from.x, from.y);
                        const toMetric = metricPoint(to.x, to.y);
                        const dx = toMetric.x - fromMetric.x;
                        const dy = toMetric.y - fromMetric.y;
                        const length = Math.max(Math.hypot(dx, dy), 0.001);
                        const px = (-dy / length) * width / 2;
                        const py = (dx / length) * width / 2;
                        return Array.from({ length: stepCount }, (_, step) => {
                          const t0 = step / stepCount;
                          const t1 = (step + 1) / stepCount;
                          const zPrev = z0 + (z1 - z0) * t0;
                          const zTop = z0 + (z1 - z0) * t1;
                          const a = { x: fromMetric.x + dx * t0, y: fromMetric.y + dy * t0 };
                          const b = { x: fromMetric.x + dx * t1, y: fromMetric.y + dy * t1 };
                          const top = [projectMetric(a.x + px, a.y + py, zTop), projectMetric(b.x + px, b.y + py, zTop), projectMetric(b.x - px, b.y - py, zTop), projectMetric(a.x - px, a.y - py, zTop)];
                          const riser = [projectMetric(b.x + px, b.y + py, zPrev), projectMetric(b.x + px, b.y + py, zTop), projectMetric(b.x - px, b.y - py, zTop), projectMetric(b.x - px, b.y - py, zPrev)];
                          const side = [projectMetric(a.x - px, a.y - py, z0), projectMetric(b.x - px, b.y - py, z1), projectMetric(b.x - px, b.y - py, zTop), projectMetric(a.x - px, a.y - py, zPrev)];
                          return <g key={`${prefix}-${step}`}><polygon points={polygon(top)} fill={color} fillOpacity=".92" stroke="#647783" strokeWidth=".8" /><polygon points={polygon(riser)} fill={color} fillOpacity=".98" stroke="#536b78" strokeWidth=".8" /><polygon points={polygon(side)} fill={color} fillOpacity=".55" stroke="#536b78" strokeWidth=".7" /></g>;
                        });
                      };
                      const inclinedSlab = (from: { x: number; y: number }, to: { x: number; y: number }, z0: number, z1: number, prefix: string) => {
                        const fromMetric = metricPoint(from.x, from.y);
                        const toMetric = metricPoint(to.x, to.y);
                        const dx = toMetric.x - fromMetric.x;
                        const dy = toMetric.y - fromMetric.y;
                        const length = Math.max(Math.hypot(dx, dy), 0.001);
                        const px = (-dy / length) * width / 2;
                        const py = (dx / length) * width / 2;
                        const thickness = 0.15;
                        const top = [project(from.x + px, from.y + py, z0), project(to.x + px, to.y + py, z1), project(to.x - px, to.y - py, z1), project(from.x - px, from.y - py, z0)];
                        const bottom = [project(from.x + px, from.y + py, z0 - thickness), project(to.x + px, to.y + py, z1 - thickness), project(to.x - px, to.y - py, z1 - thickness), project(from.x - px, from.y - py, z0 - thickness)];
                        return <g key={prefix}><polygon points={polygon(top)} fill={color} fillOpacity=".9" stroke="#536b78" strokeWidth="1" /><polygon points={polygon(bottom)} fill={color} fillOpacity=".65" stroke="#536b78" strokeWidth=".7" /><polygon points={polygon([top[0], top[1], bottom[1], bottom[0]])} fill={color} fillOpacity=".8" stroke="#536b78" strokeWidth=".7" /><polygon points={polygon([top[3], top[2], bottom[2], bottom[3]])} fill={color} fillOpacity=".75" stroke="#536b78" strokeWidth=".7" /></g>;
                      };
                      const inclinedSlabFromFourPoints = (flight: { lowerA: Point; lowerB: Point; upperA: Point; upperB: Point }, z0: number, z1: number, prefix: string) => {
                        const thickness = 0.15;
                        const lowerA = metricPoint(flight.lowerA.x, flight.lowerA.y);
                        const lowerB = metricPoint(flight.lowerB.x, flight.lowerB.y);
                        const upperA = metricPoint(flight.upperA.x, flight.upperA.y);
                        const upperB = metricPoint(flight.upperB.x, flight.upperB.y);
                        const top = [projectMetric(lowerA.x, lowerA.y, z0), projectMetric(upperA.x, upperA.y, z1), projectMetric(upperB.x, upperB.y, z1), projectMetric(lowerB.x, lowerB.y, z0)];
                        const bottom = [projectMetric(lowerA.x, lowerA.y, z0 - thickness), projectMetric(upperA.x, upperA.y, z1 - thickness), projectMetric(upperB.x, upperB.y, z1 - thickness), projectMetric(lowerB.x, lowerB.y, z0 - thickness)];
                        return <g key={prefix}><polygon points={polygon(top)} fill={color} fillOpacity=".9" stroke="#536b78" strokeWidth="1" /><polygon points={polygon(bottom)} fill={color} fillOpacity=".65" stroke="#536b78" strokeWidth=".7" /><polygon points={polygon([top[0], top[1], bottom[1], bottom[0]])} fill={color} fillOpacity=".8" stroke="#536b78" strokeWidth=".7" /><polygon points={polygon([top[3], top[2], bottom[2], bottom[3]])} fill={color} fillOpacity=".75" stroke="#536b78" strokeWidth=".7" /></g>;
                      };
                      const geometry = item.stairGeometry;
                      const baseA = geometry?.baseA ?? { x: item.x, y: item.y };
                      const baseB = geometry?.baseB ?? { x: item.x, y: item.y + 1 };
                      const midA = geometry?.midA ?? corner;
                      const midB = geometry?.midB ?? { x: corner.x, y: corner.y + 1 };
                      const topA = geometry?.topA ?? { x: endX, y: endY };
                      const topB = geometry?.topB ?? { x: endX, y: endY + 1 };
                      const lowerLevelIndex = geometry?.flight1?.lowerLevelId ? levels.findIndex(level => level.id === geometry.flight1?.lowerLevelId) : -1;
                      const upperLevelIndex = geometry?.flight2?.upperLevelId ? levels.findIndex(level => level.id === geometry.flight2?.upperLevelId) : -1;
                      const lowerLevel = lowerLevelIndex >= 0 ? levels[lowerLevelIndex] : undefined;
                      const baseZ = lowerLevel && /fondation/i.test(`${lowerLevel.id} ${lowerLevel.label}`) ? 0 : lowerLevelIndex >= 0 && lowerLevel ? levelElevation(lowerLevel, lowerLevelIndex) : z;
                      const stairHeight = geometry?.landingZ ? geometry.landingZ * 2 : totalHeight;
                      const topZ = baseZ + stairHeight;
                      const middleZ = baseZ + stairHeight / 2;
                      const middleHeight = stairHeight / 2;
                      const center = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
                      const flight1 = geometry?.flight1;
                      const flight2 = geometry?.flight2;
                      const firstLower = flight1 ? center(flight1.lowerA, flight1.lowerB) : center(baseA, baseB);
                      const firstUpper = flight1 ? center(flight1.upperA, flight1.upperB) : center(midA, midB);
                      const secondLower = flight2 ? center(flight2.lowerA, flight2.lowerB) : center(midA, midB);
                      const secondUpper = flight2 ? center(flight2.upperA, flight2.upperB) : center(topA, topB);
                      const firstFlight = flight1 ? inclinedSlabFromFourPoints(flight1, baseZ, middleZ, "flight-a-slab") : flight(firstLower, firstUpper, baseZ, middleZ, "flight-a");
                      const secondFlight = flight2 ? inclinedSlabFromFourPoints(flight2, middleZ, topZ, "flight-b-slab") : flight(secondLower, secondUpper, middleZ, topZ, "flight-b");
                      const firstRun = { x: firstUpper.x - firstLower.x, y: firstUpper.y - firstLower.y };
                      const firstRunLength = Math.max(Math.hypot(firstRun.x, firstRun.y), 0.001);
                      const landingDepth = { x: firstRun.x / firstRunLength, y: firstRun.y / firstRunLength };
                      const upperEdge = flight1 ? { x: flight1.upperB.x - flight1.upperA.x, y: flight1.upperB.y - flight1.upperA.y } : { x: 0, y: 1 };
                      const upperEdgeLength = Math.max(Math.hypot(upperEdge.x, upperEdge.y), 0.001);
                      const landingLengthDirection = { x: upperEdge.x / upperEdgeLength, y: upperEdge.y / upperEdgeLength };
                      const landingStart = flight1 ? flight1.upperA : { x: firstUpper.x, y: firstUpper.y - 0.5 };
                      const landingFarEdge = { x: landingStart.x + landingLengthDirection.x * 2, y: landingStart.y + landingLengthDirection.y * 2 };
                      const landingNearDepth = { x: landingStart.x + landingDepth.x, y: landingStart.y + landingDepth.y };
                      const landingFarDepth = { x: landingFarEdge.x + landingDepth.x, y: landingFarEdge.y + landingDepth.y };
                      const secondLowerForRender = secondLower;
                      const solidLanding = (worldPoints: Point[], elevation: number, prefix: string) => {
                        const thickness = 0.15;
                        const top = worldPoints.map(point => project(point.x, point.y, elevation));
                        const bottom = worldPoints.map(point => project(point.x, point.y, elevation - thickness));
                        const sides = worldPoints.map((_, index) => {
                          const next = (index + 1) % worldPoints.length;
                          return <polygon key={`${prefix}-side-${index}`} points={polygon([top[index], top[next], bottom[next], bottom[index]])} fill={color} fillOpacity=".78" stroke="#536b78" strokeWidth=".7" />;
                        });
                        return <g key={prefix}><polygon points={polygon(top)} fill={color} fillOpacity=".94" stroke="#536b78" strokeWidth="1" /><polygon points={polygon(bottom)} fill={color} fillOpacity=".7" stroke="#536b78" strokeWidth=".7" />{sides}</g>;
                      };
                      const landingWorld = [
                        landingStart,
                        landingFarEdge,
                        landingFarDepth,
                        landingNearDepth,
                      ];
                      const renderedSecondFlight = secondFlight;
                      const arrivalRun = { x: secondUpper.x - secondLower.x, y: secondUpper.y - secondLower.y };
                      const arrivalRunLength = Math.max(Math.hypot(arrivalRun.x, arrivalRun.y), 0.001);
                      const arrivalDirection = { x: arrivalRun.x / arrivalRunLength, y: arrivalRun.y / arrivalRunLength };
                      const arrivalLateral = flight2
                        ? { x: (flight2.upperA.x - flight2.upperB.x) / Math.max(Math.hypot(flight2.upperB.x - flight2.upperA.x, flight2.upperB.y - flight2.upperA.y), 0.001), y: (flight2.upperA.y - flight2.upperB.y) / Math.max(Math.hypot(flight2.upperB.x - flight2.upperA.x, flight2.upperB.y - flight2.upperA.y), 0.001) }
                        : { x: 0, y: -1 };
                      const arrivalDepth = 1;
                      const arrivalLength = 2;
                      const arrivalLandingStart = flight2?.upperB;
                      const arrivalLandingWorld = arrivalLandingStart
                        ? [
                            arrivalLandingStart,
                            { x: arrivalLandingStart.x + arrivalLateral.x * arrivalLength, y: arrivalLandingStart.y + arrivalLateral.y * arrivalLength },
                            { x: arrivalLandingStart.x + arrivalLateral.x * arrivalLength + arrivalDirection.x * arrivalDepth, y: arrivalLandingStart.y + arrivalLateral.y * arrivalLength + arrivalDirection.y * arrivalDepth },
                            { x: arrivalLandingStart.x + arrivalDirection.x * arrivalDepth, y: arrivalLandingStart.y + arrivalDirection.y * arrivalDepth },
                          ]
                        : [];
                      return <g key={`${level.id}-${item.id}`} className={selectionEnabled ? "cursor-pointer" : undefined} onPointerDown={selectionEnabled ? event => { event.stopPropagation(); onElementSelect?.(level.id, item); } : undefined}><g opacity=".72" stroke="#a84d16" strokeWidth="1.15">{firstFlight}{renderedSecondFlight}{solidLanding(landingWorld, middleZ, "rest-landing")}{arrivalLandingWorld.length > 0 && solidLanding(arrivalLandingWorld, topZ, "arrival-landing")}</g><text x={(start.x + project(secondUpper.x, secondUpper.y, topZ).x) / 2 + 8} y={(start.y + project(secondUpper.x, secondUpper.y, topZ).y) / 2 - 8} className="fill-[#e87538] text-[9px] font-bold">{item.id}</text>{showLoadValues && stairLoad && <text x={start.x + 8} y={start.y - 8} className="fill-[#ff1717] text-[8px] font-bold" style={{ paintOrder: "stroke", stroke: "#ffffff", strokeWidth: 3 }}>{stairLoad.areaKnM2?.toFixed(2)} kN/m²</text>}</g>;
                    }
                    if (item.type === "Dalle") {
                      const dimensions = resolvedDimensions(item, modelCatalog);
                      const thickness = Math.max(0.04, firstSectionValue(dimensions, 0.20));
                      const x2 = item.x2 ?? item.x + 1;
                      const y2 = item.y2 ?? item.y + 1;
                      const meshed = meshedSurfaceIds.includes(item.id);
                      const top = projectRect(item.x, item.y, x2, y2, z + thickness);
                      const bottom = projectRect(item.x, item.y, x2, y2, z);
                      const faces = [top, bottom, [bottom[0], bottom[1], top[1], top[0]], [bottom[1], bottom[2], top[2], top[1]], [bottom[2], bottom[3], top[3], top[2]], [bottom[3], bottom[0], top[0], top[3]]];
                      const xA = gridX(item.x), xB = gridX(x2), yA = gridY(item.y), yB = gridY(y2);
                      const step = Math.max(0.1, Number(meshSizeM) || 0.75);
                      const meshLines = meshed ? [
                        ...Array.from({ length: Math.max(0, Math.ceil(Math.abs(xB - xA) / step) - 1) }, (_, index) => {
                          const x = Math.min(xA, xB) + (index + 1) * step;
                          return <line key={`mesh-x-${index}`} x1={projectMetric(x, Math.min(yA, yB), z + thickness + 0.008).x} y1={projectMetric(x, Math.min(yA, yB), z + thickness + 0.008).y} x2={projectMetric(x, Math.max(yA, yB), z + thickness + 0.008).x} y2={projectMetric(x, Math.max(yA, yB), z + thickness + 0.008).y} />;
                        }),
                        ...Array.from({ length: Math.max(0, Math.ceil(Math.abs(yB - yA) / step) - 1) }, (_, index) => {
                          const y = Math.min(yA, yB) + (index + 1) * step;
                          return <line key={`mesh-y-${index}`} x1={projectMetric(Math.min(xA, xB), y, z + thickness + 0.008).x} y1={projectMetric(Math.min(xA, xB), y, z + thickness + 0.008).y} x2={projectMetric(Math.max(xA, xB), y, z + thickness + 0.008).x} y2={projectMetric(Math.max(xA, xB), y, z + thickness + 0.008).y} />;
                        }),
                      ] : [];
                      const load = loadVisuals[analysisKey];
                      const loadedLines = load?.areaKnM2 && load.areaKnM2 > 0 ? [0.2, 0.4, 0.6, 0.8].map((ratio, index) => {
                        const x = Math.min(xA, xB) + Math.abs(xB - xA) * ratio;
                        return <line key={`slab-load-line-${index}`} x1={projectMetric(x, Math.min(yA, yB), z + thickness + 0.015).x} y1={projectMetric(x, Math.min(yA, yB), z + thickness + 0.015).y} x2={projectMetric(x, Math.max(yA, yB), z + thickness + 0.015).x} y2={projectMetric(x, Math.max(yA, yB), z + thickness + 0.015).y} />;
                      }) : null;
                      return (
                        <g key={`${level.id}-${item.id}`} className={selectionEnabled ? "cursor-pointer" : undefined} onPointerDown={selectionEnabled ? event => { event.stopPropagation(); onElementSelect?.(level.id, item); } : undefined}>
                          {faces.map((face, index) => <polygon key={`slab-face-${index}`} points={polygon(face)} fill={color} fillOpacity={index === 0 ? ".42" : ".28"} stroke={selectedElementKey === `${level.id}:${item.id}` ? "#e87538" : color} strokeWidth={selectedElementKey === `${level.id}:${item.id}` ? 3 : 1.3} />)}
                          {meshed && <g stroke="#087f7f" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.9">{meshLines}</g>}
                          {loadedLines && <g stroke="#ff1717" strokeWidth="1.4" strokeDasharray="3 2" opacity="0.9">{loadedLines}</g>}
                          {meshed && <text x={top[0].x + 5} y={top[0].y - 5} className="fill-[#087f7f] text-[8px] font-bold" style={{ paintOrder: "stroke", stroke: "#ffffff", strokeWidth: 3 }}>MAILLÉ</text>}
                          {showLoadValues && load && <text x={top[0].x + 5} y={top[0].y + 8} className="fill-[#ff1717] text-[8px] font-bold" style={{ paintOrder: "stroke", stroke: "#ffffff", strokeWidth: 3 }}>{load.areaKnM2?.toFixed(2)} kN/m²</text>}
                        </g>
                      );
                    }
                    if (item.type === "Voile") {
                      const dx = (item.x2 ?? item.x) - item.x;
                      const dy = (item.y2 ?? item.y) - item.y;
                      const length = Math.max(Math.hypot(dx, dy), 0.001);
                      const dimensions = resolvedDimensions(item, modelCatalog);
                      const thickness = Math.max(0.08, firstSectionValue(dimensions, 0.20));
                      const halfT = thickness / 2;
                      const a = metricPoint(item.x, item.y);
                      const b = metricPoint(item.x2 ?? item.x, item.y2 ?? item.y);
                      const nx = -dy / length * halfT;
                      const ny = dx / length * halfT;
                      const height = Math.max(levelHeight(level), 0.1);
                      const bottom = [projectMetric(a.x + nx, a.y + ny, z), projectMetric(b.x + nx, b.y + ny, z), projectMetric(b.x - nx, b.y - ny, z), projectMetric(a.x - nx, a.y - ny, z)];
                      const top = [projectMetric(a.x + nx, a.y + ny, z + height), projectMetric(b.x + nx, b.y + ny, z + height), projectMetric(b.x - nx, b.y - ny, z + height), projectMetric(a.x - nx, a.y - ny, z + height)];
                      const wallStroke = selectedElementKey === `${level.id}:${item.id}` ? "#e87538" : color;
                      const wallLabel = project((item.x + (item.x2 ?? item.x)) / 2, (item.y + (item.y2 ?? item.y)) / 2, z + height + 0.04);
                      const wallClick = selectionEnabled ? (event: React.PointerEvent) => { event.stopPropagation(); onElementSelect?.(level.id, item); } : undefined;
                      return <g key={`${level.id}-${item.id}`} className={selectionEnabled ? "cursor-pointer" : undefined} onPointerDown={wallClick}><polygon points={polygon(top)} fill={color} fillOpacity=".34" stroke={wallStroke} strokeWidth="1.5" /><polygon points={polygon(bottom)} fill={color} fillOpacity=".28" stroke={wallStroke} strokeWidth="1" />{top.map((_, index) => { const next = (index + 1) % 4; return <polygon key={`wall-face-${index}`} points={polygon([bottom[index], bottom[next], top[next], top[index]])} fill={color} fillOpacity=".38" stroke={wallStroke} strokeWidth="1" />; })}<text x={wallLabel.x + 5} y={wallLabel.y} className="fill-[#5d4194] text-[9px] font-bold" style={{ paintOrder: "stroke", stroke: "#ffffff", strokeWidth: 3 }}>{item.id}</text></g>;
                    }
                    if (item.type === "Poutre" || item.type === "Longrine de redressement") {
                      const [width, beamHeight] = sectionPair(resolvedDimensions(item, modelCatalog), [0.20, 0.40]);
                      const a = metricPoint(item.x, item.y);
                      const b = metricPoint(item.x2 ?? item.x, item.y2 ?? item.y);
                      const dx = b.x - a.x;
                      const dy = b.y - a.y;
                      const length = Math.max(Math.hypot(dx, dy), 0.001);
                      const nx = -dy / length * width / 2;
                      const ny = dx / length * width / 2;
                      const beamBottom = [projectMetric(a.x + nx, a.y + ny, z), projectMetric(b.x + nx, b.y + ny, z), projectMetric(b.x - nx, b.y - ny, z), projectMetric(a.x - nx, a.y - ny, z)];
                      const beamTop = [projectMetric(a.x + nx, a.y + ny, z + beamHeight), projectMetric(b.x + nx, b.y + ny, z + beamHeight), projectMetric(b.x - nx, b.y - ny, z + beamHeight), projectMetric(a.x - nx, a.y - ny, z + beamHeight)];
                      const beamStroke = selectedElementKey === `${level.id}:${item.id}` ? "#e87538" : color;
                      const load = loadVisuals[analysisKey];
                      const arrows = load?.lineKnM && load.lineKnM > 0 ? [0.2, 0.4, 0.6, 0.8].map((ratio, index) => {
                        const x = a.x + (b.x - a.x) * ratio, y = a.y + (b.y - a.y) * ratio;
                        const base = projectMetric(x, y, z + beamHeight + 0.32), tip = projectMetric(x, y, z + beamHeight + 0.03);
                        return <g key={`beam-load-arrow-${index}`}><line x1={base.x} y1={base.y} x2={tip.x} y2={tip.y} stroke="#ff1717" strokeWidth="2" /><path d={`M ${tip.x - 3} ${tip.y - 5} L ${tip.x} ${tip.y} L ${tip.x + 3} ${tip.y - 5}`} fill="none" stroke="#ff1717" strokeWidth="2" /></g>;
                      }) : null;
                      return <g key={`${level.id}-${item.id}`} className={selectionEnabled ? "cursor-pointer" : undefined} onPointerDown={selectionEnabled ? event => { event.stopPropagation(); onElementSelect?.(level.id, item); } : undefined}>{[beamTop, beamBottom, [beamBottom[0], beamBottom[1], beamTop[1], beamTop[0]], [beamBottom[1], beamBottom[2], beamTop[2], beamTop[1]], [beamBottom[2], beamBottom[3], beamTop[3], beamTop[2]], [beamBottom[3], beamBottom[0], beamTop[0], beamTop[3]]].map((face, index) => <polygon key={`beam-face-${index}`} points={polygon(face)} fill={color} fillOpacity={index === 0 ? ".88" : ".76"} stroke={beamStroke} strokeWidth={selectedElementKey === `${level.id}:${item.id}` ? 1.8 : 1} />)}{arrows && <g>{arrows}</g>}{showLoadValues && load && <text x={(beamTop[0].x + beamTop[2].x) / 2} y={(beamTop[0].y + beamTop[2].y) / 2 - 8} className="fill-[#ff1717] text-[8px] font-bold" style={{ paintOrder: "stroke", stroke: "#ffffff", strokeWidth: 3 }}>{load.lineKnM?.toFixed(2)} kN/m</text>}</g>;
                    }
                    if (item.type === "Poteau") {
                      const resolved = resolvedDimensions(item, modelCatalog);
                      const isCircular = /^\s*Pot[_ -]?D|diam(?:ètre|etre)/i.test(item.section ?? "") || /^\s*0?[.,]\d+\s*m\s*$/i.test(resolved);
                      const center = metricPoint(item.x, item.y);
                      const baseZ = columnBaseElevation(levels, levelIndex);
                      const topZ = postTopElevation(level, levelIndex);
                      const stroke = selectedElementKey === `${level.id}:${item.id}` ? "#e87538" : color;
                      if (isCircular) {
                        const load = loadVisuals[analysisKey];
                        const diameter = Math.max(0.10, sectionValueMeters(resolved.replace(/[^0-9.,]/g, ""), resolved));
                        const radius = diameter / 2;
                        const n = 20;
                        const ring = (zValue: number) => Array.from({ length: n }, (_, i) => {
                          const a = (Math.PI * 2 * i) / n;
                          return projectMetric(center.x + Math.cos(a) * radius, center.y + Math.sin(a) * radius, zValue);
                        });
                        const bottom = ring(baseZ);
                        const top = ring(topZ);
                        const sideFaces = top.map((point, i) => {
                          const next = (i + 1) % n;
                          return <polygon key={`circular-column-face-${i}`} points={polygon([bottom[i], bottom[next], top[next], top[i]])} fill={color} fillOpacity=".82" stroke={stroke} strokeWidth={selectedElementKey === `${level.id}:${item.id}` ? 1.6 : 0.8} />;
                        });
                        return <g key={`${level.id}-${item.id}`} className={selectionEnabled ? "cursor-pointer" : undefined} onPointerDown={selectionEnabled ? event => { event.stopPropagation(); onElementSelect?.(level.id, item); } : undefined}>{sideFaces}<polygon points={polygon(top)} fill={color} fillOpacity=".94" stroke={stroke} strokeWidth={selectedElementKey === `${level.id}:${item.id}` ? 2 : 1} /><text x={top[Math.floor(n / 4)].x + 6} y={top[Math.floor(n / 4)].y - 6} className="fill-[#27358f] text-[9px] font-bold" style={{ paintOrder: "stroke", stroke: "#c9e3f3", strokeWidth: 3 }}>{item.id}</text>{showLoadValues && load && <text x={top[Math.floor(n / 4)].x + 6} y={top[Math.floor(n / 4)].y + 5} className="fill-[#ff1717] text-[8px] font-bold" style={{ paintOrder: "stroke", stroke: "#ffffff", strokeWidth: 3 }}>Nu {load.nu.toFixed(1)} kN</text>}</g>;
                      }
                      const load = loadVisuals[analysisKey];
                      const [postWidth, postDepth] = sectionPair(resolved, [0.20, 0.30]);
                      const bottom = [projectMetric(center.x - postWidth / 2, center.y - postDepth / 2, baseZ), projectMetric(center.x + postWidth / 2, center.y - postDepth / 2, baseZ), projectMetric(center.x + postWidth / 2, center.y + postDepth / 2, baseZ), projectMetric(center.x - postWidth / 2, center.y + postDepth / 2, baseZ)];
                      const top = [projectMetric(center.x - postWidth / 2, center.y - postDepth / 2, topZ), projectMetric(center.x + postWidth / 2, center.y - postDepth / 2, topZ), projectMetric(center.x + postWidth / 2, center.y + postDepth / 2, topZ), projectMetric(center.x - postWidth / 2, center.y + postDepth / 2, topZ)];
                      const faces = [top, bottom, [bottom[0], bottom[1], top[1], top[0]], [bottom[1], bottom[2], top[2], top[1]], [bottom[2], bottom[3], top[3], top[2]], [bottom[3], bottom[0], top[0], top[3]]];
                      return <g key={`${level.id}-${item.id}`} className={selectionEnabled ? "cursor-pointer" : undefined} onPointerDown={selectionEnabled ? event => { event.stopPropagation(); onElementSelect?.(level.id, item); } : undefined}>{faces.map((face, index) => <polygon key={`column-face-${index}`} points={polygon(face)} fill={color} fillOpacity={index === 0 ? ".94" : ".82"} stroke={stroke} strokeWidth={selectedElementKey === `${level.id}:${item.id}` ? 2 : 1} />)}<text x={top[2].x + 6} y={top[2].y - 6} className="fill-[#27358f] text-[9px] font-bold" style={{ paintOrder: "stroke", stroke: "#c9e3f3", strokeWidth: 3 }}>{item.id}</text>{showLoadValues && load && <text x={top[2].x + 6} y={top[2].y + 4} className="fill-[#ff1717] text-[8px] font-bold" style={{ paintOrder: "stroke", stroke: "#ffffff", strokeWidth: 3 }}>Nu {load.nu.toFixed(1)} kN</text>}</g>;
                    }
                    const load = loadVisuals[analysisKey];
                    const footingDimensions = resolvedDimensions(item, modelCatalog);
                    const footingMatch = footingDimensions?.match(/(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)/i);
                    const footingWidth = footingMatch ? sectionValueMeters(footingMatch[1], footingDimensions) : FOOTING_3D_HALF_X * 2;
                    const footingDepth = footingMatch ? sectionValueMeters(footingMatch[2], footingDimensions) : FOOTING_3D_HALF_Y * 2;
                    const footingHeight = footingMatch ? sectionValueMeters(footingMatch[3], footingDimensions) : FOOTING_3D_HEIGHT;
                    const footingCenter = metricPoint(item.x, item.y);
                    const bottom = [
                      projectMetric(footingCenter.x - footingWidth / 2, footingCenter.y - footingDepth / 2, z),
                      projectMetric(footingCenter.x + footingWidth / 2, footingCenter.y - footingDepth / 2, z),
                      projectMetric(footingCenter.x + footingWidth / 2, footingCenter.y + footingDepth / 2, z),
                      projectMetric(footingCenter.x - footingWidth / 2, footingCenter.y + footingDepth / 2, z),
                    ];
                    const top = [
                      projectMetric(footingCenter.x - footingWidth / 2, footingCenter.y - footingDepth / 2, z + footingHeight),
                      projectMetric(footingCenter.x + footingWidth / 2, footingCenter.y - footingDepth / 2, z + footingHeight),
                      projectMetric(footingCenter.x + footingWidth / 2, footingCenter.y + footingDepth / 2, z + footingHeight),
                      projectMetric(footingCenter.x - footingWidth / 2, footingCenter.y + footingDepth / 2, z + footingHeight),
                    ];
                    return (
                      <g
                        key={`${level.id}-${item.id}`}
                        className={
                          selectionEnabled ? "cursor-pointer" : undefined
                        }
                        onPointerDown={
                          selectionEnabled
                            ? event => {
                                event.stopPropagation();
                                onElementSelect?.(level.id, item);
                              }
                            : undefined
                        }
                      >
                        <polygon
                          points={polygon(bottom)}
                          fill={color}
                          fillOpacity=".98"
                          stroke={
                            selectedElementKey === `${level.id}:${item.id}`
                              ? "#e87538"
                              : color
                          }
                          strokeWidth={
                            selectedElementKey === `${level.id}:${item.id}`
                              ? 3
                              : 1.5
                          }
                        />
                        <polygon
                          points={polygon(top)}
                          fill={color}
                          fillOpacity=".98"
                          stroke={color}
                          strokeWidth="1.5"
                        />
                        <polygon
                          points={polygon([
                            bottom[0],
                            bottom[1],
                            top[1],
                            top[0],
                          ])}
                          fill={color}
                          fillOpacity=".92"
                        />
                        <polygon
                          points={polygon([
                            bottom[1],
                            bottom[2],
                            top[2],
                            top[1],
                          ])}
                          fill={color}
                          fillOpacity=".9"
                        />
                        <polygon
                          points={polygon([
                            bottom[2],
                            bottom[3],
                            top[3],
                            top[2],
                          ])}
                          fill={color}
                          fillOpacity=".86"
                        />
                        <polygon
                          points={polygon([
                            bottom[3],
                            bottom[0],
                            top[0],
                            top[3],
                          ])}
                          fill={color}
                          fillOpacity=".88"
                        />
                        <text
                          x={top[2].x + 7}
                          y={top[2].y + 10}
                          className="fill-[#54208b] text-[9px] font-bold"
                          style={{
                            paintOrder: "stroke",
                            stroke: "#c9e3f3",
                            strokeWidth: 3,
                          }}
                        >
                          {level.elements.find(candidate => candidate.type === "Poteau" && Math.abs(candidate.x - item.x) < 0.001 && Math.abs(candidate.y - item.y) < 0.001)?.id ?? ""}
                        </text>
                        {showLoadValues && load && <text x={top[2].x + 7} y={top[2].y + 22} className="fill-[#ff1717] text-[8px] font-bold" style={{ paintOrder: "stroke", stroke: "#ffffff", strokeWidth: 3 }}>Nu {load.nu.toFixed(1)} kN</text>}
                      </g>
                    );
                  })}
                <text
                  x={slab[0].x - 10}
                  y={slab[0].y - 8}
                  className="fill-[#315a6c] text-[9px] font-bold"
                >
                  {level.label} · {displayLevelHeight(levelIndex).toFixed(2)} m
                </text>
              </g>
            );
          })}
        </g>
        {stairPlacementActive && (
          <g style={{ pointerEvents: "auto" }}>
            {(stairPlacementStage === 1 || stairPlacementStage === 3) && stairArrivalBeams.map(beam => {
              const a = project(beam.x, beam.y, 0);
              const b = project(beam.x2 ?? beam.x, beam.y2 ?? beam.y, 0);
              const labelX = (a.x + b.x) / 2;
              const labelY = (a.y + b.y) / 2 - 12;
              return <g key={`stair-hit-beam-${beam.id}`}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#e87538" strokeWidth="28" opacity=".16" onPointerEnter={() => onStairBeamHover?.(beam)} onPointerLeave={() => onStairBeamHover?.(null)} onPointerDown={event => { event.stopPropagation(); onStairBeamSelect?.(beam); }} />
                <text x={labelX} y={labelY} textAnchor="middle" fontSize="11" fontWeight="700" fill="#9a4318" pointerEvents="none">Arrivée</text>
              </g>;
            })}
            {(stairPlacementStage === 2 ? stairPolePoints : []).map(({ x, y }) => {
              const point = project(x, y, 0);
              const isStart = stairPlacementStart?.x === x && stairPlacementStart?.y === y;
              const isLanding = stairLandingPoint?.x === x && stairLandingPoint?.y === y;
              const label = isStart ? "Départ" : isLanding ? "Palier" : undefined;
              return <g key={`stair-hit-node-${x}-${y}`}>
                <circle cx={point.x} cy={point.y} r="20" fill={isStart ? "#e53935" : isLanding ? "#f59e0b" : "#ffffff"} fillOpacity={isStart || isLanding ? ".25" : ".12"} stroke={isStart ? "#e53935" : isLanding ? "#f59e0b" : "#e87538"} strokeWidth="2" onPointerDown={event => { event.stopPropagation(); onStairPointSelect?.({ x, y }); }} />
                {label && <text x={point.x + 14} y={point.y - 12} fontSize="11" fontWeight="700" fill={isStart ? "#b91c1c" : "#a16207"} pointerEvents="none">{label}</text>}
              </g>;
            })}
          </g>
        )}
        {stairPlacementActive && stairPlacementStage === 3 && stairPreviewBeam && stairPlacementStart && stairLandingPoint && (
          <g pointerEvents="none" opacity=".38">
            {(() => {
              const previewBeam = stairPreviewBeam;
              if (!previewBeam) return null;
              const level = levels[levels.length - 1];
              const height = Math.max(level ? levelHeight(level) : 3.2, 0.1);
              const endX = previewBeam.x2 ?? previewBeam.x;
              const endY = previewBeam.y2 ?? previewBeam.y;
              const start = project(stairPlacementStart.x, stairPlacementStart.y, 0);
              const mid = project(stairLandingPoint.x, stairLandingPoint.y, height / 2);
              const end = project(endX, endY, height);
              return <>
                <line x1={start.x} y1={start.y} x2={mid.x} y2={mid.y} stroke="#e87538" strokeWidth="7" strokeDasharray="8 5" />
                <line x1={mid.x} y1={mid.y} x2={end.x} y2={end.y} stroke="#e87538" strokeWidth="7" strokeDasharray="8 5" />
                <circle cx={mid.x} cy={mid.y} r="20" fill="#f59e0b" fillOpacity=".45" stroke="#a16207" strokeWidth="2" />
                <text x={mid.x + 12} y={mid.y - 14} fontSize="11" fontWeight="700" fill="#8a4b08">Aperçu</text>
              </>;
            })()}
          </g>
        )}
        {legend.length > 0 && (
          <g transform="translate(10 458)">
            <rect
              width="132"
              height={25 + legend.length * 13}
              rx="8"
              fill="#ffffff"
              fillOpacity=".94"
            />
            <text x="8" y="15" className="fill-[#294b5a] text-[8px] font-bold">
              LÉGENDE
            </text>
            {legend.map((item, index) => (
              <g
                key={item.section}
                transform={`translate(8 ${25 + index * 13})`}
              >
                <rect width="7" height="7" rx="1" fill={item.color} />
                <text x="12" y="7" className="fill-[#36515c] text-[7px]">
                  {item.section}
                </text>
              </g>
            ))}
          </g>
        )}
      </svg>
      {showAnalysisValues && Object.keys(analysisValues).length > 0 && (
        <div className="absolute left-2 top-2 max-w-[190px] rounded-lg border border-white/70 bg-white/90 px-2 py-1.5 text-[9px] text-[#294b5a] shadow-sm">
          <div className="mb-1 font-bold text-[#27358f]">Valeurs d’analyse</div>
          {Object.entries(analysisValues).filter(([key]) => criticalElementKeys.includes(key)).map(([key, value]) => (
            <div key={key} className="leading-4">
              <span className="font-semibold text-[#ff1717]">{key.split(":")[1]}</span> · G {value.gk.toFixed(2)} · Q {value.qk.toFixed(2)} · Nu {value.nu.toFixed(2)} kN
              {showAnalysisMoments && value.moment !== undefined ? ` · M ${value.moment.toFixed(2)} kN·m` : ""}
            </div>
          ))}
        </div>
      )}
      <div className="absolute bottom-2 right-2 flex flex-col items-center gap-1">
        <button
          onClick={() => {
            stopInertia();
            setNavigationMode("pan");
          }}
          className={`grid h-7 w-7 place-items-center rounded-full bg-white text-sm shadow-md ${navigationMode === "pan" ? "ring-1 ring-[#e87538]" : ""}`}
          aria-label="Activer la main de déplacement"
        >
          ✋
        </button>
        <button
          onClick={() => {
            stopInertia();
            setNavigationMode("rotate");
          }}
          className={`grid h-7 w-7 place-items-center rounded-full bg-white text-sm shadow-md ${navigationMode === "rotate" ? "ring-1 ring-[#049b9b]" : ""}`}
          aria-label="Activer la rotation 3D"
        >
          ⌖
        </button>
        <button
          onClick={() => setZoom(value => Math.min(1.55, value + 0.12))}
          className="grid h-7 w-7 place-items-center rounded-full bg-white text-base leading-none shadow-md"
          aria-label="Zoom avant"
        >
          +
        </button>
        <button
          onClick={() => setZoom(value => Math.max(0.65, value - 0.12))}
          className="grid h-7 w-7 place-items-center rounded-full bg-white text-base leading-none shadow-md"
          aria-label="Zoom arrière"
        >
          −
        </button>
      </div>
    </div>
  );
}
