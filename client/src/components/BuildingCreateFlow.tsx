import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Calculator,
  ChevronLeft,
  Copy,
  Download,
  Grid3X3,
  History,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Rotate3D,
  Save,
  Settings2,
  Table2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { DSRCAD_COUNTRIES, DSRCAD_NORMS } from "@shared/dsrcad";
import {
  restoreBuildingDraft,
  serializeBuildingDraft,
  validateBuildingName,
} from "@shared/building-flow";
import { proposeSoil } from "@shared/site-soil";
import {
  moveElement,
  removeElement,
  updateElement,
} from "@shared/building-elements";
import {
  defaultFloorConfig,
  normalizeFloorConfig,
  type FloorConfig,
} from "@shared/floor-config";
import { floorNoteSummary } from "@shared/floor-validation";
import { gridRectangle, isGridIntersection, snapToGridPoint } from "@shared/grid-geometry";
import { summarizeFloorLoads } from "@shared/floor-load";
import { elementLoadSummary } from "@shared/element-loads";
import { buildLoadDescentReport } from "@shared/load-report";
import FloorConfigPanel from "@/components/FloorConfigPanel";
import GridAxisPanel from "@/components/GridAxisPanel";
import ModelCatalogPanel from "@/components/ModelCatalogPanel";
import Building3DView from "@/components/Building3DView";
import { MODEL_CATALOG, mergeModelCatalog, modelColor, modelSpec, type ModelSpec } from "@shared/model-catalog";
import { deriveOppositeLandingCorner } from "@shared/stair-geometry";
import {
  elementLabel,
  renumberBuildingElements,
  renumberElements,
} from "@shared/element-labels";
import {
  cumulativeGridPositions,
  proportionalGridScale,
} from "@shared/proportional-grid";
import { levelIndexShift } from "@shared/vertical-structure";
import { type ClosedFloorArea } from "@shared/floor-area";
import {
  canCoLocate,
  canPlaceBeamBetween,
  canPlaceTieBeamBetween,
  hasSimilarElementAt,
} from "@shared/placement-validation";
import { buildModelLegend } from "@shared/model-legend";
import {
  buildBuildingLoadModel,
  summarizeBuildingLoads,
} from "@shared/building-load-propagation";
import {
  MODEL_COLOR_PALETTE,
  normalizeModelColor,
} from "@shared/model-palette";
import { loadCatalogForFloor } from "@shared/load-catalog";
import { getRegulatorySiteProfile } from "@shared/regulatory";
import { evaluateSenegalConstructionCode } from "@shared/senegal-construction-code";
import { getCitiesForCountry } from "@shared/city-climate";
import { createLoadScale } from "@shared/load-color-scale";
import { buildLoadSynthesis, loadFamilyLabel } from "@shared/load-synthesis";
import { buildAnalyticalModel, DEFAULT_NODE_MERGE_TOLERANCE_M, type AnalyticalModel, type AnalyticalPrecheck } from "@shared/analytical-model";
import { createDefaultLoadProgram, evaluateLoadProgram, normalizeLoadProgram, validateLoadProgram, type LoadProgram } from "@shared/load-case-program";
import { buildGravityMemberLoads, solveAnalyticalPlane, type FramePlane, type PlaneFrameResult } from "@shared/frame-solver-2d";
import { solveGlobal3D, type Spatial3DStoryLateralLoad, type Spatial3DResult } from "@shared/frame-solver-3d";
import { runProfessionalAnalysis } from "@shared/professional-analysis";
import { analyzeSimplySupportedRectangularPlate, checkRectangularSurfaceEdgeSupports, meshRectangularSurface, type RectangularOpening, type SurfaceAnalysis } from "@shared/surface-analysis";
import { deriveStoryMassesFromCumulativeLoads, generateClimateActions, parseClimateSpectrum, type ClimateActionInput, type ClimateActionsResult, type ClimateFieldSource } from "@shared/climate-actions";
import { deriveRCMemberDemandsFromPlane, deriveRCMemberDemandsFromSpatial, type RCDesignResult, type RCMemberDemand, type RCSlabDemand, type RCFootingDemand } from "@shared/rc-design";
import { mapFoundationReactions } from "@shared/foundation-reaction";
import type { WallDemand } from "@shared/wall-design";
import ReinforcedConcretePanel from "@/components/ReinforcedConcretePanel";
import FoundationReactionPanel, { type FoundationPanelEvaluation } from "@/components/FoundationReactionPanel";
import { createStructuralPassport, createStructuralReport, renderStructuralPassport, renderStructuralReport } from "@shared/structural-report";
import { loadReinforcementTemplate, saveReinforcementTemplate, type ReinforcementTemplate } from "@shared/reinforcement-report";
import { createBuildingProjectBundle, loadBuildingProjectHistory, loadBuildingProjects, parseBuildingProjectBundle, saveBuildingProject, serializeBuildingProjectBundle, type BuildingProjectSnapshot } from "@shared/building-persistence";

type Props = {
  threeD: boolean;
  setThreeD: (value: boolean) => void;
  norm: string;
  setNorm: (value: string) => void;
  country: string;
  setCountry: (value: string) => void;
  onExport: (details?: string) => void;
};
type Level = {
  id: string;
  label: string;
  elevation: string;
  height?: string;
  elements: ElementItem[];
};
type GridPoint = { x: number; y: number };
type SurfaceRunRow = { elementId: string; levelLabel: string; areaM2: number; openingCount: number; spanXM: number; spanYM: number; thicknessMm: number; uniformLoadKnM2: number; supportReactionKn: number; columnWidthMm: number; columnDepthMm: number; negativeMxKnMPerM: number; negativeMyKnMPerM: number; floorType: FloorConfig["type"]; analysis: SurfaceAnalysis; supportErrors: string[] };
type ClimateDraft = {
  schemaVersion: 1;
  sourceReference: string;
  sourceClaim: "user-input" | "official";
  altitudeM: string;
  terrainCategory: string;
  wind: { basicSpeedMPerS: string; exposureFactor: string; orographyFactor: string; topographyFactor: string; netPressureCoefficientX: string; netPressureCoefficientY: string; airDensityKgM3: string };
  snow: { groundLoadKnM2: string; shapeCoefficient: string; exposureCoefficient: string; thermalCoefficient: string; asymmetryRatio: string };
  seismic: { zone: string; soilClass: string; importanceClass: string; designLifeYears: string; referenceAccelerationG: string; importanceFactor: string; behaviourFactor: string; dampingFactor: string; spectrumText: string; storyStiffnessKnPerM: string[] };
};
const createClimateDraft = (storyCount = 1): ClimateDraft => ({
  schemaVersion: 1,
  sourceReference: "",
  sourceClaim: "user-input",
  altitudeM: "",
  terrainCategory: "",
  wind: { basicSpeedMPerS: "", exposureFactor: "", orographyFactor: "", topographyFactor: "", netPressureCoefficientX: "", netPressureCoefficientY: "", airDensityKgM3: "1.225" },
  snow: { groundLoadKnM2: "", shapeCoefficient: "", exposureCoefficient: "", thermalCoefficient: "", asymmetryRatio: "0" },
  seismic: { zone: "", soilClass: "", importanceClass: "", designLifeYears: "", referenceAccelerationG: "", importanceFactor: "", behaviourFactor: "", dampingFactor: "", spectrumText: "", storyStiffnessKnPerM: Array.from({ length: storyCount }, () => "") },
});
const climateNumber = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};
const normalizeClimateDraft = (value: unknown, storyCount: number): ClimateDraft => {
  const base = createClimateDraft(storyCount);
  if (!value || typeof value !== "object") return base;
  const saved = value as Partial<ClimateDraft>;
  const stiffness = Array.isArray(saved.seismic?.storyStiffnessKnPerM) ? saved.seismic.storyStiffnessKnPerM : [];
  return {
    ...base,
    ...saved,
    schemaVersion: 1,
    wind: { ...base.wind, ...saved.wind },
    snow: { ...base.snow, ...saved.snow },
    seismic: { ...base.seismic, ...saved.seismic, storyStiffnessKnPerM: Array.from({ length: storyCount }, (_, index) => stiffness[index] ?? "") },
  };
};
type StairFlightGeometry = {
  lowerA: GridPoint;
  lowerB: GridPoint;
  upperA: GridPoint;
  upperB: GridPoint;
  lowerLevelId: string;
  upperLevelId: string;
};
type StairGeometry = {
  flight1?: StairFlightGeometry;
  flight2?: StairFlightGeometry;
  baseA?: GridPoint;
  baseB?: GridPoint;
  midA?: GridPoint;
  midB?: GridPoint;
  topA?: GridPoint;
  topB?: GridPoint;
  landingZ: number;
  absolute?: {
    flight1?: StairFlightGeometry;
    flight2?: StairFlightGeometry;
    baseA?: GridPoint;
    baseB?: GridPoint;
    midA?: GridPoint;
    midB?: GridPoint;
    topA?: GridPoint;
    topB?: GridPoint;
    landingZ: number;
  };
};
const remapStairGeometryLevels = (
  geometry: StairGeometry | undefined,
  levels: Array<{ id: string }>,
  sourceLevelId: string,
  targetLevelId: string
): StairGeometry | undefined => {
  if (!geometry) return undefined;
  // Une copie vers R+1 doit commencer sur R+1, et non sur le niveau inférieur RDC.
  // Le niveau sélectionné représente le niveau de base de la nouvelle travée.
  const levelShift = levelIndexShift(levels, sourceLevelId, targetLevelId) + 1;
  const translateLevelId = (levelId: string) => {
    const originalIndex = levels.findIndex(level => level.id === levelId);
    const translatedIndex = originalIndex >= 0 ? originalIndex + levelShift : -1;
    return levels[translatedIndex]?.id ?? levelId;
  };
  const remapFlight = (flight: StairFlightGeometry | undefined) =>
    flight
      ? {
          ...flight,
          lowerLevelId: translateLevelId(flight.lowerLevelId),
          upperLevelId: translateLevelId(flight.upperLevelId),
        }
      : undefined;
  const remapAbsolute = geometry.absolute
    ? {
        ...geometry.absolute,
        flight1: remapFlight(geometry.absolute.flight1),
        flight2: remapFlight(geometry.absolute.flight2),
      }
    : undefined;
  return {
    ...geometry,
    flight1: remapFlight(geometry.flight1),
    flight2: remapFlight(geometry.flight2),
    absolute: remapAbsolute,
  };
};

const numericGridDistance = (value: string | number | undefined, fallback = 4) =>
  Math.max(Number(String(value ?? fallback).replace(",", ".")) || fallback, 0.01);
const positionsToDistances = (positions: number[]) =>
  positions.slice(0, -1).map((position, index) =>
    Math.max(positions[index + 1] - position, 0.01).toFixed(2)
  );
const indexToMetric = (value: number, positions: number[]) => {
  if (!positions.length) return value;
  const last = positions.length - 1;
  if (value <= 0) return positions[0];
  if (value >= last) return positions[last];
  const index = Math.floor(value);
  const ratio = value - index;
  return positions[index] + (positions[index + 1] - positions[index]) * ratio;
};
const metricOfElement = (element: Pick<ElementItem, "x" | "y" | "x2" | "y2" | "xMid" | "yMid" | "xM" | "yM" | "x2M" | "y2M" | "xMidM" | "yMidM">, xPositions: number[], yPositions: number[]) => ({
  xM: element.xM ?? indexToMetric(element.x, xPositions),
  yM: element.yM ?? indexToMetric(element.y, yPositions),
  x2M: element.x2 === undefined ? element.x2M : (element.x2M ?? indexToMetric(element.x2, xPositions)),
  y2M: element.y2 === undefined ? element.y2M : (element.y2M ?? indexToMetric(element.y2, yPositions)),
  xMidM: element.xMid === undefined ? element.xMidM : (element.xMidM ?? indexToMetric(element.xMid, xPositions)),
  yMidM: element.yMid === undefined ? element.yMidM : (element.yMidM ?? indexToMetric(element.yMid, yPositions)),
});
const metricToIndex = (metric: number, positions: number[]) => {
  if (!positions.length) return metric;
  if (metric <= positions[0]) {
    const span = Math.max(positions[1] - positions[0], 0.01);
    return (metric - positions[0]) / span;
  }
  const last = positions.length - 1;
  if (metric >= positions[last]) {
    const span = Math.max(positions[last] - positions[last - 1], 0.01);
    return last + (metric - positions[last]) / span;
  }
  const segment = positions.findIndex((position, index) => index < last && metric >= position && metric <= positions[index + 1]);
  if (segment < 0) return 0;
  const span = Math.max(positions[segment + 1] - positions[segment], 0.01);
  return segment + (metric - positions[segment]) / span;
};
const remapIndexByMetric = (value: number, oldPositions: number[], nextPositions: number[]) => {
  if (!oldPositions.length || !nextPositions.length) return value;
  const metric = indexToMetric(value, oldPositions);
  const last = nextPositions.length - 1;
  if (metric <= nextPositions[0]) return 0;
  if (metric >= nextPositions[last]) return last;
  const segment = nextPositions.findIndex((position, index) =>
    index < last && metric >= position && metric <= nextPositions[index + 1]
  );
  if (segment < 0) return Math.max(0, Math.min(last, value));
  const span = Math.max(nextPositions[segment + 1] - nextPositions[segment], 0.01);
  return segment + (metric - nextPositions[segment]) / span;
};
const remapPointFields = (
  value: unknown,
  oldX: number[],
  oldY: number[],
  nextX: number[],
  nextY: number[]
): unknown => {
  if (Array.isArray(value)) return value.map(entry => remapPointFields(entry, oldX, oldY, nextX, nextY));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
      if (["x", "x2", "xMid"].includes(key) && typeof entry === "number")
        return [key, remapIndexByMetric(entry, oldX, nextX)];
      if (["y", "y2", "yMid"].includes(key) && typeof entry === "number")
        return [key, remapIndexByMetric(entry, oldY, nextY)];
      return [key, remapPointFields(entry, oldX, oldY, nextX, nextY)];
    })
  );
};

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
  /** Coordonnées physiques en mètres, indépendantes de la trame. Elles constituent la géométrie canonique. */
  xM?: number;
  yM?: number;
  x2M?: number;
  y2M?: number;
  xMidM?: number;
  yMidM?: number;
  floorConfig?: FloorConfig;
  openings?: RectangularOpening[];
  stairGeometry?: StairGeometry;
  absoluteStairGeometry?: StairGeometry["absolute"];
};
type Project = {
  id: string;
  name: string;
  updatedAt: string;
  levels: Level[];
  city: string;
  location: string;
  structure: string;
  norm: string;
  country: string;
  projectUsage?: ProjectUsage;
  optimizationLockedElementIds?: string[];
};
type ProjectUsage = "habitation" | "logement" | "bureau" | "commerce";
const PROJECT_USAGE_OPTIONS: Array<{ id: ProjectUsage; label: string; load: number; stairLoad: number }> = [
  { id: "habitation", label: "Habitation individuelle", load: 2, stairLoad: 3 },
  { id: "logement", label: "Logement collectif", load: 2, stairLoad: 3 },
  { id: "bureau", label: "Bureaux", load: 2.5, stairLoad: 3 },
  { id: "commerce", label: "Commerce", load: 5, stairLoad: 4 },
];
const usageProfile = (usage: ProjectUsage = "habitation") => PROJECT_USAGE_OPTIONS.find(item => item.id === usage) ?? PROJECT_USAGE_OPTIONS[0];
type BuildingWorkspaceSnapshot = {
  buildingConfig: Record<string, unknown>;
  customModels: ModelSpec[];
  floorConfigs: Record<string, FloorConfig>;
  loadProgram: LoadProgram;
  climateDraft: ClimateDraft;
  visual: { threeD: boolean; showLabels: boolean; gridOpacity: string; snapToGrid: boolean };
};

const parseSurfaceOpeningLines = (text: string): { openings: RectangularOpening[]; error: string | null } => {
  const lines = text.split("\n").map(line => line.trim()).filter(Boolean);
  const openings: RectangularOpening[] = [];
  for (let index = 0; index < lines.length; index++) {
    const values = lines[index].split(";").map(value => Number(value.trim().replace(",", ".")));
    if (values.length !== 4 || values.some(value => !Number.isFinite(value)))
      return { openings, error: `Trémie ${index + 1} : saisir x1;y1;x2;y2 en mètres (quatre nombres séparés par des points-virgules).` };
    const [x1M, y1M, x2M, y2M] = values;
    if (x1M < 0 || y1M < 0 || x2M <= x1M || y2M <= y1M)
      return { openings, error: `Trémie ${index + 1} : les dimensions doivent être positives depuis le coin inférieur gauche du plancher.` };
    openings.push({ x1M, y1M, x2M, y2M });
  }
  return { openings, error: null };
};

const initialLevels = (): Level[] => [
  {
    id: "foundation",
    label: "Fondation",
    elevation: "-1.00",
    height: "1.00",
    elements: [],
  },
  { id: "rdc", label: "RDC", elevation: "0.00", height: "3.20", elements: [] },
];
const menuItems = [
  "Grille de trame",
  "Mes modèles",
  "Éléments du niveau",
  "Dupliquer ce niveau vers…",
  "Paramètres",
  "Historique des versions",
  "Calculer la descente",
];

export default function BuildingCreateFlow({
  threeD,
  setThreeD,
  norm,
  setNorm,
  country,
  setCountry,
  onExport,
}: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  useEffect(() => {
    setOptimizationLockedElementIds(new Set(selected?.optimizationLockedElementIds ?? []));
  }, [selected?.id, selected?.optimizationLockedElementIds]);
  const [projectsHydrated, setProjectsHydrated] = useState(false);
  const [persistenceStatus, setPersistenceStatus] = useState("Récupération locale…");
  const [autosaveRetry, setAutosaveRetry] = useState(0);
  const [conflictProjectId, setConflictProjectId] = useState<string | null>(null);
  const [projectHistory, setProjectHistory] = useState<BuildingProjectSnapshot<Project>[]>([]);
  const projectRevisions = useRef<Record<string, number>>({});
  const autosaveBlocked = useRef(new Set<string>());
  const autosaveInFlight = useRef(new Set<string>());
  const autosavePending = useRef(new Set<string>());
  const projectContents = useRef<Record<string, string>>({});
  const workspaceByProject = useRef<Record<string, BuildingWorkspaceSnapshot>>({});
  const projectImportInput = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectUsage, setProjectUsage] = useState<ProjectUsage>("habitation");
  const [activeLevelId, setActiveLevelId] = useState("rdc");
  const [showMenu, setShowMenu] = useState(false);
  const [showPersistenceMenu, setShowPersistenceMenu] = useState(false);
  const [panel, setPanel] = useState<string | null>(null);
  const [modelType, setModelType] = useState("Poteau");
  const [modelSection, setModelSection] = useState("Pot_20x30");
  const [customModels, setCustomModels] = useState<ModelSpec[]>([]);
  const [xAxes, setXAxes] = useState(["1", "2", "3", "4"]);
  const [yAxes, setYAxes] = useState(["A", "B", "C", "D"]);
  const [xDistances, setXDistances] = useState(["4.00", "4.00", "4.00"]);
  const [yDistances, setYDistances] = useState(["4.00", "4.00", "4.00"]);
  const [xNumbering, setXNumbering] = useState("numeric");
  const [yNumbering, setYNumbering] = useState("alpha");
  const [zLevels, setZLevels] = useState(["Fondation -1.00 m", "RDC 0.00 m"]);
  const [city, setCity] = useState("Dakar");
  const [location, setLocation] = useState("");
  const [structure, setStructure] = useState("Béton armé");
  const [reinforcementTemplate, setReinforcementTemplate] = useState<ReinforcementTemplate>(() => loadReinforcementTemplate());
  const [loads, setLoads] = useState({
    permanent: true,
    exploitation: true,
    wind: false,
    seismic: false,
  });
  const [loadProgram, setLoadProgram] = useState<LoadProgram>(() => createDefaultLoadProgram(norm, usageProfile().id));
  const [gridDistance, setGridDistance] = useState("4.00");
  const [editingElement, setEditingElement] = useState<ElementItem | null>(
    null
  );
  const [editType, setEditType] = useState("Poteau");
  const [editSection, setEditSection] = useState("Pot_20×30");
  const [editX, setEditX] = useState("0");
  const [editY, setEditY] = useState("0");
  const [editSurfaceOpenings, setEditSurfaceOpenings] = useState("");
  const [editColor, setEditColor] = useState("#27358f");
  const [targetLevelId, setTargetLevelId] = useState("rdc");
  const [showLabels, setShowLabels] = useState(true);
  const [gridOpacity, setGridOpacity] = useState("100");
  const [analyticalTolerance, setAnalyticalTolerance] = useState(String(DEFAULT_NODE_MERGE_TOLERANCE_M));
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [floorConfig, setFloorConfig] =
    useState<FloorConfig>(defaultFloorConfig);
  const [placementStart, setPlacementStart] = useState<GridPoint | null>(null);
  const [stairLandingPoint, setStairLandingPoint] = useState<GridPoint | null>(null);
  const [stairConstructionPoints, setStairConstructionPoints] = useState<GridPoint[]>([]);
  const [stairPointLevels, setStairPointLevels] = useState<string[]>([]);
  const [stairPlacementStage, setStairPlacementStage] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(1);
  const [stairArrivalBeamId, setStairArrivalBeamId] = useState<string | null>(null);
  const [stairPreviewBeam, setStairPreviewBeam] = useState<ElementItem | null>(null);
  const [gridPan, setGridPan] = useState({ x: 0, y: 0 });
  const [gridZoom, setGridZoom] = useState(1);
  const [dragState, setDragState] = useState<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const [draggedElement, setDraggedElement] = useState<{
    id: string;
    start: GridPoint;
    x2?: number;
    y2?: number;
  } | null>(null);
  const [hoverPoint, setHoverPoint] = useState<GridPoint | null>(null);
  const [floorPreview, setFloorPreview] = useState<ClosedFloorArea | null>(
    null
  );
  const [movementHistory, setMovementHistory] = useState<{
    past: Project[];
    future: Project[];
  }>({ past: [], future: [] });
  const [elementSelectionMode, setElementSelectionMode] = useState(false);
  const [selected3DElementKey, setSelected3DElementKey] = useState<
    string | null
  >(null);
  const [editingLevelId, setEditingLevelId] = useState<string | null>(null);
  const [duplicateTargetLevelIds, setDuplicateTargetLevelIds] = useState<string[]>([]);
  const [duplicateIds, setDuplicateIds] = useState<string[]>([]);
  const [buildingCalculation, setBuildingCalculation] = useState<ReturnType<
    typeof summarizeBuildingLoads
  > | null>(null);
  const [optimizationRecalcRequested, setOptimizationRecalcRequested] = useState(false);
  const [optimizationLockedElementIds, setOptimizationLockedElementIds] = useState<Set<string>>(new Set());
  const [analyticalModel, setAnalyticalModel] = useState<AnalyticalModel | null>(null);
  const [analyticalPrecheck, setAnalyticalPrecheck] = useState<AnalyticalPrecheck | null>(null);
  const [buildingLoadModel, setBuildingLoadModel] = useState<ReturnType<typeof buildBuildingLoadModel> | null>(null);
  const [showCalculationPreflight, setShowCalculationPreflight] = useState(false);
  const [meshPrerequisiteReady, setMeshPrerequisiteReady] = useState(false);
  const [loadCasesPrerequisiteReady, setLoadCasesPrerequisiteReady] = useState(false);
  const [analysisPlane, setAnalysisPlane] = useState<FramePlane>("XZ");
  const [solverCombinationId, setSolverCombinationId] = useState("comb:uls-gravity");
  const [planeAnalysis, setPlaneAnalysis] = useState<{ result: PlaneFrameResult | null; errors: string[]; warnings: string[]; combinationId?: string; combinationName?: string; memberLoads: ReturnType<typeof buildGravityMemberLoads>["memberLoads"]; comparison?: { expectedReactionKn: number; solverReactionKn: number; differencePercent: number } } | null>(null);
  const [surfaceMeshSizeM, setSurfaceMeshSizeM] = useState("0.75");
  const [surfaceAnalysis, setSurfaceAnalysis] = useState<{ rows: SurfaceRunRow[]; errors: string[]; warnings: string[]; combinationId?: string; combinationName?: string } | null>(null);
  const [automaticFoundationResult, setAutomaticFoundationResult] = useState<PlaneFrameResult | null>(null);
  const [spatial3DResult, setSpatial3DResult] = useState<Spatial3DResult | null>(null);
  const [climateDraft, setClimateDraft] = useState<ClimateDraft>(() => createClimateDraft());
  const [climateLoadedProjectId, setClimateLoadedProjectId] = useState<string | null>(null);
  const [climateAnalysis, setClimateAnalysis] = useState<ClimateActionsResult | null>(null);
  const [rcDesignResult, setRcDesignResult] = useState<RCDesignResult | null>(null);
  const [foundationEvaluation, setFoundationEvaluation] = useState<FoundationPanelEvaluation | null>(null);
  const [lastStructuralReport, setLastStructuralReport] = useState("");
  const [selectedAnalysisRow, setSelectedAnalysisRow] = useState<
    ReturnType<typeof summarizeBuildingLoads>["rows"][number] | null
  >(null);
  const [showAnalysisValues, setShowAnalysisValues] = useState(false);
  const [showAnalysisMoments, setShowAnalysisMoments] = useState(false);
  const [showLoadValues, setShowLoadValues] = useState(false);
  const dragSnapshot = useRef<Project | null>(null);
  const beamTraceRef = useRef(false);
  const analysisRows = buildingCalculation?.rows ?? [];
  const loadProgramPatternValues = {
    ...Object.fromEntries(loadProgram.patterns.map(pattern => [pattern.id, pattern.value])),
    G: buildingCalculation?.totalGk ?? 0,
    Q: buildingCalculation?.totalQk ?? 0,
  };
  const loadProgramEvaluation = evaluateLoadProgram(loadProgram, loadProgramPatternValues);
  const loadProgramDiagnostics = validateLoadProgram(loadProgram);
  const analysisGroups = buildLoadSynthesis(analysisRows);
  const rcMemberExtraction = useMemo(() => {
    if (analyticalModel && spatial3DResult) {
      const extracted = deriveRCMemberDemandsFromSpatial({ model: analyticalModel, result: spatial3DResult, combinationId: solverCombinationId, combinationName: loadProgram.combinations.find(item => item.id === solverCombinationId)?.name ?? solverCombinationId });
      return { ...extracted, demands: extracted.demands.map(d => ({ ...d, levelLabel: selected?.levels.find(level => level.elements.some(element => element.id === d.id))?.label ?? "Niveau non renseigné" })) };
    }
    if (!analyticalModel || !planeAnalysis?.result || !planeAnalysis.combinationId || !planeAnalysis.combinationName) return { demands: [] as RCMemberDemand[], warnings: [] as string[] };
    const extracted = deriveRCMemberDemandsFromPlane({ model: analyticalModel, result: planeAnalysis.result, combinationId: planeAnalysis.combinationId, combinationName: planeAnalysis.combinationName, memberLoads: planeAnalysis.memberLoads });
    return { ...extracted, demands: extracted.demands.map(d => ({ ...d, levelLabel: selected?.levels.find(level => level.elements.some(element => element.id === d.id))?.label ?? "Niveau non renseigné" })) };
  }, [analyticalModel, spatial3DResult, solverCombinationId, loadProgram.combinations, planeAnalysis]);
  const rcSlabDemands = useMemo<RCSlabDemand[]>(() => {
    if (!surfaceAnalysis?.combinationId || !surfaceAnalysis.combinationName) return [];
    return surfaceAnalysis.rows.map(row => {
      const plate = row.analysis.plate;
      const mxKnMPerM = plate?.maximumMxKnMPerM ?? row.uniformLoadKnM2 * row.spanXM ** 2 / 8;
      const myKnMPerM = plate?.maximumMyKnMPerM ?? row.uniformLoadKnM2 * row.spanYM ** 2 / 8;
      return {
      id: row.elementId,
      combinationId: surfaceAnalysis.combinationId as string,
      combinationName: surfaceAnalysis.combinationName as string,
      spanXM: row.spanXM,
      spanYM: row.spanYM,
      thicknessMm: row.thicknessMm,
      mxKnMPerM,
      myKnMPerM,
      serviceDeflectionMm: plate ? plate.maximumDeflectionM * 1000 : undefined,
      uniformLoadKnM2: row.uniformLoadKnM2,
      supportReactionKn: row.supportReactionKn,
      columnWidthMm: row.columnWidthMm,
      columnDepthMm: row.columnDepthMm,
      negativeMxKnMPerM: row.negativeMxKnMPerM,
      negativeMyKnMPerM: row.negativeMyKnMPerM,
      openingAreaRatio: row.areaM2 > 0 ? (row.analysis.mesh?.openingAreaM2 ?? 0) / row.areaM2 : 0,
      floorType: row.floorType,
      };
    });
  }, [surfaceAnalysis]);
  const rcFoundationDemands = useMemo<RCFootingDemand[]>(() => {
    if (!analyticalModel || !automaticFoundationResult) return [];
    const mapped = mapFoundationReactions(analyticalModel, automaticFoundationResult, "XZ");
    const combinationId = solverCombinationId;
    const combinationName = loadProgram.combinations.find(item => item.id === combinationId)?.name ?? "ELU gravitaire";
    return mapped.records.map(record => ({
      id: record.footingId,
      levelLabel: "Fondation",
      combinationId,
      combinationName,
      widthM: record.widthXM,
      lengthM: record.widthYM,
      thicknessM: record.thicknessM,
      columnWidthM: record.columnWidthM,
      columnDepthM: record.columnDepthM,
      axialKn: Math.max(0, record.verticalReactionKn),
      shearKn: Math.abs(record.horizontalReactionKn),
      momentXKnM: record.momentAxis === "x" ? Math.abs(record.momentReactionKnM) : 0,
      momentYKnM: record.momentAxis === "y" ? Math.abs(record.momentReactionKnM) : 0,
      soilBearingKPa: Number.parseFloat(proposeSoil(selected?.country ?? country, city || selected?.city || "", location || selected?.location || "").qadm) || 0,
    }));
  }, [analyticalModel, automaticFoundationResult, solverCombinationId, loadProgram.combinations, selected, country, city, location]);

  const rcWallDemands = useMemo<WallDemand[]>(() => {
    if (!selected) return [];
    const xPositions = cumulativeGridPositions(xDistances.map(value => numericGridDistance(value, numericGridDistance(gridDistance))), xAxes.length);
    const yPositions = cumulativeGridPositions(yDistances.map(value => numericGridDistance(value, numericGridDistance(gridDistance))), yAxes.length);
    const combinationId = solverCombinationId;
    const combinationName = loadProgram.combinations.find(item => item.id === combinationId)?.name ?? "ELU gravitaire";
    return selected.levels.flatMap(level => level.elements.filter(element => element.type === "Voile" && element.x2 !== undefined && element.y2 !== undefined).map(element => {
      const dimensions = (element.section ?? "0.20 × 3.20").match(/\d+(?:[.,]\d+)?/g)?.map(value => Number(value.replace(",", "."))) ?? [0.20, 3.20];
      const thicknessMm = (dimensions[0] ?? 0.20) < 2 ? (dimensions[0] ?? 0.20) * 1000 : dimensions[0] ?? 200;
      const heightMm = (Number(level.height ?? 3.2) || 3.2) * 1000;
      const ex = element.x2M ?? indexToMetric(element.x2 as number, xPositions); const ey = element.y2M ?? indexToMetric(element.y2 as number, yPositions); const sx = element.xM ?? indexToMetric(element.x, xPositions); const sy = element.yM ?? indexToMetric(element.y, yPositions); const lengthMm = Math.max(100, Math.hypot(ex - sx, ey - sy) * 1000);
      const row = analysisRows.find(candidate => candidate.id === element.id);
      return { id: element.id, levelLabel: level.label, combinationId, combinationName, lengthMm, thicknessMm, heightMm, axialKn: row?.nu ?? 0, shearKn: 0, momentXKnM: row?.moment ?? 0, momentYKnM: 0 };
    }));
  }, [selected, solverCombinationId, loadProgram.combinations, analysisRows, gridDistance, xAxes.length, yAxes.length, xDistances, yDistances]);
  const rcSourceWarnings = useMemo(() => {
    const warnings = [...rcMemberExtraction.warnings];
    if (spatial3DResult) {
      warnings.push("Les efforts de poutres/poteaux proviennent du solveur spatial 3D ; vérifier la combinaison gouvernante et la convergence P-Δ avant le dimensionnement.");
      warnings.push(...spatial3DResult.warnings);
      if (spatial3DResult.pDelta && !spatial3DResult.pDelta.converged) warnings.push("P-Δ non convergé : dimensionnement final bloqué tant que la stabilité n’est pas résolue.");
    } else if (!planeAnalysis?.result) warnings.push("Efforts de poutres/poteaux absents : lancer le solveur statique 3D (ou, à défaut, le solveur 2D).");
    else {
      warnings.push(`Le solveur de secours courant ne représente que le plan ${planeAnalysis.result.plane} et les cas gravitaires G/Q ; l’interaction biaxiale et les actions latérales ne sont pas calculées ici.`);
      warnings.push(...planeAnalysis.warnings);
      if (planeAnalysis.comparison && planeAnalysis.comparison.differencePercent > 1) warnings.push(`Écart d’équilibre global ${planeAnalysis.comparison.differencePercent.toFixed(2)} % ; revue nécessaire avant toute interprétation.`);
    }
    if (!surfaceAnalysis?.rows.some(row => row.analysis.plate)) warnings.push("Efforts de dalle absents : lancer le maillage/analyse des dalles pleines à quatre bords simplement appuyés.");
    else warnings.push(...(surfaceAnalysis?.errors ?? []));
    return Array.from(new Set(warnings));
  }, [rcMemberExtraction, spatial3DResult, planeAnalysis, surfaceAnalysis]);
  const criticalColumn = analysisRows.filter(row => row.type === "Poteau").sort((a, b) => b.nu - a.nu)[0];
  const criticalFoundation = analysisRows.filter(row => row.type === "Semelle").sort((a, b) => b.nu - a.nu)[0];
  const criticalByType = Array.from(new Set(analysisRows.map(row => row.type))).map(type => analysisRows.filter(row => row.type === type).sort((a, b) => b.nu - a.nu)[0]).filter(Boolean);
  const criticalElementKeys = criticalByType.map(row => `${row!.levelId}:${row!.id}`);
  const loadVisuals = useMemo(() => {
    const visuals: Record<string, { gk: number; qk: number; nu: number; lineKnM?: number; areaKnM2?: number; critical?: boolean }> = {};
    for (const row of analysisRows) visuals[`${row.levelId}:${row.id}`] = { gk: row.gk, qk: row.qk, nu: row.nu, critical: criticalElementKeys.includes(`${row.levelId}:${row.id}`) };
    const combination = loadProgram.combinations.find(item => item.id === solverCombinationId) ?? loadProgram.combinations.find(item => item.enabled);
    const gammaG = combination?.caseFactors["case:G"] ?? 1;
    const gammaQ = combination?.caseFactors["case:Q"] ?? 1;
    const elementLevel = new Map((selected?.levels ?? []).flatMap(level => level.elements.map(element => [element.id, level.id] as const)));
    for (const [beamId, load] of Object.entries(buildingLoadModel?.propagation.beams ?? {})) {
      const element = selected?.levels.flatMap(level => level.elements).find(item => item.id === beamId);
      const lengthM = element?.x2 !== undefined && element.y2 !== undefined ? Math.max(Math.hypot(element.x2 - element.x, element.y2 - element.y) * (Number(gridDistance.replace(",", ".")) || 4), 0.1) : 0.1;
      const levelId = elementLevel.get(beamId);
      if (!levelId) continue;
      const key = `${levelId}:${beamId}`;
      const current = visuals[key] ?? { gk: load.gk, qk: load.qk, nu: gammaG * load.gk + gammaQ * load.qk };
      visuals[key] = { ...current, gk: load.gk, qk: load.qk, nu: gammaG * load.gk + gammaQ * load.qk, lineKnM: Math.max(0, (gammaG * load.gk + gammaQ * load.qk) / lengthM) };
    }
    for (const row of surfaceAnalysis?.rows ?? []) {
      const levelId = elementLevel.get(row.elementId);
      if (!levelId) continue;
      const key = `${levelId}:${row.elementId}`;
      const current = visuals[key] ?? { gk: 0, qk: 0, nu: row.uniformLoadKnM2 };
      visuals[key] = { ...current, areaKnM2: row.uniformLoadKnM2, nu: Math.max(current.nu, row.uniformLoadKnM2) };
    }
    return visuals;
  }, [analysisRows, buildingLoadModel, gridDistance, loadProgram.combinations, selected, solverCombinationId, surfaceAnalysis, criticalElementKeys]);
  const loadScale = createLoadScale(
    analysisRows
      .filter(row => row.type === "Poteau" || row.type === "Semelle")
      .map(row => ({ id: row.id, levelId: row.levelId, type: row.type, nu: row.nu }))
  );
  const soilProposal = proposeSoil(
    selected?.country ?? country,
    city || selected?.city || "",
    location || selected?.location || ""
  );
  const regulatoryProfile = getRegulatorySiteProfile(country, city);
  const constructionCodeCompliance = useMemo(() => evaluateSenegalConstructionCode({
    country,
    buildingFloorsAboveGround: Math.max(0, (selected?.levels?.length ?? 1) - 1),
    use: projectUsage,
    housingUnits: undefined,
    publicAccess: false,
    industrialOrCommercial: projectUsage === "commerce",
    cantileverM: 0, longestBeamM: 0, buriedDepthM: 0, foundationDepthM: 0,
    underpinning: false, neighbourRetainingWorksHeightM: 0, longSpanMetalOrWoodM: 0,
    geotechnicalStudyAvailable: false, technicalControlContract: false, excavationOpeningAuthorization: false,
  }), [country, selected?.levels?.length, projectUsage]);
  const floorStorageKey = selected ? `${selected.id}:${activeLevelId}` : "";
  const createWorkspaceSnapshot = (projectId = selected?.id): BuildingWorkspaceSnapshot => {
    let allFloorConfigs: Record<string, FloorConfig> = {};
    try { allFloorConfigs = JSON.parse(sessionStorage.getItem("gcbtp-floor-configs") ?? "{}"); } catch { /* Use the in-memory active floor config. */ }
    const floorConfigs = projectId
      ? Object.fromEntries(Object.entries(allFloorConfigs).filter(([key]) => key.startsWith(`${projectId}:`))) as Record<string, FloorConfig>
      : {};
    if (projectId && !floorConfigs[`${projectId}:${activeLevelId}`]) floorConfigs[`${projectId}:${activeLevelId}`] = floorConfig;
    return {
      buildingConfig: { xAxes, yAxes, zLevels, gridDistance, loads, xNumbering, yNumbering, xDistances, yDistances, analyticalTolerance, activeLevelId },
      customModels,
      floorConfigs,
      loadProgram,
      climateDraft,
      visual: { threeD, showLabels, gridOpacity, snapToGrid },
    };
  };
  const structuralCatalog = mergeModelCatalog(customModels);
  const optionsForType = (type: string) => structuralCatalog
    .filter(model => model.type === type)
    .map(model => model.name);
  const colorForModel = (type: string, name: string) =>
    customModels.find(model => model.type === type && model.name === name)
      ?.color ?? modelColor(type, name);
  const modelTypes = Array.from(new Set(structuralCatalog.map(model => model.type)));
  const floorConfigForSection = (
    section: string,
    fallback = floorConfig
  ): FloorConfig => {
    if (
      section.toLowerCase().includes("e20") ||
      section.toLowerCase().includes("dalle pleine")
    )
      return normalizeFloorConfig({
        ...fallback,
        type: "Dalle pleine",
        thickness: "20 cm",
        characteristicPermanentLoad: "8.00",
        characteristicImposedLoad: usageProfile(projectUsage).load.toFixed(2),
      });
    if (section.toLowerCase().includes("16+4"))
      return normalizeFloorConfig({
        ...fallback,
        type: "Corps creux",
        thickness: "16+4 cm",
        hollowBlockHeight: "16",
        compressionSlab: "4",
        characteristicPermanentLoad: "5.84",
        characteristicImposedLoad: usageProfile(projectUsage).load.toFixed(2),
      });
    return fallback;
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let snapshots: BuildingProjectSnapshot<Project>[] = [];
      try { snapshots = await loadBuildingProjects<Project>(); } catch { /* La migration legacy reste disponible. */ }
      if (cancelled) return;
      if (snapshots.length) {
        const restored = snapshots.map(snapshot => ({
          ...snapshot.project,
          levels: renumberBuildingElements(snapshot.project.levels),
        }));
        projectRevisions.current = Object.fromEntries(snapshots.map(snapshot => [snapshot.projectId, snapshot.revision]));
        workspaceByProject.current = Object.fromEntries(snapshots.filter(snapshot => snapshot.workspace && typeof snapshot.workspace === "object").map(snapshot => [snapshot.projectId, snapshot.workspace as BuildingWorkspaceSnapshot]));
        projectContents.current = Object.fromEntries(restored.map(project => [project.id, JSON.stringify({ project, workspace: workspaceByProject.current[project.id] })]));
        autosaveBlocked.current.clear();
        setProjects(restored);
        const latest = [...snapshots].sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0];
        if (latest) setSelectedProject(restored.find(project => project.id === latest.projectId) ?? restored[0]);
        setPersistenceStatus("Projet récupéré depuis le stockage local durable");
      } else {
        let legacy: ReturnType<typeof restoreBuildingDraft> = null;
        try { legacy = restoreBuildingDraft(sessionStorage.getItem("gcbtp-building")); } catch { /* Stockage indisponible. */ }
        if (legacy) {
          const migrated: Project = {
            id: crypto.randomUUID(),
            name: legacy.name,
            updatedAt: "Projet restauré",
            levels: initialLevels(),
            city: "",
            location: "",
            structure: "Béton armé",
            norm: legacy.norm,
            country: legacy.country,
          };
          setProjects([migrated]);
          setPersistenceStatus("Ancien brouillon récupéré · migration en cours");
        } else {
          setPersistenceStatus("Autosauvegarde locale activée");
        }
      }
      setProjectsHydrated(true);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!projectsHydrated) return;
    const snapshots = projects.map(project => ({
      project,
      workspace: project.id === selected?.id ? createWorkspaceSnapshot(project.id) : workspaceByProject.current[project.id],
    }));
    const changed = snapshots.filter(snapshot => JSON.stringify(snapshot) !== projectContents.current[snapshot.project.id]);
    if (!changed.length) return;
    setPersistenceStatus("Enregistrement automatique…");
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          for (const { project, workspace } of changed) {
            if (autosaveBlocked.current.has(project.id)) continue;
            if (autosaveInFlight.current.has(project.id)) {
              autosavePending.current.add(project.id);
              continue;
            }
            autosaveInFlight.current.add(project.id);
            const expectedRevision = projectRevisions.current[project.id] ?? 0;
            try {
              const outcome = await saveBuildingProject(project, expectedRevision, new Date(), workspace);
              if (outcome.status === "conflict") {
                autosaveBlocked.current.add(project.id);
                setConflictProjectId(project.id);
                setPersistenceStatus("Conflit détecté · une autre version est plus récente");
                return;
              }
              projectRevisions.current[project.id] = outcome.snapshot.revision;
              projectContents.current[project.id] = JSON.stringify({ project, workspace });
              if (workspace) workspaceByProject.current[project.id] = workspace;
            } finally {
              autosaveInFlight.current.delete(project.id);
              if (autosavePending.current.delete(project.id)) setAutosaveRetry(value => value + 1);
            }
          }
          setPersistenceStatus(`Sauvegardé sur cet appareil · ${new Date().toLocaleTimeString()}`);
        } catch {
          setPersistenceStatus("Échec de sauvegarde · exportez une copie de sécurité");
        }
      })();
    }, 650);
    return () => window.clearTimeout(timer);
  }, [projects, projectsHydrated, selected, xAxes, yAxes, zLevels, gridDistance, loads, xNumbering, yNumbering, xDistances, yDistances, analyticalTolerance, customModels, floorConfig, loadProgram, climateDraft, threeD, showLabels, gridOpacity, snapToGrid, autosaveRetry]);
  useEffect(() => {
    setModelSection(optionsForType(modelType)[0] ?? "");
  }, [modelType, customModels]);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("gcbtp-custom-models");
      if (raw) setCustomModels(JSON.parse(raw) as ModelSpec[]);
    } catch {
      sessionStorage.removeItem("gcbtp-custom-models");
    }
  }, []);
  useEffect(() => {
    sessionStorage.setItem("gcbtp-custom-models", JSON.stringify(customModels));
  }, [customModels]);
  useEffect(() => {
    const view = sessionStorage.getItem("gcbtp-building-view");
    if (view) setThreeD(view === "3d");
    const visual = sessionStorage.getItem("gcbtp-building-visual");
    if (visual) {
      try {
        const data = JSON.parse(visual);
        setShowLabels(data.showLabels ?? true);
        setGridOpacity(data.gridOpacity ?? "100");
        setSnapToGrid(data.snapToGrid ?? true);
      } catch {
        sessionStorage.removeItem("gcbtp-building-visual");
      }
    }
  }, [setThreeD]);
  useEffect(() => {
    sessionStorage.setItem("gcbtp-building-view", threeD ? "3d" : "2d");
  }, [threeD]);
  useEffect(() => {
    sessionStorage.setItem(
      "gcbtp-building-visual",
      JSON.stringify({ showLabels, gridOpacity, snapToGrid })
    );
  }, [showLabels, gridOpacity, snapToGrid]);
  useEffect(() => {
    const raw = sessionStorage.getItem("gcbtp-building-config");
    if (raw) {
      try {
        const config = JSON.parse(raw);
        setXAxes(config.xAxes ?? xAxes);
        setYAxes(config.yAxes ?? yAxes);
        setZLevels(config.zLevels ?? zLevels);
        setGridDistance(config.gridDistance ?? "4.00");
        setLoads(config.loads ?? loads);
        setAnalyticalTolerance(config.analyticalTolerance ?? String(DEFAULT_NODE_MERGE_TOLERANCE_M));
        setXNumbering(config.xNumbering ?? "numeric");
        setYNumbering(config.yNumbering ?? "alpha");
        setXDistances(config.xDistances ?? ["4.00", "4.00", "4.00"]);
        setYDistances(config.yDistances ?? ["4.00", "4.00", "4.00"]);
      } catch {
        sessionStorage.removeItem("gcbtp-building-config");
      }
    }
  }, []);
  useEffect(() => {
    const raw = sessionStorage.getItem("gcbtp-building-config");
    if (raw) {
      try {
        const config = JSON.parse(raw);
        setXAxes(config.xAxes ?? xAxes);
        setYAxes(config.yAxes ?? yAxes);
        setZLevels(config.zLevels ?? zLevels);
        setGridDistance(config.gridDistance ?? "4.00");
        setLoads(config.loads ?? loads);
        setAnalyticalTolerance(config.analyticalTolerance ?? String(DEFAULT_NODE_MERGE_TOLERANCE_M));
        setFloorConfig(normalizeFloorConfig(config.floorConfig));
      } catch {
        sessionStorage.removeItem("gcbtp-building-config");
      }
    }
  }, []);
  useEffect(() => {
    sessionStorage.setItem(
      "gcbtp-building-config",
      JSON.stringify({
        xAxes,
        yAxes,
        zLevels,
        gridDistance,
        loads,
        xNumbering,
        yNumbering,
        xDistances,
        yDistances,
        analyticalTolerance,
      })
    );
  }, [xAxes, yAxes, zLevels, gridDistance, loads, analyticalTolerance]);
  useEffect(() => {
    if (!floorStorageKey) return;
    try {
      const map = JSON.parse(
        sessionStorage.getItem("gcbtp-floor-configs") ?? "{}"
      );
      setFloorConfig(normalizeFloorConfig(map[floorStorageKey]));
    } catch {
      setFloorConfig(defaultFloorConfig);
    }
  }, [floorStorageKey]);
  useEffect(() => {
    if (!floorStorageKey) return;
    try {
      const map = JSON.parse(
        sessionStorage.getItem("gcbtp-floor-configs") ?? "{}"
      );
      map[floorStorageKey] = floorConfig;
      sessionStorage.setItem("gcbtp-floor-configs", JSON.stringify(map));
    } catch {
      /* sessionStorage indisponible */
    }
  }, [floorStorageKey, floorConfig]);

  useEffect(() => {
    setBuildingCalculation(null);
    setAnalyticalModel(null);
    setAnalyticalPrecheck(null);
    setBuildingLoadModel(null);
    setPlaneAnalysis(null);
    setSurfaceAnalysis(null);
    setClimateAnalysis(null);
    setRcDesignResult(null);
    setShowCalculationPreflight(false);
    setMeshPrerequisiteReady(false);
    setLoadCasesPrerequisiteReady(false);
  }, [selected?.levels, selected?.structure, xDistances, yDistances, floorConfig, analyticalTolerance, customModels]);

  useEffect(() => {
    setPlaneAnalysis(null);
    setSurfaceAnalysis(null);
    setRcDesignResult(null);
    setLoadCasesPrerequisiteReady(false);
  }, [loadProgram, surfaceMeshSizeM]);

  useEffect(() => {
    if (!selected) return;
    const key = `gcbtp-load-program:${selected.id}`;
    try {
      const raw = sessionStorage.getItem(key);
      const restored = raw ? JSON.parse(raw) as LoadProgram : null;
      setLoadProgram(restored?.schemaVersion === 1 ? restored : createDefaultLoadProgram(selected.norm || norm, selected.projectUsage ?? "habitation"));
    } catch {
      setLoadProgram(createDefaultLoadProgram(selected.norm || norm, selected.projectUsage ?? "habitation"));
    }
  }, [selected?.id]);

  useEffect(() => {
    if (!selected) return;
    const storyCount = Math.max(1, selected.levels.filter(level => level.id !== "foundation").length);
    try {
      const raw = sessionStorage.getItem(`gcbtp-climate:${selected.id}`);
      setClimateDraft(normalizeClimateDraft(raw ? JSON.parse(raw) : null, storyCount));
    } catch {
      setClimateDraft(createClimateDraft(storyCount));
    }
    setClimateAnalysis(null);
    setClimateLoadedProjectId(selected.id);
  }, [selected?.id]);
  useEffect(() => {
    if (!selected || climateLoadedProjectId !== selected.id) return;
    try { sessionStorage.setItem(`gcbtp-climate:${selected.id}`, JSON.stringify(climateDraft)); } catch { /* Le profil climatique reste disponible en mémoire. */ }
  }, [selected?.id, climateLoadedProjectId, climateDraft]);
  useEffect(() => {
    setClimateAnalysis(null);
  }, [climateDraft]);
  useEffect(() => {
    if (!selected) return;
    try {
      sessionStorage.setItem(`gcbtp-load-program:${selected.id}`, JSON.stringify(loadProgram));
    } catch {
      /* Le programme de charges reste utilisable même si le stockage local est indisponible. */
    }
  }, [selected?.id, loadProgram]);

  const activeLevel = useMemo(
    () =>
      selected?.levels.find(level => level.id === activeLevelId) ??
      selected?.levels[0],
    [selected, activeLevelId]
  );
  const setSelectedProject = (next: Project) => {
    const normalized = {
      ...next,
      levels: renumberBuildingElements(next.levels),
    };
    const workspace = workspaceByProject.current[normalized.id];
    if (workspace) {
      const config = workspace.buildingConfig ?? {};
      if (Array.isArray(config.xAxes)) setXAxes(config.xAxes as string[]);
      if (Array.isArray(config.yAxes)) setYAxes(config.yAxes as string[]);
      if (Array.isArray(config.zLevels)) setZLevels(config.zLevels as string[]);
      if (typeof config.gridDistance === "string") setGridDistance(config.gridDistance);
      if (config.loads && typeof config.loads === "object") setLoads(config.loads as typeof loads);
      if (typeof config.xNumbering === "string") setXNumbering(config.xNumbering);
      if (typeof config.yNumbering === "string") setYNumbering(config.yNumbering);
      if (Array.isArray(config.xDistances)) setXDistances(config.xDistances as string[]);
      if (Array.isArray(config.yDistances)) setYDistances(config.yDistances as string[]);
      if (typeof config.analyticalTolerance === "string") setAnalyticalTolerance(config.analyticalTolerance);
      if (typeof config.activeLevelId === "string" && normalized.levels.some(level => level.id === config.activeLevelId)) setActiveLevelId(config.activeLevelId);
      setCustomModels(Array.isArray(workspace.customModels) ? workspace.customModels : []);
      const restoredLoadProgram = workspace.loadProgram?.schemaVersion === 1 ? normalizeLoadProgram(workspace.loadProgram) : createDefaultLoadProgram(normalized.norm, normalized.projectUsage ?? "habitation");
      setLoadProgram(restoredLoadProgram);
      const storyCount = Math.max(1, normalized.levels.filter(level => level.id !== "foundation").length);
      setClimateDraft(normalizeClimateDraft(workspace.climateDraft, storyCount));
      setClimateLoadedProjectId(normalized.id);
      if (workspace.visual) {
        setThreeD(workspace.visual.threeD ?? false);
        setShowLabels(workspace.visual.showLabels ?? true);
        setGridOpacity(workspace.visual.gridOpacity ?? "100");
        setSnapToGrid(workspace.visual.snapToGrid ?? true);
      }
      const floorConfigs = workspace.floorConfigs ?? {};
      try {
        const allFloorConfigs = JSON.parse(sessionStorage.getItem("gcbtp-floor-configs") ?? "{}");
        sessionStorage.setItem("gcbtp-floor-configs", JSON.stringify({ ...allFloorConfigs, ...floorConfigs }));
        sessionStorage.setItem(`gcbtp-load-program:${normalized.id}`, JSON.stringify(restoredLoadProgram));
        sessionStorage.setItem(`gcbtp-climate:${normalized.id}`, JSON.stringify(workspace.climateDraft));
        sessionStorage.setItem("gcbtp-building-config", JSON.stringify(config));
      } catch { /* In-memory values are restored even when browser storage is blocked. */ }
      const targetLevelId = normalized.levels.find(level => level.id === "rdc")?.id ?? normalized.levels[0]?.id ?? "rdc";
      setFloorConfig(normalizeFloorConfig(floorConfigs[`${normalized.id}:${targetLevelId}`]));
    }
    setSelected(normalized);
    setProjectUsage(normalized.projectUsage ?? "habitation");
    setNorm(normalized.norm);
    setCountry(normalized.country);
    setProjects(previous =>
      previous.map(project =>
        project.id === normalized.id ? normalized : project
      )
    );
    setActiveLevelId(
      normalized.levels.find(level => level.id === "rdc")?.id ??
        normalized.levels[0]?.id ??
        "rdc"
    );
  };
  const createProject = () => {
    if (!validateBuildingName(projectName))
      return toast.error("Saisissez le nom du projet");
    const selectedUsage = usageProfile(projectUsage);
    const project: Project = {
      id: crypto.randomUUID(),
      name: projectName.trim(),
      updatedAt: "À l’instant",
      levels: initialLevels(),
      city: "",
      location: "",
      structure: "Béton armé",
      norm,
      country,
      projectUsage,
    };
    setProjects(prev => [project, ...prev]);
    setSelected(project);
    setFloorConfig(normalizeFloorConfig({ ...floorConfig, characteristicImposedLoad: selectedUsage.load.toFixed(2) }));
    setProjectName("");
    setDialogOpen(false);
    toast.success("Projet créé");
  };
  const saveProject = () => {
    if (!selected) return;
    const saved = { ...selected, updatedAt: "À l’instant" };
    setSelected(saved);
    setProjects(prev => prev.map(project => project.id === saved.id ? saved : project));
    setPersistenceStatus("Sauvegarde automatique demandée…");
    toast.success("Projet en cours de sauvegarde sur cet appareil");
  };
  const exportCompleteProject = () => {
    if (!selected) return;
    const bundle = createBuildingProjectBundle(selected, createWorkspaceSnapshot(selected.id));
    const blob = new Blob([serializeBuildingProjectBundle(bundle)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selected.name.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase()}-gcbtp-v${bundle.schemaVersion}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Export complet du projet téléchargé");
  };
  const importCompleteProject = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    try {
      const bundle = parseBuildingProjectBundle<Project, BuildingWorkspaceSnapshot>(await file.text());
      const imported: Project = {
        ...bundle.project,
        id: crypto.randomUUID(),
        name: `${bundle.project.name} — importé`,
        updatedAt: "Importé à l’instant",
        levels: renumberBuildingElements(bundle.project.levels),
      };
      workspaceByProject.current[imported.id] = bundle.workspace;
      projectRevisions.current[imported.id] = 0;
      delete projectContents.current[imported.id];
      autosaveBlocked.current.delete(imported.id);
      setProjects(previous => [imported, ...previous]);
      setSelectedProject(imported);
      setPanel(null);
      toast.success("Projet importé comme copie indépendante");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d’importer ce projet.");
    }
  };
  const openProjectHistory = async () => {
    if (!selected) return;
    setPanel("Historique des versions");
    try {
      setProjectHistory(await loadBuildingProjectHistory<Project>(selected.id));
    } catch {
      setProjectHistory([]);
      toast.error("Historique indisponible sur ce navigateur.");
    }
  };
  const restoreProjectVersion = async (snapshot: BuildingProjectSnapshot<Project>) => {
    if (!selected) return;
    const projectId = selected.id;
    if (autosaveInFlight.current.has(projectId)) {
      autosavePending.current.add(projectId);
      toast.error("Une sauvegarde est en cours. Réessayez dans un instant.");
      return;
    }
    autosaveInFlight.current.add(projectId);
    const workspace = snapshot.workspace as BuildingWorkspaceSnapshot | undefined;
    try {
      const result = await saveBuildingProject(snapshot.project, projectRevisions.current[projectId] ?? 0, new Date(), workspace);
      if (result.status === "conflict") {
        autosaveBlocked.current.add(projectId);
        setConflictProjectId(projectId);
        setPersistenceStatus("Conflit détecté · rechargez la dernière version");
        return;
      }
      projectRevisions.current[projectId] = result.snapshot.revision;
      autosaveBlocked.current.delete(projectId);
      if (workspace) workspaceByProject.current[projectId] = workspace;
      projectContents.current[projectId] = JSON.stringify({ project: snapshot.project, workspace });
      setProjects(previous => previous.map(project => project.id === projectId ? snapshot.project : project));
      setSelectedProject(snapshot.project);
      setProjectHistory(await loadBuildingProjectHistory<Project>(projectId));
      setPersistenceStatus(`Version ${snapshot.revision} restaurée comme nouvelle version`);
      toast.success("Version restaurée sans supprimer l’historique");
    } catch (error) {
      console.error("Building project version restore failed", error);
      toast.error(error instanceof Error ? `Restauration impossible : ${error.message}` : "La restauration de cette version a échoué.");
    } finally {
      autosaveInFlight.current.delete(projectId);
      if (autosavePending.current.delete(projectId)) setAutosaveRetry(value => value + 1);
    }
  };
  const reloadLatestProjectVersion = async () => {
    if (!conflictProjectId) return;
    try {
      const snapshots = await loadBuildingProjects<Project>();
      const latest = snapshots.find(snapshot => snapshot.projectId === conflictProjectId);
      if (!latest) throw new Error("Aucune version enregistrée n’a été trouvée.");
      projectRevisions.current[latest.projectId] = latest.revision;
      const workspace = latest.workspace as BuildingWorkspaceSnapshot | undefined;
      if (workspace) workspaceByProject.current[latest.projectId] = workspace;
      projectContents.current[latest.projectId] = JSON.stringify({ project: latest.project, workspace });
      autosaveBlocked.current.delete(latest.projectId);
      setProjects(previous => previous.map(project => project.id === latest.projectId ? latest.project : project));
      if (selected?.id === latest.projectId) setSelectedProject(latest.project);
      setConflictProjectId(null);
      setPersistenceStatus("Dernière version rechargée · autosauvegarde réactivée");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de recharger la version enregistrée.");
    }
  };
  const buildCurrentAnalytical = () => {
    if (!selected) return null;
    return buildAnalyticalModel({
      levels: selected.levels,
      xDistancesM: xDistances.map(value => numericGridDistance(value, numericGridDistance(gridDistance))),
      yDistancesM: yDistances.map(value => numericGridDistance(value, numericGridDistance(gridDistance))),
      nodeMergeToleranceM: numericGridDistance(analyticalTolerance, DEFAULT_NODE_MERGE_TOLERANCE_M),
      structure: selected.structure,
      modelCatalog: [...MODEL_CATALOG, ...customModels],
    });
  };
  const downloadAnalyticalJson = () => {
    if (!analyticalModel) return;
    const exportPayload = {
      ...analyticalModel,
      exportedAt: new Date().toISOString(),
      project: selected ? { id: selected.id, name: selected.name, structure: selected.structure, norm: selected.norm, country: selected.country } : undefined,
      buildingCalculation,
      loadProgram,
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(selected?.name ?? "gcbtp-modele").replace(/[^a-z0-9-_]+/gi,"-").toLowerCase()}-analytique-v${analyticalModel.schemaVersion}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const executeBuildingCalculation = () => {
    if (!meshPrerequisiteReady || !loadCasesPrerequisiteReady) {
      toast.error("Le maillage des dalles et la validation des cas de chargement sont obligatoires avant le calcul.");
      setShowCalculationPreflight(true);
      return;
    }
    if (!selected) return;
    setLastStructuralReport("");
    try { sessionStorage.removeItem("gcbtp-last-structural-report"); } catch { /* L’invalidation reste effective en mémoire. */ }
    const analytical = buildCurrentAnalytical();
    if (!analytical) return;
    setAnalyticalModel(analytical.model);
    setAnalyticalPrecheck(analytical.precheck);
    if (!analytical.precheck.ok) {
      setBuildingCalculation(null);
      setBuildingLoadModel(null);
      setPlaneAnalysis(null);
      setPanel("Calculer la descente");
      toast.error(`Calcul bloqué : ${analytical.precheck.errors.length} erreur(s) de connectivité ou de géométrie`);
      return;
    }
    const loadElements = selected.levels.flatMap(level =>
      level.elements.map(element => ({ ...element, levelId: level.id }))
    );
    const model = buildBuildingLoadModel(loadElements, {
      levelOrder: selected.levels.map(level => level.id),
      levelHeights: Object.fromEntries(
        selected.levels.map(level => [
          level.id,
          Number(level.height ?? (level.id === "foundation" ? 1 : 3.2)),
        ])
      ),
      gridDistance: Number(gridDistance.replace(",", ".")) || 4,
    });
    const summary = summarizeBuildingLoads(model);
    setBuildingLoadModel(model);
    setBuildingCalculation(summary);
    const automaticCombination = loadProgram.combinations.find(item => item.id === "comb:uls-gravity" && item.enabled) ?? loadProgram.combinations.find(item => item.enabled);
    if (automaticCombination) {
      const gravity = buildGravityMemberLoads(analytical.model, model, automaticCombination, loadProgram);
      const projected = gravity.errors.length ? { result: null, errors: gravity.errors, warnings: gravity.warnings } : solveAnalyticalPlane(analytical.model, "XZ", [], gravity.memberLoads);
      setPlaneAnalysis({ result: projected.result, errors: projected.errors, warnings: [...gravity.warnings, ...projected.warnings], combinationId: automaticCombination.id, combinationName: automaticCombination.name, memberLoads: gravity.memberLoads });
      const storyLateralLoads: Spatial3DStoryLateralLoad[] | undefined = climateAnalysis && !climateAnalysis.seismic.errors.length
        ? climateAnalysis.seismic.stories.map(story => ({ storyIndex: story.storyIndex, fxKn: story.lateralForceKn, fyKn: 0 }))
        : undefined;
      const professional = runProfessionalAnalysis({ model: analytical.model, loads: model, combination: automaticCombination, program: loadProgram, options: { storyLateralLoads } });
      const spatial = { result: professional.spatial, errors: professional.errors, warnings: professional.warnings };
      if (spatial.result) {
        setSpatial3DResult(spatial.result);
        setAutomaticFoundationResult({
          plane: "XZ",
          displacements: spatial.result.nodeDisplacements.map(item => ({ nodeId: item.nodeId, uxM: item.uxM, uzM: item.uzM, rotationRad: item.rzRad })),
          elements: [],
          reactions: spatial.result.reactions.map(item => ({ nodeId: item.nodeId, fxKn: Math.hypot(item.fxKn, item.fyKn), fzKn: item.fzKn, momentKnM: Math.hypot(item.mxKnM, item.myKnM, item.mzKnM) })),
          equilibrium: { appliedFxKn: spatial.result.equilibrium.appliedFxKn, appliedFzKn: spatial.result.equilibrium.appliedFzKn, appliedMomentKnM: 0, reactionFxKn: spatial.result.equilibrium.reactionFxKn, reactionFzKn: spatial.result.equilibrium.reactionFzKn, reactionMomentKnM: 0 },
          warnings: spatial.result.warnings,
        });
      } else {
        setSpatial3DResult(null);
        setAutomaticFoundationResult(null);
        toast.error(`Solveur global 3D impossible : ${spatial.errors[0] ?? "erreur numérique"}`);
      }
    } else {
      setPlaneAnalysis(null);
      setSpatial3DResult(null);
      setAutomaticFoundationResult(null);
    }
    setSelectedAnalysisRow(null);
    setPanel("Calculer la descente");
    const message = `Calcul terminé : ${summary.floorCount} dalle(s), ${summary.foundationCount} fondation(s) chargée(s)`;
    if (summary.floorCount === 0) toast.info(`${message}. Ajoutez les planchers porteurs pour inclure les charges d’exploitation et permanentes des niveaux.`);
    else toast.success(message);
    setShowCalculationPreflight(false);
  };
  const openCalculationPreflight = () => {
    if (!selected) return;
    setLastStructuralReport("");
    const analytical = buildCurrentAnalytical();
    if (!analytical) return;
    setAnalyticalModel(analytical.model);
    setAnalyticalPrecheck(analytical.precheck);
    const loadElements = selected.levels.flatMap(level => level.elements.map(element => ({ ...element, levelId: level.id })));
    const model = buildBuildingLoadModel(loadElements, {
      levelOrder: selected.levels.map(level => level.id),
      levelHeights: Object.fromEntries(selected.levels.map(level => [level.id, Number(level.height ?? (level.id === "foundation" ? 1 : 3.2))])),
      gridDistance: Number(gridDistance.replace(",", ".")) || 4,
    });
    setBuildingLoadModel(model);
    setBuildingCalculation(summarizeBuildingLoads(model));
    setMeshPrerequisiteReady(false);
    setLoadCasesPrerequisiteReady(false);
    setShowCalculationPreflight(true);
    setPanel("Calculer la descente");
  };
  useEffect(() => {
    if (!optimizationRecalcRequested || !selected) return;
    setOptimizationRecalcRequested(false);
    executeBuildingCalculation();
  }, [optimizationRecalcRequested, selected]);
  const runPlanarAnalysis = () => {
    if (!analyticalModel || !buildingLoadModel || !buildingCalculation) return;
    setRcDesignResult(null);
    const combination = loadProgram.combinations.find(item=>item.id===solverCombinationId);
    if (!combination) {
      setPlaneAnalysis({result:null,errors:["Combinaison sélectionnée absente du programme de charges."],warnings:[],memberLoads:[]});
      return;
    }
    const memberLoads=buildGravityMemberLoads(analyticalModel,buildingLoadModel,combination,loadProgram);
    if (memberLoads.errors.length) {
      setPlaneAnalysis({result:null,errors:memberLoads.errors,warnings:memberLoads.warnings,combinationId:combination.id,combinationName:combination.name,memberLoads:[]});
      toast.error("Solveur 2D bloqué : action non répartie ou cas incompatible");
      return;
    }
    const solved=solveAnalyticalPlane(analyticalModel,analysisPlane,[],memberLoads.memberLoads);
    const warnings=[...memberLoads.warnings,...solved.warnings];
    let comparison: { expectedReactionKn:number; solverReactionKn:number; differencePercent:number } | undefined;
    if (solved.result) {
      const expectedReactionKn=memberLoads.permanentFactor*buildingCalculation.totalGk+memberLoads.variableFactor*buildingCalculation.totalQk;
      const solverReactionKn=solved.result.equilibrium.reactionFzKn;
      const differencePercent=expectedReactionKn>1e-9?Math.abs(solverReactionKn-expectedReactionKn)/expectedReactionKn*100:0;
      comparison={expectedReactionKn,solverReactionKn,differencePercent};
      if (differencePercent>1) warnings.push(`Écart de ${differencePercent.toFixed(2)} % entre la réaction du solveur 2D et la somme tributaires/fondations ; vérifier hauteurs, appuis et charges non représentées.`);
    }
    setPlaneAnalysis({result:solved.result,errors:solved.errors,warnings,comparison,combinationId:combination.id,combinationName:combination.name,memberLoads:memberLoads.memberLoads});
    if (solved.result) toast.success(`Analyse statique 2D ${analysisPlane} terminée`);
    else toast.error(`Analyse statique 2D impossible : ${solved.errors[0] ?? "erreur numérique"}`);
  };
  const runSurfaceAnalysis = () => {
    if (!selected) return false;
    setRcDesignResult(null);
    const combination = loadProgram.combinations.find(item => item.id === solverCombinationId);
    if (!combination) {
      setSurfaceAnalysis({ rows: [], errors: ["Combinaison sélectionnée absente du programme de charges."], warnings: [] });
      return false;
    }
    const patternCoefficient = (caseId: string, patternId: string) => {
      const actionCase = loadProgram.cases.find(item => item.id === caseId);
      const pattern = loadProgram.patterns.find(item => item.id === patternId);
      if (!actionCase?.enabled || !pattern?.enabled) return 0;
      return (combination.caseFactors[caseId] ?? 0) * (actionCase.patternFactors[patternId] ?? 0);
    };
    const gammaG = patternCoefficient("case:G", "G");
    const gammaQ = patternCoefficient("case:Q", "Q");
    const xPositions = cumulativeGridPositions(xDistances.map(value => numericGridDistance(value, numericGridDistance(gridDistance))), xAxes.length);
    const yPositions = cumulativeGridPositions(yDistances.map(value => numericGridDistance(value, numericGridDistance(gridDistance))), yAxes.length);
    const slabs = selected.levels.flatMap(level => level.elements.filter(item => item.type === "Dalle" && item.x2 !== undefined && item.y2 !== undefined).map(element => ({ level, element })));
    if (!slabs.length) {
      setSurfaceAnalysis({ rows: [], errors: ["Aucune dalle rectangulaire ne peut être maillée dans ce projet."], warnings: [] });
      toast.error("Aucune surface de dalle à analyser");
      return false;
    }
    const rows: SurfaceRunRow[] = slabs.map(({ level, element }) => {
      const config = normalizeFloorConfig(element.floorConfig ?? defaultFloorConfig);
      const x1M = indexToMetric(element.x, xPositions), y1M = indexToMetric(element.y, yPositions);
      const x2M = indexToMetric(element.x2 as number, xPositions), y2M = indexToMetric(element.y2 as number, yPositions);
      const thicknessParts = (config.thickness.match(/\d+(?:[.,]\d+)?/g) ?? []).map(value => Number(value.replace(",", ".")) / 100);
      const thicknessM = thicknessParts.reduce((sum, value) => sum + value, 0);
      const rate = (value: string | undefined) => {
        const parsed = Number(String(value ?? "").replace(",", "."));
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
      };
      const gk = rate(config.characteristicPermanentLoad);
      const qk = rate(config.characteristicImposedLoad);
      const uniformLoadKnM2 = gammaG * gk + gammaQ * qk;
      const input = {
        id: element.id,
        x1M,
        y1M,
        x2M,
        y2M,
        thicknessM: thicknessM || 0.2,
        elasticModulusKnM2: 30_000_000,
        poissonRatio: 0.2,
        uniformLoadKnM2,
        meshSizeM: Number(surfaceMeshSizeM.replace(",", ".")) || 0.75,
        openings: element.openings ?? [],
      };
      const mesh = meshRectangularSurface(input);
      const supportCheck = checkRectangularSurfaceEdgeSupports({ x1: element.x, y1: element.y, x2: element.x2 as number, y2: element.y2 as number }, level.elements);
      const supportErrors = supportCheck.missingEdges.map(edge => `Bord ${edge} sans poutre/voile continue sur ${element.id}.`);
      let analysis: SurfaceAnalysis;
      if (config.type !== "Dalle pleine") {
        analysis = { mesh: mesh.mesh, plate: null, errors: mesh.errors, warnings: [...mesh.warnings, "Le solveur de plaque ne dimensionne que les dalles pleines ; ce plancher à corps creux est correctement conservé pour la répartition tributaire des charges."] };
      } else if (supportErrors.length) {
        analysis = { mesh: mesh.mesh, plate: null, errors: [...mesh.errors, ...supportErrors], warnings: mesh.warnings };
      } else {
        analysis = analyzeSimplySupportedRectangularPlate(input);
      }
      const areaM2 = analysis.mesh?.netAreaM2 ?? Math.abs(x2M - x1M) * Math.abs(y2M - y1M);
      const column = level.elements.find(candidate => candidate.type === "Poteau" && [element.x, element.x2].includes(candidate.x) && [element.y, element.y2].includes(candidate.y));
      const dimensions = (column?.section ?? "300x300").match(/\d+(?:[.,]\d+)?/g)?.map(value => Number(value.replace(",", "."))) ?? [300, 300];
      return { elementId: element.id, levelLabel: level.label, areaM2, openingCount: (element.openings ?? []).length, spanXM: Math.abs(x2M - x1M), spanYM: Math.abs(y2M - y1M), thicknessMm: input.thicknessM * 1000, uniformLoadKnM2, supportReactionKn: uniformLoadKnM2 * areaM2 / 4, columnWidthMm: dimensions[0] ?? 300, columnDepthMm: dimensions[1] ?? dimensions[0] ?? 300, negativeMxKnMPerM: 0, negativeMyKnMPerM: 0, floorType: config.type, analysis, supportErrors };
    });
    const errors = rows.flatMap(row => row.analysis.errors.map(message => `${row.elementId} · ${message}`));
    const warnings = rows.flatMap(row => row.analysis.warnings.map(message => `${row.elementId} · ${message}`));
    setSurfaceAnalysis({ rows, errors, warnings, combinationId: combination.id, combinationName: combination.name });
    if (rows.some(row => row.analysis.plate)) toast.success(`Maillage et analyse de ${rows.filter(row => row.analysis.plate).length} dalle(s) terminés`);
    else if (!errors.length && rows.length) toast.success(`Zones de charges de ${rows.length} plancher(s) calculées ; le dimensionnement de plaque reste réservé aux dalles pleines.`);
    else toast.error(`Aucune dalle calculée : ${errors[0] ?? "géométrie ou appuis incompatibles"}`);
    return errors.length === 0 && rows.length > 0;
  };
  const downloadSurfaceAnalysis = () => {
    if (!surfaceAnalysis) return;
    const blob = new Blob([JSON.stringify({ schemaVersion: 1, units: { length: "m", force: "kN", momentPerLength: "kN·m/m" }, combinationId: solverCombinationId, results: surfaceAnalysis }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(selected?.name ?? "gcbtp-surfaces").replace(/[^a-z0-9-_]+/gi, "-").toLowerCase()}-surfaces-v1.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const runClimateAnalysis = () => {
    if (!selected || !buildingCalculation) return;
    const storyLevels = selected.levels.filter(level => level.id !== "foundation");
    const draft = normalizeClimateDraft(climateDraft, Math.max(1, storyLevels.length));
    const parse = climateNumber;
    const spectrum = parseClimateSpectrum(draft.seismic.spectrumText);
    const xPositions = cumulativeGridPositions(xDistances.map(value => numericGridDistance(value, numericGridDistance(gridDistance))), xAxes.length);
    const yPositions = cumulativeGridPositions(yDistances.map(value => numericGridDistance(value, numericGridDistance(gridDistance))), yAxes.length);
    const projectedWidthXM = (xPositions[xPositions.length - 1] ?? 0) - (xPositions[0] ?? 0);
    const projectedWidthYM = (yPositions[yPositions.length - 1] ?? 0) - (yPositions[0] ?? 0);
    const topLevel = storyLevels[storyLevels.length - 1];
    const roofAreaM2 = topLevel?.elements.filter(element => element.type === "Dalle" && element.x2 !== undefined && element.y2 !== undefined).reduce((sum, element) => {
      const spanX = Math.abs(indexToMetric(element.x2 as number, xPositions) - indexToMetric(element.x, xPositions));
      const spanY = Math.abs(indexToMetric(element.y2 as number, yPositions) - indexToMetric(element.y, yPositions));
      return sum + spanX * spanY;
    }, 0) ?? 0;
    const massGravity = loadProgram.massSource.gravityMPerS2;
    const gFraction = loadProgram.massSource.patternFactors.G ?? 0;
    const qFraction = loadProgram.massSource.patternFactors.Q ?? 0;
    const storyMassDistribution = deriveStoryMassesFromCumulativeLoads(storyLevels.map(level => {
      const load = buildingCalculation.levelLoads[level.id];
      return { id: level.id, totalGk: load?.totalGk ?? 0, totalQk: load?.totalQk ?? 0 };
    }), gFraction, qFraction, massGravity);
    const storyMassTonnes = storyMassDistribution.massesTonnes;
    const statusFor = (raw: string, key: string): ClimateFieldSource => {
      if (!raw.trim()) return { status: "to-confirm", source: `Paramètre ${key} absent — source locale/document officiel requis.` };
      if (key === "airDensityKgM3" && raw === "1.225") return { status: "provisional", source: "Valeur générique de densité d’air ; à confirmer pour le référentiel et les conditions du projet." };
      const status = draft.sourceClaim === "official" && draft.sourceReference.trim() ? "official" : "user-input";
      return { status, source: draft.sourceReference.trim() || "Saisie de l’utilisateur — référence documentaire non renseignée." };
    };
    const sources: Record<string, ClimateFieldSource> = {};
    const allFields: Array<[string, string]> = [
      ["altitudeM", draft.altitudeM], ["wind.basicSpeedMPerS", draft.wind.basicSpeedMPerS], ["wind.exposureFactor", draft.wind.exposureFactor],
      ["wind.orographyFactor", draft.wind.orographyFactor], ["wind.topographyFactor", draft.wind.topographyFactor],
      ["wind.netPressureCoefficientX", draft.wind.netPressureCoefficientX], ["wind.netPressureCoefficientY", draft.wind.netPressureCoefficientY], ["wind.airDensityKgM3", draft.wind.airDensityKgM3],
      ["snow.groundLoadKnM2", draft.snow.groundLoadKnM2], ["snow.shapeCoefficient", draft.snow.shapeCoefficient], ["snow.exposureCoefficient", draft.snow.exposureCoefficient],
      ["snow.thermalCoefficient", draft.snow.thermalCoefficient], ["snow.asymmetryRatio", draft.snow.asymmetryRatio],
      ["seismic.referenceAccelerationG", draft.seismic.referenceAccelerationG], ["seismic.importanceFactor", draft.seismic.importanceFactor],
      ["seismic.behaviourFactor", draft.seismic.behaviourFactor], ["seismic.dampingFactor", draft.seismic.dampingFactor],
      ["wind.terrainCategory", draft.terrainCategory], ["seismic.zone", draft.seismic.zone], ["seismic.soilClass", draft.seismic.soilClass],
      ["seismic.importanceClass", draft.seismic.importanceClass], ["seismic.designLifeYears", draft.seismic.designLifeYears],
      ...draft.seismic.storyStiffnessKnPerM.map((value, index) => [`seismic.storyStiffnessKnPerM.${index + 1}`, value] as [string, string]),
    ];
    for (const [key, value] of allFields) sources[key] = statusFor(value, key);
    for (let index = 0; index < spectrum.points.length; index++) {
      const point = spectrum.points[index];
      sources[`seismic.spectrum.${index + 1}`] = statusFor(String(point.periodS), `spectre T=${point.periodS}s; Sa/g=${point.accelerationG}`);
    }
    if (draft.seismic.zone.trim()) sources["seismic.zone"] = statusFor(draft.seismic.zone, "zone sismique");
    if (draft.seismic.soilClass.trim()) sources["seismic.soilClass"] = statusFor(draft.seismic.soilClass, "classe de sol");
    const actionInput: ClimateActionInput = {
      sources,
      metadata: {
        country: selected.country,
        city: selected.city,
        location: selected.location,
        altitudeM: parse(draft.altitudeM),
        terrainCategory: draft.terrainCategory,
        seismicZone: draft.seismic.zone,
        soilClass: draft.seismic.soilClass,
        importanceClass: draft.seismic.importanceClass,
        designLifeYears: parse(draft.seismic.designLifeYears),
      },
      geometry: {
        storyHeightsM: storyLevels.map(level => parse(level.height ?? "") ?? 0),
        projectedWidthXM,
        projectedWidthYM,
        roofAreaM2,
        storyMassTonnes,
      },
      wind: {
        basicSpeedMPerS: parse(draft.wind.basicSpeedMPerS), exposureFactor: parse(draft.wind.exposureFactor),
        orographyFactor: parse(draft.wind.orographyFactor), topographyFactor: parse(draft.wind.topographyFactor),
        netPressureCoefficientX: parse(draft.wind.netPressureCoefficientX), netPressureCoefficientY: parse(draft.wind.netPressureCoefficientY),
        airDensityKgM3: parse(draft.wind.airDensityKgM3) ?? 1.225,
      },
      snow: {
        groundLoadKnM2: parse(draft.snow.groundLoadKnM2), shapeCoefficient: parse(draft.snow.shapeCoefficient),
        exposureCoefficient: parse(draft.snow.exposureCoefficient), thermalCoefficient: parse(draft.snow.thermalCoefficient),
        asymmetryRatio: parse(draft.snow.asymmetryRatio),
      },
      seismic: {
        referenceAccelerationG: parse(draft.seismic.referenceAccelerationG), importanceFactor: parse(draft.seismic.importanceFactor),
        behaviourFactor: parse(draft.seismic.behaviourFactor), dampingFactor: parse(draft.seismic.dampingFactor),
        spectrum: spectrum.points, storyStiffnessKnPerM: storyLevels.map((_, index) => parse(draft.seismic.storyStiffnessKnPerM[index] ?? "") ?? 0),
      },
    };
    const result = generateClimateActions(actionInput);
    const expectedMassTonnes = loadProgramEvaluation.massTonnes;
    const resolvedStoryMassTonnes = storyMassDistribution.totalTonnes;
    for (const message of storyMassDistribution.errors) {
      result.seismic.errors.push(message);
      result.errors.push(message);
    }
    if (Math.abs(expectedMassTonnes - resolvedStoryMassTonnes) > Math.max(0.05, expectedMassTonnes * 0.01)) {
      const message = `La source de masse totale (${expectedMassTonnes.toFixed(3)} t) ne correspond pas aux actions G/Q réparties par étage (${resolvedStoryMassTonnes.toFixed(3)} t). Affecter chaque action permanente/exploitation à des niveaux avant l’analyse modale.`;
      result.seismic.errors.push(message);
      result.errors.push(message);
    }
    setClimateAnalysis(result);
    const generatedValues: Record<string, number | null> = {
      windX: result.wind.errors.length ? null : result.wind.totalsKn.xPlus,
      windY: result.wind.errors.length ? null : result.wind.totalsKn.yPlus,
      snow: result.snow.errors.length ? null : result.snow.totalKn,
      seismicX: result.seismic.errors.length ? null : result.seismic.baseShearKn,
      seismicY: result.seismic.errors.length ? null : result.seismic.baseShearKn,
    };
    const generatedProgram: LoadProgram = {
      ...loadProgram,
      patterns: loadProgram.patterns.map(pattern => {
        const value = generatedValues[pattern.id];
        if (value === null || value === undefined) return pattern;
        return {
          ...pattern,
          value,
          enabled: true,
          status: "calculated",
          source: `Généré en pré-étude à partir des paramètres de projet${draft.sourceReference.trim() ? ` — ${draft.sourceReference.trim()}` : " — source à confirmer"}`,
        };
      }),
    };
    setLoadProgram(generatedProgram);
    if (result.wind.errors.length === 0 || result.snow.errors.length === 0 || result.seismic.errors.length === 0) toast.success("Actions climatiques générées — statut pré-étude à confirmer par l’ingénieur");
    else toast.error("Génération climatique bloquée : renseigner les données manquantes et leurs sources");
  };
  const axisPositions = (axis: "x" | "y", distancesOverride?: string[], labelsOverride?: string[]) => {
    const distances = distancesOverride ?? (axis === "x" ? xDistances : yDistances);
    const labels = labelsOverride ?? (axis === "x" ? xAxes : yAxes);
    return cumulativeGridPositions(
      distances.map(value => numericGridDistance(value, numericGridDistance(gridDistance))),
      labels.length
    );
  };

  const remapElementsToMetric = (elements: ElementItem[], oldX: number[], oldY: number[], nextX: number[], nextY: number[]) =>
    elements.map(element => {
      const metric = metricOfElement(element, oldX, oldY);
      return {
        ...element,
        x: metricToIndex(metric.xM, nextX),
        y: metricToIndex(metric.yM, nextY),
        x2: metric.x2M === undefined ? element.x2 : metricToIndex(metric.x2M, nextX),
        y2: metric.y2M === undefined ? element.y2 : metricToIndex(metric.y2M, nextY),
        xMid: metric.xMidM === undefined ? element.xMid : metricToIndex(metric.xMidM, nextX),
        yMid: metric.yMidM === undefined ? element.yMid : metricToIndex(metric.yMidM, nextY),
        xM: metric.xM, yM: metric.yM, x2M: metric.x2M, y2M: metric.y2M, xMidM: metric.xMidM, yMidM: metric.yMidM,
      };
    });

  const applyAxisLayout = (axis: "x" | "y", labels: string[], positions: number[]) => {
    if (!selected) return;
    const oldX = axisPositions("x"), oldY = axisPositions("y");
    const nextDistances = positionsToDistances(positions);
    const nextX = axis === "x" ? positions : oldX;
    const nextY = axis === "y" ? positions : oldY;
    const levels = selected.levels.map(level => ({ ...level, elements: remapElementsToMetric(level.elements, oldX, oldY, nextX, nextY) }));
    if (axis === "x") { setXAxes(labels); setXDistances(nextDistances); }
    else { setYAxes(labels); setYDistances(nextDistances); }
    updateSelected({ levels });
  };

  const insertAxis = (axis: "x" | "y", index: number, distanceFromStartM: number) => {
    if (!selected) return;
    const labels = axis === "x" ? xAxes : yAxes;
    const positions = axisPositions(axis);
    if (index < 0 || index >= positions.length - 1) return;
    const span = positions[index + 1] - positions[index];
    const offset = Number(distanceFromStartM);
    if (!Number.isFinite(offset) || offset <= 0 || offset >= span) {
      toast.error(`La distance doit être strictement comprise entre 0 et ${span.toFixed(2)} m.`);
      return;
    }
    const insertedPosition = positions[index] + offset;
    const nextPositions = [...positions.slice(0, index + 1), insertedPosition, ...positions.slice(index + 1)];

    // Un axe ajouté entre 1 et 2 ne prend jamais le nom 3. Il hérite du
    // premier axe de l'intervalle et reçoit un suffixe prime : 1′, 1″, 1‴…
    // Le nom est indépendant de sa position et reste stable si d'autres axes sont supprimés.
    const primeRoot = (labels[index] ?? "A").replace(/[′″‴⁗]+$/u, "");
    const primeMarks = ["′", "″", "‴", "⁗"];
    const used = new Set(labels);
    let ordinal = 1;
    let candidate = `${primeRoot}${primeMarks[0]}`;
    while (used.has(candidate)) {
      ordinal += 1;
      candidate = ordinal <= primeMarks.length
        ? `${primeRoot}${primeMarks[ordinal - 1]}`
        : `${primeRoot}${primeMarks[primeMarks.length - 1]}${ordinal}`;
    }
    const nextLabels = [...labels.slice(0, index + 1), candidate, ...labels.slice(index + 1)];
    applyAxisLayout(axis, nextLabels, nextPositions);
    toast.success(`Axe ${candidate} inséré à ${offset.toFixed(2)} m de l'axe ${labels[index]}, entre ${labels[index]} et ${labels[index + 1]}.`);
  };

  const removeAxis = (axis: "x" | "y", index: number) => {
    if (!selected) return;
    const labels = axis === "x" ? xAxes : yAxes;
    const positions = axisPositions(axis);
    if (labels.length <= 2 || index < 0 || index >= labels.length) return;
    const nextPositions = positions.filter((_, i) => i !== index);
    const nextLabels = labels.filter((_, i) => i !== index);
    applyAxisLayout(axis, nextLabels, nextPositions);
    toast.success(`Axe ${labels[index]} supprimé. Les éléments restent à leurs coordonnées métriques ; aucun déplacement structurel n'est effectué.`);
  };

  const changeAxisDistance = (axis: "x" | "y", index: number, value: string) => {
    if (!selected) return;
    const distances = axis === "x" ? xDistances : yDistances;
    if (index < 0 || index >= distances.length) return;
    const oldPositions = axisPositions(axis);
    const nextDistances = [...distances]; nextDistances[index] = value;
    const nextPositions = cumulativeGridPositions(nextDistances.map(item => numericGridDistance(item, numericGridDistance(gridDistance))), (axis === "x" ? xAxes : yAxes).length);
    applyAxisLayout(axis, axis === "x" ? xAxes : yAxes, nextPositions);
    toast.success("Distance de trame modifiée ; les éléments conservent leurs coordonnées physiques.");
  };

  const remapAxisChange = (axis: "x" | "y", nextLabels: string[]) => {
    // Utilisé par les boutons « Ajouter une ligne » en fin de trame : ajoute une travée à la suite sans toucher aux coordonnées existantes.
    const labels = axis === "x" ? xAxes : yAxes;
    if (nextLabels.length === labels.length + 1 && nextLabels.slice(0, labels.length).every((label, i) => label === labels[i])) {
      const positions = axisPositions(axis);
      const fallback = numericGridDistance((axis === "x" ? xDistances : yDistances).at(-1), numericGridDistance(gridDistance));
      applyAxisLayout(axis, nextLabels, [...positions, (positions.at(-1) ?? 0) + fallback]);
      return;
    }
    if (nextLabels.length === labels.length) {
      if (axis === "x") setXAxes(nextLabels); else setYAxes(nextLabels);
    }
  };
  const updateSelected = (patch: Partial<Project>) => {
    if (!selected) return;
    const next = {
      ...selected,
      ...patch,
      levels: renumberBuildingElements(patch.levels ?? selected.levels),
    };
    setSelected(next);
    setProjects(prev =>
      prev.map(project => (project.id === next.id ? next : project))
    );
  };
  const applyOptimizedSection = (elementId: string, type: string, sectionName: string, dimensions: string) => {
    if (!selected) return;
    const modelType = type === "beam" ? "Poutre" : type === "column" ? "Poteau" : type === "slab" ? "Dalle" : type === "wall" ? "Voile" : type === "tie-beam" ? "Longrine de redressement" : "Semelle";
    const family: ModelSpec["family"] = modelType === "Poteau" ? "Poteau (Rect)" : modelType === "Poutre" ? "Poutre" : modelType === "Dalle" ? "Plancher (Dalle BA)" : modelType === "Voile" ? "Voile" : modelType === "Longrine de redressement" ? "Longrine de redressement" : "Semelle";
    const existing = customModels.find(model => model.type === modelType && model.name === sectionName);
    if (!existing) {
      setCustomModels(current => [...current, { family, type: modelType, name: sectionName, dimensions, color: colorForModel(modelType, selected.levels.flatMap(level => level.elements).find(element => element.id === elementId)?.section ?? "") }]);
    }
    const levels = selected.levels.map(level => ({
      ...level,
      elements: level.elements.map(element => element.id === elementId ? { ...element, type: modelType, section: sectionName, color: existing?.color ?? element.color ?? colorForModel(modelType, sectionName) } : element),
    }));
    updateSelected({ levels, optimizationLockedElementIds: Array.from(new Set([...(selected.optimizationLockedElementIds ?? []), ...optimizationLockedElementIds, elementId])) });
    setOptimizationLockedElementIds(current => new Set([...current, elementId]));
    setRcDesignResult(null);
    setOptimizationRecalcRequested(true);
    toast.success(`${elementId} : ${dimensions} validé et appliqué. Cette optimisation est désormais verrouillée pour cet élément ; aucun second cycle d’optimisation ne sera lancé.`);
  };
  const addBasement = () => {
    if (!selected) return;
    const basementNumbers = selected.levels.map(level => Number(level.id.match(/^basement-(\d+)$/)?.[1] ?? 0));
    const count = Math.max(0, ...basementNumbers) + 1;
    const lowestElevation = Math.min(...selected.levels.map(level => Number(level.elevation)).filter(Number.isFinite), 0);
    const next: Level = {
      id: `basement-${count}`,
      label: `Sous-sol -${count}`,
      elevation: `${(lowestElevation - 3.2).toFixed(2)}`,
      height: "3.20",
      elements: [],
    };
    const foundationIndex = selected.levels.findIndex(level => level.id === "foundation");
    const insertAt = foundationIndex >= 0 ? foundationIndex : 0;
    const levels = [...selected.levels];
    levels.splice(insertAt, 0, next);
    updateSelected({ levels });
    setActiveLevelId(next.id);
    toast.success(`${next.label} ajouté à ${next.elevation} m`);
  };
  const addLevel = () => {
    if (!selected) return;
    const levelNumbers = selected.levels.map(level => Number(level.id.match(/^r(\d+)$/)?.[1] ?? 0));
    const number = Math.max(0, ...levelNumbers) + 1;
    const highestElevation = Math.max(...selected.levels.map(level => Number(level.elevation)).filter(Number.isFinite), 0);
    const next: Level = {
      id: `r${number}`,
      label: `R+${number}`,
      elevation: `${(highestElevation + 3.2).toFixed(2)}`,
      height: "3.20",
      elements: [],
    };
    updateSelected({ levels: [...selected.levels, next] });
    setActiveLevelId(next.id);
    toast.success(`${next.label} ajouté`);
  };
  const addElement = (
    x: number,
    y: number,
    end?: GridPoint,
    floorOverride?: FloorConfig,
    landing?: GridPoint,
    stairGeometry?: StairGeometry,
    hostLevelId?: string
  ) => {
    if (!selected || !activeLevel) return;
    const placementLevel = selected.levels.find(level => level.id === hostLevelId) ?? activeLevel;
    const xMeters = cumulativeGridPositions(xDistances.map(value => Math.max(Number(value) || Number(gridDistance) || 0.01, 0.01)), xAxes.length);
    const yMeters = cumulativeGridPositions(yDistances.map(value => Math.max(Number(value) || Number(gridDistance) || 0.01, 0.01)), yAxes.length);
    const freezePoint = (point?: GridPoint) => point ? { x: xMeters[point.x] ?? point.x * (Number(gridDistance) || 4), y: yMeters[point.y] ?? point.y * (Number(gridDistance) || 4) } : undefined;
    const freezeFlight = (flight?: StairFlightGeometry) => flight ? { ...flight, lowerA: freezePoint(flight.lowerA)!, lowerB: freezePoint(flight.lowerB)!, upperA: freezePoint(flight.upperA)!, upperB: freezePoint(flight.upperB)! } : undefined;
    const absoluteStairGeometry = stairGeometry ? {
      flight1: freezeFlight(stairGeometry.flight1),
      flight2: freezeFlight(stairGeometry.flight2),
      baseA: freezePoint(stairGeometry.baseA),
      baseB: freezePoint(stairGeometry.baseB),
      midA: freezePoint(stairGeometry.midA),
      midB: freezePoint(stairGeometry.midB),
      topA: freezePoint(stairGeometry.topA),
      topB: freezePoint(stairGeometry.topB),
      landingZ: stairGeometry.landingZ,
    } : undefined;
    const nextElement: ElementItem = {
      id: elementLabel(
        selected.levels.flatMap(level => level.elements),
        modelType
      ),
      type: modelType,
      section: modelSection,
      color: colorForModel(modelType, modelSection),
      x,
      y,
      x2: end?.x,
      y2: end?.y,
      xMid: landing?.x,
      yMid: landing?.y,
      xM: xMeters[x] ?? x * (Number(gridDistance) || 4),
      yM: yMeters[y] ?? y * (Number(gridDistance) || 4),
      x2M: end ? (xMeters[end.x] ?? end.x * (Number(gridDistance) || 4)) : undefined,
      y2M: end ? (yMeters[end.y] ?? end.y * (Number(gridDistance) || 4)) : undefined,
      xMidM: landing ? (xMeters[landing.x] ?? landing.x * (Number(gridDistance) || 4)) : undefined,
      yMidM: landing ? (yMeters[landing.y] ?? landing.y * (Number(gridDistance) || 4)) : undefined,
      stairGeometry,
      absoluteStairGeometry,
      floorConfig:
        modelType === "Dalle" || modelType === "Escaliers"
          ? (floorOverride ?? (modelType === "Escaliers" ? normalizeFloorConfig({ ...floorConfig, type: "Dalle pleine", thickness: "15 cm", characteristicImposedLoad: usageProfile(projectUsage).stairLoad.toFixed(2), stairRiser: "0.17", stairTread: "0.30", stairRise: "2.04", stairRun: "3.60", stairFinishLoad: "0.00" }) : floorConfig))
          : undefined,
    };
    if (hasSimilarElementAt(placementLevel.elements, nextElement)) {
      toast.info(
        `Un élément similaire existe déjà à cet emplacement sur ${placementLevel.label}.`
      );
      setPlacementStart(null);
      setHoverPoint(null);
      setFloorPreview(null);
      return;
    }
    const levels = selected.levels.map(level =>
      level.id === placementLevel.id
        ? { ...level, elements: [...level.elements, nextElement] }
        : level
    );
    updateSelected({ levels });
    setPlacementStart(null);
    setHoverPoint(null);
    setFloorPreview(null);
    setPanel(null);
    toast.success(`${modelType} placé sur ${placementLevel.label}`);
  };
  const handlePointPlacement = (point: GridPoint) => {
    if (!isGridIntersection(point, xAxes.length, yAxes.length)) return;
    setPanel(null);
    if (modelType === "Escaliers") {
      return handleStairPoint(point);
    }
    const isBeam = modelType === "Poutre" || modelType === "Voile" || modelType === "Longrine de redressement";
    const isTieBeam = modelType === "Longrine de redressement";
    const isSlab = modelType === "Dalle";
    const foundationLevelOnly = Boolean(activeLevel && (activeLevel.id === "foundation" || /^basement-/i.test(activeLevel.id) || /fondation|sous-sol/i.test(activeLevel.label)));
    if (isTieBeam && !foundationLevelOnly) {
      toast.info("Les longrines de redressement se posent uniquement aux fondations et sous-sols.");
      setPlacementStart(null);
      setHoverPoint(null);
      return;
    }
    if (!isSlab && canCoLocate(modelType)) {
      addElement(point.x, point.y);
      return;
    }
    if (!isBeam && !isSlab) {
      addElement(point.x, point.y);
      return;
    }
    if (!placementStart) {
      setPlacementStart(point);
      setHoverPoint(point);
      return;
    }
    if (placementStart.x === point.x && placementStart.y === point.y) return;
    if (isTieBeam && !canPlaceTieBeamBetween(activeLevel?.elements ?? [], placementStart, point)) {
      toast.info("Une longrine doit relier deux semelles distinctes du niveau de fondation ou sous-sol.");
      return;
    }
    if (
      isBeam && !isTieBeam &&
      !canPlaceBeamBetween(activeLevel?.elements ?? [], placementStart, point)
    )
      return;
    if (isSlab) {
      const x = Math.min(placementStart.x, point.x);
      const y = Math.min(placementStart.y, point.y);
      const x2 = Math.max(placementStart.x, point.x);
      const y2 = Math.max(placementStart.y, point.y);
      const direction: "X" | "Y" = x2 - x <= y2 - y ? "X" : "Y";
      addElement(x, y, { x: x2, y: y2 }, { ...floorConfig, direction });
    } else addElement(placementStart.x, placementStart.y, point);
    setPlacementStart(null);
    setHoverPoint(null);
    setFloorPreview(null);
  };
  function handleStairPoint(point: GridPoint) {
    if (!selected || !activeLevel) return;
    const index = stairPlacementStage - 1;
    const currentLevelId = activeLevel.id;
    const previous = stairConstructionPoints[index - 1];
    if (previous && previous.x === point.x && previous.y === point.y) return;
    const expectedSameAs = [1, 3, 4, 6].includes(index) ? stairPointLevels[index - 1] : undefined;
    const expectedDifferentFrom = [2, 5].includes(index) ? stairPointLevels[index - 1] : undefined;
    if (expectedSameAs && currentLevelId !== expectedSameAs) {
      toast.info("Restez sur le même niveau pour définir les deux coins de cette face.");
      return;
    }
    if (expectedDifferentFrom && currentLevelId === expectedDifferentFrom) {
      toast.info("Changez de niveau avant de sélectionner la face suivante de la volée.");
      return;
    }
    const nextPoints = [...stairConstructionPoints, point];
    const nextLevels = [...stairPointLevels, currentLevelId];
    if (index === 0) setPlacementStart(point);
    if (index === 2 || index === 3 || index === 4) setStairLandingPoint(point);
    if (index === 3) {
      const firstUpperA = nextPoints[2];
      const oppositeLandingCorner = deriveOppositeLandingCorner(firstUpperA, point);
      nextPoints.push(oppositeLandingCorner);
      nextLevels.push(currentLevelId);
      setStairConstructionPoints(nextPoints);
      setStairPointLevels(nextLevels);
      setStairPlacementStage(6);
      setStairLandingPoint(oppositeLandingCorner);
      setHoverPoint(oppositeLandingCorner);
      toast.info("Le coin opposé du palier est positionné à 1 m. Sélectionnez les deux points du niveau supérieur.");
      return;
    }
    if (index < 6) {
      setStairConstructionPoints(nextPoints);
      setStairPointLevels(nextLevels);
      setStairPlacementStage((stairPlacementStage + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7);
      setHoverPoint(point);
      return;
    }
    const [lowerA1, , , , , , upperB2] = nextPoints;
    const lowerLevelId = nextLevels[0];
    const intermediateLevelId = nextLevels[2];
    const upperLevelId = nextLevels[5];
    const lowerIndex = selected.levels.findIndex(level => level.id === lowerLevelId);
    const intermediateIndex = selected.levels.findIndex(level => level.id === intermediateLevelId);
    const upperIndex = selected.levels.findIndex(level => level.id === upperLevelId);
    if (lowerIndex < 0 || intermediateIndex < 0 || upperIndex < 0 || !(lowerIndex < intermediateIndex && intermediateIndex < upperIndex)) {
      toast.info("Un escalier doit relier trois niveaux dans l’ordre : bas, intermédiaire puis haut. Le palier est porté par le niveau intermédiaire.");
      setStairConstructionPoints([]);
      setStairPointLevels([]);
      setStairPlacementStage(1);
      return;
    }
    const resolvedLevels = [lowerLevelId, lowerLevelId, intermediateLevelId, intermediateLevelId, intermediateLevelId, upperLevelId, upperLevelId];
    const totalHeight = Number(selected.levels.find(level => level.id === intermediateLevelId)?.height ?? "3.20") || 3.20;
    const stairConfig = normalizeFloorConfig({ ...floorConfig, type: "Dalle pleine", thickness: "15 cm", characteristicImposedLoad: usageProfile(projectUsage).stairLoad.toFixed(2), stairRiser: "0.17", stairTread: "0.30", stairRise: "2.04", stairRun: "3.60", stairFinishLoad: "0.00", direction: "X" });
    addElement(lowerA1.x, lowerA1.y, upperB2, stairConfig, nextPoints[2], {
      flight1: { lowerA: nextPoints[0], lowerB: nextPoints[1], upperA: nextPoints[2], upperB: nextPoints[3], lowerLevelId: resolvedLevels[0], upperLevelId: resolvedLevels[2] },
      flight2: { lowerA: nextPoints[3], lowerB: nextPoints[4], upperA: nextPoints[5], upperB: nextPoints[6], lowerLevelId: resolvedLevels[3], upperLevelId: resolvedLevels[5] },
      landingZ: totalHeight / 2,
    }, intermediateLevelId);
    setPlacementStart(null);
    setStairLandingPoint(null);
    setStairConstructionPoints([]);
    setStairPointLevels([]);
    setStairPlacementStage(1);
    setHoverPoint(null);
    toast.success("Les deux volées en dalles pleines de 15 cm ont été créées.");
  }
  const handleStairBeamSelect = (beam: ElementItem) => {
    if (!selected || !activeLevel) return;
    if (stairPlacementStage === 1) {
      const candidates = stairArrivalBeams.filter(item => item.id !== beam.id);
      if (candidates.length === 0) {
        toast.info("Ajoutez au moins une deuxième poutre pour recevoir le palier d’arrivée.");
        return;
      }
      const source = { x: beam.x, y: beam.y };
      const targetBeam = [...candidates].sort((a, b) => {
        const distance = (item: ElementItem) => Math.hypot(((item.x2 ?? item.x) + item.x) / 2 - source.x, ((item.y2 ?? item.y) + item.y) / 2 - source.y);
        return distance(b) - distance(a);
      })[0];
      const arrival = Math.hypot(targetBeam.x - source.x, targetBeam.y - source.y) >= Math.hypot((targetBeam.x2 ?? targetBeam.x) - source.x, (targetBeam.y2 ?? targetBeam.y) - source.y)
        ? { x: targetBeam.x, y: targetBeam.y }
        : { x: targetBeam.x2 ?? targetBeam.x, y: targetBeam.y2 ?? targetBeam.y };
      const landing = { x: (source.x + arrival.x) / 2, y: (source.y + arrival.y) / 2 };
      const direction: "X" | "Y" = Math.abs(arrival.x - source.x) >= Math.abs(arrival.y - source.y) ? "X" : "Y";
      addElement(source.x, source.y, arrival, normalizeFloorConfig({ ...floorConfig, type: "Dalle pleine", thickness: "15 cm", characteristicImposedLoad: usageProfile(projectUsage).stairLoad.toFixed(2), stairRiser: "0.17", stairTread: "0.30", stairRise: "2.04", stairRun: "3.60", stairFinishLoad: "0.00", direction }), landing);
      setStairPreviewBeam(null);
      setStairPlacementStage(1);
      setHoverPoint(null);
      return;
    }
    if (!placementStart || !stairLandingPoint) return;
    const startDistance = Math.hypot(beam.x - stairLandingPoint.x, beam.y - stairLandingPoint.y);
    const endDistance = Math.hypot((beam.x2 ?? beam.x) - stairLandingPoint.x, (beam.y2 ?? beam.y) - stairLandingPoint.y);
    const arrival = endDistance < startDistance ? { x: beam.x2 ?? beam.x, y: beam.y2 ?? beam.y } : { x: beam.x, y: beam.y };
    if (arrival.x === placementStart.x && arrival.y === placementStart.y) {
      toast.info("La poutre d’arrivée doit être différente du nœud de départ.");
      return;
    }
    const direction: "X" | "Y" = Math.abs(stairLandingPoint.x - placementStart.x) >= Math.abs(stairLandingPoint.y - placementStart.y) ? "X" : "Y";
    addElement(placementStart.x, placementStart.y, arrival, normalizeFloorConfig({ ...floorConfig, type: "Dalle pleine", thickness: "15 cm", characteristicImposedLoad: usageProfile(projectUsage).stairLoad.toFixed(2), stairRiser: "0.17", stairTread: "0.30", stairRise: "2.04", stairRun: "3.60", stairFinishLoad: "0.00", direction }), stairLandingPoint);
    setPlacementStart(null);
    setStairLandingPoint(null);
    setStairPlacementStage(1);
    setStairArrivalBeamId(beam.id);
    setStairPreviewBeam(null);
    setHoverPoint(null);
  };
  const handleStairBeamHover = (beam: ElementItem | null) => {
    if (stairPlacementStage === 3) setStairPreviewBeam(beam);
  };
  const pointerToGrid = (
    event: React.PointerEvent<SVGElement>
  ): GridPoint | null => {
    const svg = event.currentTarget instanceof SVGSVGElement
      ? event.currentTarget
      : event.currentTarget.ownerSVGElement;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const svgPoint = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
    const zoomOffsetX = 215 * (1 - gridZoom);
    const zoomOffsetY = 255 * (1 - gridZoom);
    const localX = (svgPoint.x - gridPan.x - zoomOffsetX) / gridZoom - gridOrigin.x;
    const localY = (svgPoint.y - gridPan.y - zoomOffsetY) / gridZoom - gridOrigin.y;
    const touchTolerance = Math.max(18 / gridZoom, 8);
    const point = snapToGridPoint(
      localX,
      localY,
      xGridPositions,
      yGridPositions,
      touchTolerance
    );
    return point && isGridIntersection(point, xAxes.length, yAxes.length)
      ? point
      : null;
  };
  const beginGridPan = (event: React.PointerEvent<SVGSVGElement>) => {
    const pointTarget = (event.target as Element).closest("[data-grid-point]");
    if (pointTarget && (modelType === "Poutre" || modelType === "Voile" || modelType === "Longrine de redressement" || modelType === "Dalle")) {
      event.currentTarget.setPointerCapture(event.pointerId);
      beamTraceRef.current = true;
      return;
    }
    if (
      (event.target as Element).closest("[data-grid-point]") ||
      (event.target as Element).closest("[data-grid-element]")
    )
      return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      startX: event.clientX,
      startY: event.clientY,
      originX: gridPan.x,
      originY: gridPan.y,
    });
  };
  const moveGridPan = (event: React.PointerEvent<SVGSVGElement>) => {
    const point = pointerToGrid(event);
    if ((modelType === "Dalle" || modelType === "Escaliers") && point && placementStart) {
      const x = Math.min(placementStart.x, point.x);
      const y = Math.min(placementStart.y, point.y);
      const x2 = Math.max(placementStart.x, point.x);
      const y2 = Math.max(placementStart.y, point.y);
      setFloorPreview({
        x,
        y,
        x2,
        y2,
          direction: x2 - x <= y2 - y ? "X" : "Y",
      });
    }
    if (point && placementStart) setHoverPoint(point);
    if (dragState)
      setGridPan({
        x: dragState.originX + event.clientX - dragState.startX,
        y: dragState.originY + event.clientY - dragState.startY,
      });
    if (draggedElement && point && selected && activeLevel) {
      const dx = point.x - draggedElement.start.x;
      const dy = point.y - draggedElement.start.y;
      const nextLevels = selected.levels.map(level =>
        level.id === activeLevel.id
          ? {
              ...level,
              elements: level.elements.map(item =>
                item.id === draggedElement.id
                  ? {
                      ...item,
                      x: point.x,
                      y: point.y,
                      x2:
                        draggedElement.x2 === undefined
                          ? item.x2
                          : draggedElement.x2 + dx,
                      y2:
                        draggedElement.y2 === undefined
                          ? item.y2
                          : draggedElement.y2 + dy,
                    }
                  : item
              ),
            }
          : level
      );
      updateSelected({ levels: nextLevels });
    }
  };
  const handleGridWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    setGridZoom(value =>
      Math.min(2.8, Math.max(0.65, value + (event.deltaY < 0 ? 0.12 : -0.12)))
    );
  };
  const endGridPan = (event?: React.PointerEvent<SVGSVGElement>) => {
    if (beamTraceRef.current && event) {
      const point = pointerToGrid(event);
      if (point && !placementStart) {
        setPlacementStart(point);
        setHoverPoint(point);
      } else if (
        point &&
        placementStart &&
        (point.x !== placementStart.x || point.y !== placementStart.y)
      ) {
        handlePointPlacement(point);
      }
      beamTraceRef.current = false;
    }
    if (event && event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (
      draggedElement &&
      dragSnapshot.current &&
      selected &&
      JSON.stringify(dragSnapshot.current) !== JSON.stringify(selected)
    )
      setMovementHistory(history => ({
        past: [...history.past, dragSnapshot.current as Project].slice(-30),
        future: [],
      }));
    dragSnapshot.current = null;
    setDragState(null);
    setDraggedElement(null);
    setHoverPoint(null);
    if (modelType !== "Dalle" && modelType !== "Escaliers") setFloorPreview(null);
  };
  const cancelGridInteraction = (event: React.PointerEvent<SVGSVGElement>) => {
    beamTraceRef.current = false;
    setDragState(null);
    setDraggedElement(null);
    setPlacementStart(null);
    setHoverPoint(null);
    setFloorPreview(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const undoMovement = () => {
    const previous = movementHistory.past.at(-1);
    if (!previous || !selected)
      return toast.info("Aucun déplacement à annuler");
    setMovementHistory(history => ({
      past: history.past.slice(0, -1),
      future: [selected, ...history.future].slice(0, 30),
    }));
    setSelected(previous);
    setProjects(projects =>
      projects.map(project => (project.id === previous.id ? previous : project))
    );
  };
  const redoMovement = () => {
    const next = movementHistory.future[0];
    if (!next || !selected) return toast.info("Aucun déplacement à rétablir");
    setMovementHistory(history => ({
      past: [...history.past, selected],
      future: history.future.slice(1),
    }));
    setSelected(next);
    setProjects(projects =>
      projects.map(project => (project.id === next.id ? next : project))
    );
  };
  const toggleDuplicateGroup = (type: string) => {
    if (!activeLevel) return;
    const groupIds = activeLevel.elements.filter(item => item.type === type).map(item => item.id);
    if (!groupIds.length) return;
    setDuplicateIds(current => {
      const allSelected = groupIds.every(id => current.includes(id));
      return allSelected ? current.filter(id => !groupIds.includes(id)) : Array.from(new Set([...current, ...groupIds]));
    });
  };
  const duplicateElements = () => {
    if (!selected || !activeLevel) return;
    const targetIds = duplicateTargetLevelIds.filter(id => id !== activeLevel.id);
    if (!targetIds.length) return toast.info("Choisissez au moins un niveau cible");
    const source = activeLevel.elements.filter(item => duplicateIds.includes(item.id));
    if (!source.length) return toast.info("Sélectionnez au moins un élément à copier");
    let skippedDuplicates = 0;
    const levels = selected.levels.map(level => {
      if (!targetIds.includes(level.id)) return level;
      const additions = source.flatMap(item => {
        const isStair = item.type === "Escaliers" || item.id.startsWith("ES");
        const sameStairPlace = isStair && level.elements.some(existing =>
          (existing.type === "Escaliers" || existing.id.startsWith("ES")) &&
          Math.abs(existing.x - item.x) < 0.001 &&
          Math.abs(existing.y - item.y) < 0.001
        );
        if (sameStairPlace || (!isStair && hasSimilarElementAt(level.elements, item))) {
          skippedDuplicates += 1;
          return [];
        }
        const sourceGeometry = isStair ? item.stairGeometry : undefined;
        const sourceAbsoluteGeometry = isStair
          ? (item.absoluteStairGeometry ?? item.stairGeometry?.absolute)
          : undefined;
        const remappedGeometry = isStair
          ? remapStairGeometryLevels(sourceGeometry, selected.levels, activeLevel.id, level.id)
          : undefined;
        const remappedAbsoluteGeometry = isStair
          ? remapStairGeometryLevels(
              sourceAbsoluteGeometry as StairGeometry | undefined,
              selected.levels,
              activeLevel.id,
              level.id
            )
          : undefined;
        return [{
          ...item,
          id: `${item.id}-copie-${crypto.randomUUID()}`,
          stairGeometry: isStair ? remappedGeometry : item.stairGeometry,
          absoluteStairGeometry: isStair ? remappedAbsoluteGeometry?.absolute ?? remappedAbsoluteGeometry : item.absoluteStairGeometry,
        }];
      });
      return { ...level, elements: [...level.elements, ...additions] };
    });
    const nextProject: Project = { ...selected, levels: renumberBuildingElements(levels), updatedAt: "À l’instant" };
    setSelected(nextProject);
    setProjects(previous => previous.map(project => project.id === nextProject.id ? nextProject : project));
    setActiveLevelId(targetIds[0]);
    setDuplicateIds([]);
    setDuplicateTargetLevelIds([]);
    setPanel(null);
    toast.success(`${source.length} élément${source.length > 1 ? "s" : ""} traité${source.length > 1 ? "s" : ""} sur ${targetIds.length} niveau${targetIds.length > 1 ? "x" : ""}`);
    if (skippedDuplicates > 0) {
      toast.info(`${skippedDuplicates} élément${skippedDuplicates > 1 ? "s" : ""} similaire${skippedDuplicates > 1 ? "s" : ""} déjà présent${skippedDuplicates > 1 ? "s" : ""} : aucune superposition créée.`);
    }
  };
  const deleteElement = (id: string) => {
    if (!selected) return;
    const sourceLevelId = editingLevelId ?? activeLevel?.id;
    if (!sourceLevelId) return;
    updateSelected({
      levels: removeElement(selected.levels, sourceLevelId, id),
    });
    setEditingElement(null);
    setEditingLevelId(null);
    setSelected3DElementKey(null);
    setElementSelectionMode(false);
    setPanel(null);
  };
  const openElementEditor = (
    item: ElementItem,
    levelId = activeLevel?.id ?? "rdc"
  ) => {
    setEditingElement(item);
    setEditingLevelId(levelId);
    setEditType(item.type);
    setEditSection(item.section);
    setEditColor(item.color ?? colorForModel(item.type, item.section));
    setEditX(String(item.x));
    setEditY(String(item.y));
    setEditSurfaceOpenings((item.openings ?? []).map(opening => `${opening.x1M};${opening.y1M};${opening.x2M};${opening.y2M}`).join("\n"));
    setTargetLevelId(levelId);
    if (item.type === "Dalle")
      setFloorConfig(
        normalizeFloorConfig(
          item.floorConfig ?? floorConfigForSection(item.section)
        )
      );
    setElementSelectionMode(true);
    setPanel("Éditer l’élément");
  };
  const saveElementEdit = () => {
    if (!selected || !editingElement || !editingLevelId) return;
    const parsedOpenings = editType === "Dalle" ? parseSurfaceOpeningLines(editSurfaceOpenings) : { openings: [] as RectangularOpening[], error: null as string | null };
    if (parsedOpenings.error) return toast.error(parsedOpenings.error);
    const updated = {
      ...editingElement,
      type: editType,
      section: editSection,
      color: normalizeModelColor(
        editColor,
        colorForModel(editType, editSection)
      ),
      x: Number(editX) || 0,
      y: Number(editY) || 0,
      floorConfig:
        editType === "Dalle"
          ? floorConfigForSection(editSection, floorConfig)
          : undefined,
      openings: editType === "Dalle" ? parsedOpenings.openings : undefined,
    };
    const sourceLevel = selected.levels.find(
      level => level.id === editingLevelId
    );
    if (
      sourceLevel &&
      hasSimilarElementAt(
        sourceLevel.elements.filter(item => item.id !== editingElement.id),
        updated
      )
    ) {
      toast.info(
        `Un élément similaire existe déjà à cet emplacement sur ${sourceLevel.label}.`
      );
      return;
    }
    const changed = updateElement(selected.levels, editingLevelId, updated);
    const moved = moveElement(
      changed,
      editingLevelId,
      targetLevelId,
      editingElement.id
    );
    updateSelected({ levels: moved });
    setEditingElement(null);
    setEditingLevelId(null);
    setSelected3DElementKey(null);
    setElementSelectionMode(false);
    setPanel(null);
    toast.success(
      targetLevelId === editingLevelId ? "Élément modifié" : "Élément déplacé"
    );
  };
  const analysisValues = Object.fromEntries(
    analysisRows.map(row => [
      `${row.levelId}:${row.id}`,
      {
        gk: row.gk,
        qk: row.qk,
        nu: row.nu,
        nser: row.nser,
        moment: row.moment,
      },
    ])
  );
  const selectedPassport = selectedAnalysisRow ? createStructuralPassport({
    elementId: selectedAnalysisRow.id,
    label: selectedAnalysisRow.label,
    elementType: loadFamilyLabel(selectedAnalysisRow.type),
    levelLabel: selected?.levels.find(level => level.id === selectedAnalysisRow.levelId)?.label ?? selectedAnalysisRow.levelId,
    section: selectedAnalysisRow.section ?? "Non renseigné",
    gkKn: selectedAnalysisRow.gk,
    qkKn: selectedAnalysisRow.qk,
    nuKn: selectedAnalysisRow.nu,
    nserKn: selectedAnalysisRow.nser,
    momentKnM: analysisValues[`${selectedAnalysisRow.levelId}:${selectedAnalysisRow.id}`]?.moment ?? null,
    supports: selectedAnalysisRow.supports,
    sources: selectedAnalysisRow.sources,
  }) : null;
  const analysisScaleColors = Object.fromEntries(
    analysisRows
      .filter(row => ["Poteau", "Poutre", "Dalle", "Escaliers", "Semelle"].includes(row.type))
      .map(row => [
        `${row.levelId}:${row.id}`,
        criticalElementKeys.includes(`${row.levelId}:${row.id}`) ? "#ff1717" : loadScale.colorFor({ id: row.id, levelId: row.levelId, type: row.type, nu: row.nu }),
      ])
  );
  const stairNodePoints = (activeLevel?.elements ?? [])
    .filter(item => item.type === "Poteau")
    .filter(column => (activeLevel?.elements ?? []).some(beam =>
      beam.type === "Poutre" && beam.x2 !== undefined && beam.y2 !== undefined &&
      ((Math.abs(beam.x - column.x) < 0.001 && Math.abs(beam.y - column.y) < 0.001) ||
       (Math.abs((beam.x2 ?? 0) - column.x) < 0.001 && Math.abs((beam.y2 ?? 0) - column.y) < 0.001))
    ))
    .map(column => ({ x: column.x, y: column.y }));
  const stairPolePoints = (activeLevel?.elements ?? [])
    .filter(item => item.type === "Poteau")
    .map(item => ({ x: item.x, y: item.y }));
  const stairArrivalBeams = (activeLevel?.elements ?? []).filter(item => item.type === "Poutre" && item.x2 !== undefined && item.y2 !== undefined);
  const elementColor = (item: ElementItem) =>
    analysisScaleColors[`${activeLevelId}:${item.id}`] ??
    (criticalElementKeys.includes(`${activeLevelId}:${item.id}`)
      ? "#ff1717"
      : item.color ?? colorForModel(item.type, item.section));
  const actualThreeDView = (
    <Building3DView
      levels={selected?.levels ?? []}
      modelCatalog={customModels}
      xCount={xAxes.length}
      yCount={yAxes.length}
      xAxisDistances={xDistances}
      yAxisDistances={yDistances}
      gridDistance={gridDistance}
      selectionEnabled={elementSelectionMode}
      selectedElementKey={selected3DElementKey}
      analysisValues={analysisValues}
      criticalElementKeys={criticalElementKeys}
      analysisScaleColors={analysisScaleColors}
      showAnalysisValues={showAnalysisValues}
      showAnalysisMoments={showAnalysisMoments}
      loadVisuals={loadVisuals}
      showLoadValues={showLoadValues}
      meshedSurfaceIds={surfaceAnalysis?.rows.filter(row => Boolean(row.analysis.mesh)).map(row => row.elementId) ?? []}
      meshSizeM={Number(surfaceMeshSizeM.replace(",", ".")) || 0.75}
      stairPlacementActive={false}
      stairPlacementStart={placementStart}
      stairLandingPoint={stairLandingPoint}
      onStairPointSelect={handleStairPoint}
      stairNodePoints={stairNodePoints}
      stairPolePoints={stairPolePoints}
      stairLandingZ={Number(activeLevel?.height ?? "3.20") / 2}
      stairLevelHeight={Number(activeLevel?.height ?? "3.20")}
      stairArrivalBeams={stairArrivalBeams}
      stairPreviewBeam={stairPreviewBeam}
      stairPlacementStage={stairPlacementStage}
      onStairBeamSelect={handleStairBeamSelect}
      onStairBeamHover={handleStairBeamHover}
      onElementSelect={(levelId, item) => {
        setActiveLevelId(levelId);
        setSelected3DElementKey(`${levelId}:${item.id}`);
        openElementEditor(item, levelId);
      }}
    />
  );
  const threeDView = (
    <div className="relative h-[510px] overflow-hidden rounded-[14px] border border-[#cbdde1] bg-[#edf7fa]">
      <svg viewBox="0 0 430 510" className="h-full w-full">
        <g
          transform="translate(55 110) scale(1 0.55) skewX(-20)"
          opacity="0.95"
        >
          <rect
            x="0"
            y="0"
            width={Math.max(xAxes.length - 1, 1) * 68}
            height={Math.max(yAxes.length - 1, 1) * 68}
            fill="#dcebf1"
            stroke="#27358f"
            strokeWidth="3"
          />
          {activeLevel?.elements.map(item => {
            const x = item.x * 68;
            const y = item.y * 68;
            const x2 = (item.x2 ?? item.x) * 68;
            const y2 = (item.y2 ?? item.y) * 68;
            return (
              <g key={`3d-${item.id}`}>
                <line
                  x1={x}
                  y1={y}
                  x2={x2}
                  y2={y2}
                  stroke={item.type === "Poutre" ? "#e87538" : "transparent"}
                  strokeWidth="12"
                />
                {item.type === "Poteau" && (
                  <rect
                    x={x - 8}
                    y={y - 8}
                    width="16"
                    height="16"
                    fill={elementColor(item)}
                  />
                )}
                {item.type === "Semelle" && (
                  <rect
                    x={x - 15}
                    y={y - 12}
                    width="30"
                    height="24"
                    fill="none"
                    stroke={elementColor(item)}
                    strokeWidth="3"
                  />
                )}
                {(item.type === "Dalle" || item.type === "Escaliers") && (
                  <rect
                    x={Math.min(x, x2)}
                    y={Math.min(y, y2)}
                    width={Math.abs(x2 - x)}
                    height={Math.abs(y2 - y)}
                    fill="#7bc9c5"
                    opacity="0.55"
                    stroke="#087f7f"
                    strokeWidth="2"
                  />
                )}
              </g>
            );
          })}
        </g>
        <text x="20" y="470" className="fill-[#52656b] text-[11px]">
          Vue 3D géométrique · {activeLevel?.elements.length ?? 0} éléments
          placés
        </text>
      </svg>
    </div>
  );
  const addAxis = (axis: "x" | "y" | "z") => {
    if (axis === "x") {
      remapAxisChange("x", [...xAxes, `${xAxes.length + 1}`]);
    }
    if (axis === "y") {
      remapAxisChange("y", [...yAxes, String.fromCharCode(65 + yAxes.length)]);
    }
    if (axis === "z") {
      const next = `R+${zLevels.length - 1} ${(zLevels.length * 3.2).toFixed(2)} m`;
      setZLevels(prev => [...prev, next]);
      addLevel();
    }
  };

  if (!selected)
    return (
      <div className="pb-4">
        <div className="mb-4">
          <h2 className="text-[20px] font-bold">
            Bâtiment — Descente de charges
          </h2>
          <p className="text-[11px] text-[#858585]">
            Historique de vos projets structurels.
          </p>
        </div>
        {projects.length ? (
          <div className="space-y-3">
            {projects.map(project => (
              <button
                key={project.id}
                onClick={() => setSelectedProject(project)}
                className="w-full rounded-[14px] bg-white p-4 text-left shadow-[0_2px_8px_rgba(0,0,0,.05)]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#dff5f4] text-[#049b9b]">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[14px] font-bold">
                        {project.name}
                      </div>
                      <div className="mt-1 text-[10px] text-[#858585]">
                        Non calculé · {project.levels.length} niveaux ·{" "}
                        {project.levels.reduce(
                          (sum, level) => sum + level.elements.length,
                          0
                        )}{" "}
                        éléments
                      </div>
                    </div>
                  </div>
                  <Badge className="bg-[#fff1e9] text-[#e87538] hover:bg-[#fff1e9]">
                    {project.updatedAt}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-[14px] border border-dashed border-[#d8e2e5] bg-white p-8 text-center text-[12px] text-[#858585]">
            Aucun projet enregistré.
            <br />
            Créez votre premier bâtiment pour commencer.
          </div>
        )}
        <Button
          onClick={() => setDialogOpen(true)}
          className="mt-6 w-full rounded-xl bg-[#6247a8] text-white hover:bg-[#513a91]"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nouveau projet
        </Button>
        {dialogOpen && (
          <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 px-3 pb-24">
            <Card className="w-full max-w-[430px] rounded-[18px] border-0 bg-white">
              <CardHeader>
                <CardTitle className="text-[18px]">Nouveau projet</CardTitle>
                <p className="text-[11px] text-[#858585]">
                  Saisissez le nom du projet bâtiment.
                </p>
              </CardHeader>
              <CardContent>
                <Label className="text-[11px]">Nom du projet</Label>
                <Input
                  autoFocus
                  className="mt-2 h-11"
                  placeholder="Ex : Villa R+2"
                  value={projectName}
                  onChange={event => setProjectName(event.target.value)}
                  onKeyDown={event => event.key === "Enter" && createProject()}
                />
                <Label className="mt-4 block text-[11px]">Usage principal du projet</Label>
                <select
                  className="mt-2 h-11 w-full rounded-md border border-[#e2e8eb] bg-white px-3 text-[12px]"
                  value={projectUsage}
                  onChange={event => setProjectUsage(event.target.value as ProjectUsage)}
                >
                  {PROJECT_USAGE_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label} · Qk {option.load.toFixed(2)} kN/m²</option>)}
                </select>
                <p className="mt-2 text-[10px] leading-4 text-[#78888d]">Cette valeur sera utilisée par défaut pour les planchers et les charges d’exploitation du projet. Elle reste modifiable dans la configuration du plancher.</p>
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={createProject}
                    className="bg-[#6247a8] text-white"
                  >
                    Créer
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );

  const gridCell = 68;
  const gridOrigin = { x: 54, y: 42 };
  const axisDistance = (values: string[], index: number) =>
    Math.max(Number(values[index] || gridDistance) || 0.01, 0.01);
  const cumulativeAxis = (values: string[], count: number) => {
    const raw = cumulativeGridPositions(
      values.map((_, index) => axisDistance(values, index)),
      count
    );
    const scale = proportionalGridScale(raw, Math.max(count - 1, 1) * gridCell);
    return raw.map(value => value * scale);
  };
  const xGridPositions = cumulativeAxis(xDistances, xAxes.length);
  const yGridPositions = cumulativeAxis(yDistances, yAxes.length);
  const interpolateGridPosition = (value: number, positions: number[]) => {
    if (!positions.length) return value * gridCell;
    if (value <= 0) return positions[0] ?? 0;
    const last = positions.length - 1;
    if (value >= last) {
      const span = (positions[last] ?? last * gridCell) - (positions[Math.max(0, last - 1)] ?? Math.max(0, last - 1) * gridCell);
      return (positions[last] ?? last * gridCell) + (value - last) * span;
    }
    const index = Math.floor(value);
    const ratio = value - index;
    return (positions[index] ?? index * gridCell) + ratio * ((positions[index + 1] ?? (index + 1) * gridCell) - (positions[index] ?? index * gridCell));
  };
  const gridPoint = (x: number, y: number) => ({
    x: gridOrigin.x + interpolateGridPosition(x, xGridPositions),
    y: gridOrigin.y + interpolateGridPosition(y, yGridPositions),
  });
  const currentXMeters = cumulativeGridPositions(xDistances.map(value => Math.max(Number(value) || Number(gridDistance) || 0.01, 0.01)), xAxes.length);
  const currentYMeters = cumulativeGridPositions(yDistances.map(value => Math.max(Number(value) || Number(gridDistance) || 0.01, 0.01)), yAxes.length);
  const metricGridPoint = (point: GridPoint) => {
    const projectMetric = (value: number, meters: number[], pixels: number[]) => {
      if (meters.length < 2) return value * gridCell;
      if (value <= meters[0]) return pixels[0] ?? 0;
      const last = meters.length - 1;
      if (value >= meters[last]) {
        const meterSpan = Math.max(meters[last] - meters[last - 1], 0.01);
        const pixelSpan = (pixels[last] ?? last * gridCell) - (pixels[last - 1] ?? (last - 1) * gridCell);
        return (pixels[last] ?? last * gridCell) + ((value - meters[last]) / meterSpan) * pixelSpan;
      }
      const index = meters.findIndex((meter, i) => i > 0 && value <= meter);
      const upper = Math.max(index, 1);
      const ratio = (value - meters[upper - 1]) / Math.max(meters[upper] - meters[upper - 1], 0.01);
      return (pixels[upper - 1] ?? (upper - 1) * gridCell) + ratio * ((pixels[upper] ?? upper * gridCell) - (pixels[upper - 1] ?? (upper - 1) * gridCell));
    };
    return { x: gridOrigin.x + projectMetric(point.x, currentXMeters, xGridPositions), y: gridOrigin.y + projectMetric(point.y, currentYMeters, yGridPositions) };
  };
  const gridSpanX = (start: number, end: number) => Math.abs(interpolateGridPosition(end, xGridPositions) - interpolateGridPosition(start, xGridPositions));
  const gridSpanY = (start: number, end: number) => Math.abs(interpolateGridPosition(end, yGridPositions) - interpolateGridPosition(start, yGridPositions));
  const dimensionsForItem = (item: ElementItem) => customModels.find(model => model.type === item.type && model.name === item.section)?.dimensions ?? modelSpec(item.type, item.section)?.dimensions ?? item.section;
  const sectionNumbers = (item: ElementItem) => {
    const source = dimensionsForItem(item);
    return Array.from(source.matchAll(/(\d+(?:[.,]\d+)?)/g)).map(match => Number(match[1].replace(",", ".")));
  };
  const sectionMeters = (value: number, source: string) => /cm/i.test(source) ? value / 100 : /\bm\b/i.test(source) ? value : value > 2 ? value / 100 : value;
  const stairPreviewRect = (startIndex: number, endIndex: number) => {
    const a = stairConstructionPoints[startIndex];
    const b = stairConstructionPoints[endIndex];
    if (!a || !b) return null;
    const left = Math.min(gridPoint(a.x, a.y).x, gridPoint(b.x, b.y).x);
    const top = Math.min(gridPoint(a.x, a.y).y, gridPoint(b.x, b.y).y);
    return { left, top, width: Math.max(Math.abs(gridPoint(b.x, b.y).x - gridPoint(a.x, a.y).x), 8), height: Math.max(Math.abs(gridPoint(b.x, b.y).y - gridPoint(a.x, a.y).y), 8) };
  };
  const stairPreviewQuad = (indices: number[]) => indices.map(index => stairConstructionPoints[index]).filter(Boolean).map(point => { const projected = gridPoint(point.x, point.y); return `${projected.x},${projected.y}`; }).join(" ");
  const grid = (
    <div className="relative h-[510px] overflow-hidden rounded-[14px] border border-[#cbdde1] bg-[#fbfdfd] shadow-inner">
      <div className="absolute left-3 right-3 top-3 z-10 flex items-center justify-between rounded-lg bg-white/95 px-3 py-2 text-[10px] shadow-sm">
        <span className="font-semibold text-[#27358f]">
          Grille de trame · {activeLevel?.label}
        </span>
        <span className="text-[#64747b]">
          {modelType === "Escaliers"
            ? `${modelSection} · ${stairPlacementStage <= 2 ? "volée 1 — face basse" : stairPlacementStage <= 4 ? "volée 1 — face haute" : stairPlacementStage === 5 ? "volée 2 — coin opposé du palier à 1 m" : "volée 2 — face haute"} · point ${stairPlacementStage}/7`
            : modelType === "Poteau" || modelType === "Semelle"
              ? `${modelSection} : touchez une intersection`
              : placementStart
                ? `${modelSection} : touchez le 2e point`
                : `${modelSection} : touchez le 1er point`}
        </span>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-10 rounded-lg bg-white/95 px-2.5 py-2 shadow-sm">
        <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-[#68767d]">
          Légende des modèles
        </div>
        <div className="flex max-h-12 flex-wrap gap-x-3 gap-y-1 overflow-hidden">
          {buildModelLegend(activeLevel?.elements ?? []).map(item => (
            <span
              key={`${item.type}-${item.section}`}
              className="inline-flex items-center gap-1 text-[9px] text-[#3e484d]"
            >
              <i
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: item.color }}
              />
              {item.section}
            </span>
          ))}
          {!activeLevel?.elements.length && (
            <span className="text-[9px] text-[#879298]">
              Aucun modèle placé
            </span>
          )}
        </div>
      </div>
      <svg
        viewBox="0 0 430 510"
        className="h-full w-full touch-none"
        onWheel={handleGridWheel}
        onPointerDown={beginGridPan}
        onPointerMove={moveGridPan}
        onPointerUp={endGridPan}
        onPointerCancel={cancelGridInteraction}
      >
        <defs>
          <pattern
            id="floor-grid"
            width="12"
            height="12"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 12 0 L 0 0 0 12"
              fill="none"
              stroke="#3d9b9b"
              strokeWidth="0.8"
              opacity="0.55"
            />
          </pattern>
          <marker
            id="floor-arrow"
            markerWidth="7"
            markerHeight="7"
            refX="5"
            refY="3.5"
            orient="auto"
          >
            <path d="M0,0 L7,3.5 L0,7 z" fill="#087f7f" />
          </marker>
        </defs>
        <g
          transform={`translate(${gridPan.x + 215 * (1 - gridZoom)} ${gridPan.y + 255 * (1 - gridZoom)}) scale(${gridZoom})`}
          opacity={Number(gridOpacity) / 100}
        >
          {xAxes.map((axis, index) => {
            const point = gridPoint(index, 0);
            return (
              <g key={`x-axis-${index}`}>
                <line
                  x1={point.x}
                  y1={gridOrigin.y - 18}
                  x2={point.x}
                  y2={
                    gridOrigin.y + Math.max(yAxes.length - 1, 0) * gridCell + 18
                  }
                  stroke="#a9c2c7"
                  strokeWidth="1"
                />
                <text
                  x={point.x}
                  y={gridOrigin.y - 25}
                  textAnchor="middle"
                  className="fill-[#52656b] text-[11px] font-bold"
                >
                  {axis}
                </text>
              </g>
            );
          })}
          {yAxes.map((axis, index) => {
            const point = gridPoint(0, index);
            return (
              <g key={`y-axis-${index}`}>
                <line
                  x1={gridOrigin.x - 18}
                  y1={point.y}
                  x2={
                    gridOrigin.x +
                    (xGridPositions.at(-1) ??
                      Math.max(xAxes.length - 1, 0) * gridCell) +
                    18
                  }
                  y2={point.y}
                  stroke="#a9c2c7"
                  strokeWidth="1"
                />
                <text
                  x={gridOrigin.x - 27}
                  y={point.y + 4}
                  textAnchor="middle"
                  className="fill-[#52656b] text-[11px] font-bold"
                >
                  {axis}
                </text>
              </g>
            );
          })}
          {xDistances
            .slice(0, Math.max(xAxes.length - 1, 0))
            .map((distance, index) => {
              const left = gridPoint(index, 0);
              const right = gridPoint(index + 1, 0);
              const mid = (left.x + right.x) / 2;
              return (
                <g key={`x-distance-${index}`} pointerEvents="none">
                  <line
                    x1={left.x + 7}
                    y1={gridOrigin.y - 35}
                    x2={right.x - 7}
                    y2={gridOrigin.y - 35}
                    stroke="#e87538"
                    strokeWidth="1.2"
                  />
                  <text
                    x={mid}
                    y={gridOrigin.y - 39}
                    textAnchor="middle"
                    className="fill-[#c85f2b] text-[9px] font-bold"
                  >
                    {Number(distance || gridDistance).toFixed(2)} m
                  </text>
                </g>
              );
            })}
          {yDistances
            .slice(0, Math.max(yAxes.length - 1, 0))
            .map((distance, index) => {
              const top = gridPoint(0, index);
              const bottom = gridPoint(0, index + 1);
              const mid = (top.y + bottom.y) / 2;
              return (
                <g key={`y-distance-${index}`} pointerEvents="none">
                  <line
                    x1={gridOrigin.x - 45}
                    y1={top.y + 7}
                    x2={gridOrigin.x - 45}
                    y2={bottom.y - 7}
                    stroke="#049b9b"
                    strokeWidth="1.2"
                  />
                  <text
                    x={gridOrigin.x - 50}
                    y={mid + 3}
                    textAnchor="middle"
                    className="fill-[#087f7f] text-[9px] font-bold"
                    transform={`rotate(-90 ${gridOrigin.x - 50} ${mid + 3})`}
                  >
                    {Number(distance || gridDistance).toFixed(2)} m
                  </text>
                </g>
              );
            })}
          {xAxes.flatMap((_, x) =>
            yAxes.map((__, y) => {
              const point = gridPoint(x, y);
              return (
                <g
                  key={`intersection-${x}-${y}`}
                  data-grid-point
                  data-grid-x={x}
                  data-grid-y={y}
                  onPointerUp={event => {
                    event.stopPropagation();
                    if (event.currentTarget.hasPointerCapture(event.pointerId))
                      event.currentTarget.releasePointerCapture(
                        event.pointerId
                      );
                    beamTraceRef.current = false;
                    handlePointPlacement({ x, y });
                  }}
                  className="cursor-crosshair"
                >
                  <circle cx={point.x} cy={point.y} r="15" fill="transparent" />
                  <circle cx={point.x} cy={point.y} r="2.5" fill="#879da3" />
                </g>
              );
            })
          )}
          {activeLevel?.elements.map(item => {
            const supportColumnLabel = item.type === "Semelle"
              ? activeLevel.elements.find(candidate => candidate.type === "Poteau" && Math.abs(candidate.x - item.x) < 0.001 && Math.abs(candidate.y - item.y) < 0.001)?.id
              : item.id;
            const fixed = item.type === "Escaliers" ? item.absoluteStairGeometry : undefined;
            const fixedPoints = fixed ? [fixed.baseA, fixed.baseB, fixed.midA, fixed.midB, fixed.topA, fixed.topB, fixed.flight1?.lowerA, fixed.flight1?.lowerB, fixed.flight1?.upperA, fixed.flight1?.upperB, fixed.flight2?.lowerA, fixed.flight2?.lowerB, fixed.flight2?.upperA, fixed.flight2?.upperB].filter((point): point is GridPoint => Boolean(point)) : [];
            const start = fixed?.baseA ? metricGridPoint(fixed.baseA) : gridPoint(item.x, item.y);
            const end = fixed?.topB ? metricGridPoint(fixed.topB) : gridPoint(item.x2 ?? item.x, item.y2 ?? item.y);
            const rectangle = gridRectangle(
              { x: item.x, y: item.y },
              { x: item.x2 ?? item.x, y: item.y2 ?? item.y }
            );
            const fixedPixels = fixedPoints.map(metricGridPoint);
            const left = fixedPixels.length ? Math.min(...fixedPixels.map(point => point.x)) : gridPoint(rectangle.x, 0).x;
            const top = fixedPixels.length ? Math.min(...fixedPixels.map(point => point.y)) : gridPoint(0, rectangle.y).y;
            const width = fixedPixels.length ? Math.max(Math.max(...fixedPixels.map(point => point.x)) - left, 8) : Math.max(gridSpanX(rectangle.x, rectangle.x + rectangle.width), 8);
            const height = fixedPixels.length ? Math.max(Math.max(...fixedPixels.map(point => point.y)) - top, 8) : Math.max(gridSpanY(rectangle.y, rectangle.y + rectangle.height), 8);
            return (
              <g
                key={item.id}
                data-grid-element
                onPointerDown={event => {
                  event.stopPropagation();
                  if (
                    elementSelectionMode ||
                    canCoLocate(modelType) ||
                    modelType === "Poutre" ||
                    modelType === "Voile" ||
                    modelType === "Longrine de redressement" ||
                    (modelType === "Dalle" || modelType === "Escaliers")
                  )
                    return;
                  (
                    event.currentTarget.ownerSVGElement as SVGSVGElement
                  )?.setPointerCapture(event.pointerId);
                  dragSnapshot.current = selected;
                  setDraggedElement({
                    id: item.id,
                    start: { x: item.x, y: item.y },
                    x2: item.x2,
                    y2: item.y2,
                  });
                }}
                onPointerUp={event => {
                  event.stopPropagation();
                  if (!elementSelectionMode) {
                    const point = pointerToGrid(event);
                    if (point) handlePointPlacement(point);
                  }
                }}
                onClick={event => {
                  event.stopPropagation();
                  if (elementSelectionMode) openElementEditor(item);
                }}
                className="cursor-pointer"
              >
                {(item.type === "Poutre" || item.type === "Voile" || item.type === "Longrine de redressement") && (
                  <line
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    stroke={elementColor(item)}
                    strokeWidth={item.type === "Voile" ? 14 : item.type === "Longrine de redressement" ? 10 : 8}
                    opacity={item.type === "Voile" ? 0.52 : 1}
                    strokeLinecap="butt"
                  />
                )}
                {(item.type === "Dalle" || item.type === "Escaliers") && (
                  <>
                    <rect
                      x={left}
                      y={top}
                      width={width}
                      height={height}
                      fill="url(#floor-grid)"
                      stroke={elementColor(item)}
                      strokeWidth="2"
                      rx="1"
                    />
                    {item.type === "Escaliers" ? (
                      <>
                        <path d={`M ${left + width * 0.12} ${top + height * 0.78} H ${left + width * 0.56} V ${top + height * 0.18}`} fill="none" stroke={elementColor(item)} strokeWidth={Math.max(7, Math.min(width, height) * 0.14)} strokeLinecap="square" opacity=".6" />
                        {Array.from({ length: 7 }, (_, index) => <line key={`flight-x-${index}`} x1={left + width * (0.16 + index * 0.055)} y1={top + height * 0.78 - index * height * 0.012} x2={left + width * (0.16 + index * 0.055)} y2={top + height * 0.68 - index * height * 0.012} stroke={elementColor(item)} strokeWidth="1.2" />)}
                        {Array.from({ length: 7 }, (_, index) => <line key={`flight-y-${index}`} x1={left + width * 0.56 - index * width * 0.012} y1={top + height * (0.68 - index * 0.075)} x2={left + width * 0.46 - index * width * 0.012} y2={top + height * (0.68 - index * 0.075)} stroke={elementColor(item)} strokeWidth="1.2" />)}
                        <rect x={left + width * 0.40} y={top + height * 0.57} width={width * 0.32} height={height * 0.16} fill={elementColor(item)} opacity=".42" stroke={elementColor(item)} strokeWidth="1.5" />
                        <line x1={left + width * 0.25} y1={top + height * 0.82} x2={left + width * 0.40} y2={top + height * 0.65} stroke={elementColor(item)} strokeWidth="2" markerEnd="url(#floor-arrow)" />
                        <line x1={left + width * 0.72} y1={top + height * 0.57} x2={left + width * 0.56} y2={top + height * 0.37} stroke={elementColor(item)} strokeWidth="2" markerEnd="url(#floor-arrow)" />
                        <text x={left + width * 0.56} y={top + height * 0.66} textAnchor="middle" className="fill-[#e87538] text-[7px] font-bold">PALIER 2 × 1 m</text>
                      </>
                    ) : item.floorConfig?.type === "Dalle pleine" ? (
                      <>
                        <line x1={left + 8} y1={top + 8} x2={left + width - 8} y2={top + height - 8} stroke={elementColor(item)} strokeWidth="2.5" opacity=".9" />
                        <line x1={left + width - 8} y1={top + 8} x2={left + 8} y2={top + height - 8} stroke={elementColor(item)} strokeWidth="2.5" opacity=".9" />
                      </>
                    ) : (
                      <line
                        x1={left + 8}
                        y1={top + height / 2}
                        x2={left + width - 8}
                        y2={top + height / 2}
                        stroke={elementColor(item)}
                        strokeWidth="2"
                        markerEnd={"url(#floor-arrow)"}
                        transform={
                          item.floorConfig?.direction === "Y"
                            ? `rotate(90 ${left + width / 2} ${top + height / 2})`
                            : undefined
                        }
                      />
                    )}
                  </>
                )}
                {item.type === "Poteau" && (
                  <rect
                    x={start.x - 4.5}
                    y={start.y - 4.5}
                    width="9"
                    height="9"
                    fill={elementColor(item)}
                    rx="1"
                  />
                )}
                {item.type === "Semelle" && (() => {
                  const dimensions = dimensionsForItem(item);
                  const values = sectionNumbers(item);
                  const footingWidthMeters = sectionMeters(values[0] ?? 1, dimensions);
                  const footingDepthMeters = sectionMeters(values[1] ?? values[0] ?? 1, dimensions);
                  const xInterval = item.x < xAxes.length - 1 ? item.x : Math.max(item.x - 1, 0);
                  const yInterval = item.y < yAxes.length - 1 ? item.y : Math.max(item.y - 1, 0);
                  const xScale = gridSpanX(xInterval, Math.min(xInterval + 1, xAxes.length - 1)) / Math.max(axisDistance(xDistances, xInterval), 0.01);
                  const yScale = gridSpanY(yInterval, Math.min(yInterval + 1, yAxes.length - 1)) / Math.max(axisDistance(yDistances, yInterval), 0.01);
                  const footingWidthPixels = Math.max(10, footingWidthMeters * xScale);
                  const footingDepthPixels = Math.max(10, footingDepthMeters * yScale);
                  return <g>
                    <rect
                      x={start.x - footingWidthPixels / 2}
                      y={start.y - footingDepthPixels / 2}
                      width={footingWidthPixels}
                      height={footingDepthPixels}
                      fill="transparent"
                      stroke={elementColor(item)}
                      strokeWidth="3"
                      rx="1"
                    />
                    <line
                      x1={start.x - footingWidthPixels / 2}
                      y1={start.y - footingDepthPixels / 2}
                      x2={start.x + footingWidthPixels / 2}
                      y2={start.y + footingDepthPixels / 2}
                      stroke={elementColor(item)}
                      strokeWidth="1.5"
                      opacity=".8"
                    />
                    <line
                      x1={start.x + footingWidthPixels / 2}
                      y1={start.y - footingDepthPixels / 2}
                      x2={start.x - footingWidthPixels / 2}
                      y2={start.y + footingDepthPixels / 2}
                      stroke={elementColor(item)}
                      strokeWidth="1.5"
                      opacity=".8"
                    />
                  </g>;
                })()}
                {showLabels && (item.type === "Poutre" || item.type === "Voile" || item.type === "Longrine de redressement") && (
                  <text
                    x={(start.x + end.x) / 2}
                    y={(start.y + end.y) / 2 - 8}
                    textAnchor="middle"
                    className="fill-[#27358f] text-[9px] font-bold"
                    style={{
                      paintOrder: "stroke",
                      stroke: "#ffffff",
                      strokeWidth: 3,
                    }}
                  >
                    {item.id}
                  </text>
                )}
                {showLabels && (item.type === "Dalle" || item.type === "Escaliers") && (
                  <text
                    x={left + width / 2}
                    y={top + height / 2 + 3}
                    textAnchor="middle"
                    className="fill-[#087f7f] text-[9px] font-bold"
                    style={{
                      paintOrder: "stroke",
                      stroke: "#ffffff",
                      strokeWidth: 3,
                    }}
                  >
                    {item.id}
                  </text>
                )}
                {showLabels &&
                  item.type !== "Poutre" &&
                  item.type !== "Voile" &&
                  item.type !== "Longrine de redressement" &&
                  item.type !== "Dalle" && item.type !== "Escaliers" && (
                    <text
                      x={start.x + 8}
                      y={start.y - 8}
                      className="fill-[#27358f] text-[9px] font-bold"
                      style={{
                        paintOrder: "stroke",
                        stroke: "#ffffff",
                        strokeWidth: 3,
                      }}
                    >
                      {supportColumnLabel}
                    </text>
                  )}
              </g>
            );
          })}
          {placementStart && (
            <g pointerEvents="none">
              <circle
                cx={gridPoint(placementStart.x, placementStart.y).x}
                cy={gridPoint(placementStart.x, placementStart.y).y}
                r="11"
                fill="#fff"
                fillOpacity=".86"
                stroke="#e53935"
                strokeWidth="3"
                strokeDasharray="4 3"
              />
              <circle
                cx={gridPoint(placementStart.x, placementStart.y).x}
                cy={gridPoint(placementStart.x, placementStart.y).y}
                r="3.5"
                fill="#e53935"
              />
              {(modelType === "Poutre" || modelType === "Longrine de redressement") &&
                hoverPoint &&
                (hoverPoint.x !== placementStart.x ||
                  hoverPoint.y !== placementStart.y) && (
                  <line
                    x1={gridPoint(placementStart.x, placementStart.y).x}
                    y1={gridPoint(placementStart.x, placementStart.y).y}
                    x2={gridPoint(hoverPoint.x, hoverPoint.y).x}
                    y2={gridPoint(hoverPoint.x, hoverPoint.y).y}
                    stroke={
                      (modelType === "Longrine de redressement"
                        ? canPlaceTieBeamBetween(activeLevel?.elements ?? [], placementStart, hoverPoint)
                        : canPlaceBeamBetween(activeLevel?.elements ?? [], placementStart, hoverPoint))
                        ? "#e87538"
                        : "#e53935"
                    }
                    strokeWidth="9"
                    strokeLinecap="round"
                    strokeDasharray="10 6"
                    opacity=".75"
                  />
                )}
            </g>
          )}
          {floorPreview && modelType === "Dalle" && (
            <g pointerEvents="none" opacity="0.75">
              <rect
                x={gridPoint(floorPreview.x, floorPreview.y).x}
                y={
                  gridPoint(
                    floorPreview.y === floorPreview.y
                      ? floorPreview.y
                      : floorPreview.y,
                    floorPreview.y
                  ).y
                }
                width={gridSpanX(floorPreview.x, floorPreview.x2)}
                height={gridSpanY(floorPreview.y, floorPreview.y2)}
                fill="#72c9c5"
                stroke="#087f7f"
                strokeWidth="3"
                strokeDasharray="7 4"
              />
              {floorConfig.type === "Dalle pleine" ? (
                <>
                  <line x1={gridPoint(floorPreview.x, floorPreview.y).x + 8} y1={gridPoint(floorPreview.x, floorPreview.y).y + 8} x2={gridPoint(floorPreview.x2, floorPreview.y).x - 8} y2={gridPoint(floorPreview.x, floorPreview.y2).y - 8} stroke="#087f7f" strokeWidth="3" />
                  <line x1={gridPoint(floorPreview.x2, floorPreview.y).x - 8} y1={gridPoint(floorPreview.x, floorPreview.y).y + 8} x2={gridPoint(floorPreview.x, floorPreview.y).x + 8} y2={gridPoint(floorPreview.x, floorPreview.y2).y - 8} stroke="#087f7f" strokeWidth="3" />
                </>
              ) : (
                <line
                  x1={gridPoint(floorPreview.x, floorPreview.y).x + 14}
                  y1={gridPoint(floorPreview.x, floorPreview.y).y + gridSpanY(floorPreview.y, floorPreview.y2) / 2}
                  x2={gridPoint(floorPreview.x2, floorPreview.y).x - 14}
                  y2={gridPoint(floorPreview.x, floorPreview.y).y + gridSpanY(floorPreview.y, floorPreview.y2) / 2}
                  stroke="#087f7f"
                  strokeWidth="3"
                  markerStart="url(#floor-arrow)"
                  markerEnd="url(#floor-arrow)"
                  transform={floorPreview.direction === "Y" ? `rotate(90 ${gridPoint(floorPreview.x, floorPreview.y).x + gridSpanX(floorPreview.x, floorPreview.x2) / 2} ${gridPoint(floorPreview.x, floorPreview.y).y + gridSpanY(floorPreview.y, floorPreview.y2) / 2})` : undefined}
                />
              )}
              <text
                x={gridPoint(floorPreview.x, floorPreview.y).x + 8}
                y={gridPoint(floorPreview.x, floorPreview.y).y - 8}
                className="fill-[#087f7f] text-[9px] font-bold"
              >
                {floorConfig.type === "Dalle pleine" ? "Dalle pleine · deux sens" : `Dalle détectée · portée ${floorPreview.direction}`}
              </text>
            </g>
          )}
          {modelType === "Escaliers" && stairConstructionPoints.length > 0 && (
            <g pointerEvents="none">
              {([0, 3] as const).map((startIndex, flightIndex) => {
                const indices = flightIndex === 0 ? [0, 1, 3, 2] : [3, 4, 6, 5];
                const visible = indices.every(index => stairConstructionPoints[index]);
                if (!visible) return null;
                const colors = ["#e87538", "#27358f"] as const;
                const labels = ["Volée 1 · dalle inclinée 15 cm", "Volée 2 · dalle inclinée 15 cm"] as const;
                const coordinates = stairPreviewQuad(indices);
                return (
                  <g key={`stair-preview-${startIndex}`}>
                    <polygon points={coordinates} fill={colors[flightIndex]} fillOpacity=".16" stroke={colors[flightIndex]} strokeWidth="2.5" strokeDasharray="7 4" />
                    <text x={gridPoint(stairConstructionPoints[startIndex].x, stairConstructionPoints[startIndex].y).x + 6} y={gridPoint(stairConstructionPoints[startIndex].x, stairConstructionPoints[startIndex].y).y - 8} className="text-[8px] font-bold" fill={colors[flightIndex]}>{labels[flightIndex]}</text>
                  </g>
                );
              })}
              {stairConstructionPoints.map((point, index) => {
                const projected = gridPoint(point.x, point.y);
                const label = index < 2 ? `V1 · bas ${index + 1}` : index === 2 ? "V1 · haut 1" : index === 3 ? "P4 partagé · V1/V2" : index === 4 ? "V2 · coin opposé à 1 m" : `V2 · haut ${index - 4}`;
                return (
                  <g key={`stair-point-${index}`}>
                    <circle cx={projected.x} cy={projected.y} r="9" fill="#fff" stroke={index === 3 ? "#7c3aed" : index < 2 ? "#e53935" : index < 3 ? "#f59e0b" : "#27358f"} strokeWidth="2.5" />
                    <circle cx={projected.x} cy={projected.y} r="3" fill={index === 3 ? "#7c3aed" : index < 2 ? "#e53935" : index < 3 ? "#f59e0b" : "#27358f"} />
                    <text x={projected.x + 10} y={projected.y - 9} className="text-[8px] font-bold" fill="#42545b">{label}</text>
                  </g>
                );
              })}
            </g>
          )}
          {placementStart && hoverPoint && (modelType === "Poutre" || modelType === "Voile" || modelType === "Longrine de redressement") && (
            <circle
              cx={gridPoint(hoverPoint.x, hoverPoint.y).x}
              cy={gridPoint(hoverPoint.x, hoverPoint.y).y}
              r="11"
              fill="none"
              stroke={
                activeLevel?.elements.some(
                  item =>
                    item.type === "Poteau" &&
                    item.x === hoverPoint.x &&
                    item.y === hoverPoint.y
                )
                  ? "#16a36a"
                  : "#d65d4d"
              }
              strokeWidth="3"
            />
          )}
        </g>
      </svg>
      <div className="pointer-events-none absolute bottom-3 right-3 z-20 flex flex-col gap-1">
        <button
          type="button"
          className="pointer-events-auto grid h-8 w-8 place-items-center rounded-full bg-white text-lg font-semibold text-[#27358f] shadow-md"
          onClick={() => setGridZoom(value => Math.min(2.8, value + 0.15))}
          aria-label="Agrandir la grille"
        >
          +
        </button>
        <button
          type="button"
          className="pointer-events-auto grid h-8 w-8 place-items-center rounded-full bg-white text-lg font-semibold text-[#27358f] shadow-md"
          onClick={() => setGridZoom(value => Math.max(0.65, value - 0.15))}
          aria-label="Réduire la grille"
        >
          −
        </button>
      </div>
    </div>
  );

  const updateReinforcementTemplate = <K extends keyof ReinforcementTemplate>(key: K, value: ReinforcementTemplate[K]) => {
    setReinforcementTemplate(current => ({ ...current, [key]: value }));
  };

  const saveReinforcementTemplateSettings = () => {
    saveReinforcementTemplate(reinforcementTemplate);
    toast.success("Gabarit A4 de ferraillage enregistré.");
  };

  return (
    <div className="pb-4">
      <div className="mb-3 flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            onClick={() => setSelected(null)}
            className="grid h-8 w-8 place-items-center rounded-lg bg-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-bold">{selected.name}</h2>
            <p className="text-[10px] text-[#858585]">
              Bâtiment — Descente de charges
            </p>
            <p className={`max-w-[160px] truncate text-[9px] ${/échec|conflit/i.test(persistenceStatus) ? "text-[#b45309]" : "text-[#16805b]"}`} aria-live="polite">
              {persistenceStatus}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={() => void saveProject()}
            className="grid h-9 w-9 place-items-center rounded-lg bg-white"
            title="Enregistrer le projet"
            aria-label="Enregistrer le projet"
          >
            <Save className="h-4 w-4" />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowPersistenceMenu(value => !value)}
              className="grid h-9 w-9 place-items-center rounded-lg bg-white"
              title="Enregistrer un fichier ou importer un JSON"
              aria-label="Enregistrer un fichier ou importer un JSON"
              aria-expanded={showPersistenceMenu}
            >
              <Download className="h-4 w-4" />
            </button>
            {showPersistenceMenu && (
              <div className="absolute right-0 top-10 z-50 w-40 overflow-hidden rounded-lg border border-[#d9e4e5] bg-white p-1 shadow-lg">
                <button type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[10px] hover:bg-[#eef8f7]" onClick={() => { setShowPersistenceMenu(false); void exportCompleteProject(); }}>
                  <Download className="h-3.5 w-3.5 text-[#16805b]" />
                  <span>Enregistrer le fichier</span>
                </button>
                <label className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left text-[10px] hover:bg-[#eef8f7]">
                  <Upload className="h-3.5 w-3.5 text-[#27358f]" />
                  <span>Importer un fichier JSON</span>
                  <input ref={projectImportInput} className="hidden" type="file" accept="application/json,.json" onChange={event => { setShowPersistenceMenu(false); void importCompleteProject(event); }} aria-label="Fichier JSON de projet GcBtp à importer" />
                </label>
              </div>
            )}
          </div>
          <button
            onClick={() => setThreeD(!threeD)}
            className="grid h-9 w-9 place-items-center rounded-lg bg-[#dff5f4] text-[#049b9b]"
            title="Basculer la vue 2D/3D"
            aria-label="Basculer la vue 2D/3D"
          >
            <Rotate3D className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="grid h-9 w-9 place-items-center rounded-lg bg-white"
            title="Autres actions"
            aria-label="Autres actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>
      {conflictProjectId === selected.id && (
        <div role="alert" className="mb-3 rounded-xl border border-[#f3c47a] bg-[#fff8e8] p-3 text-[11px] text-[#704b10]">
          <p className="font-semibold">Une version plus récente de ce projet existe sur cet appareil.</p>
          <p className="mt-1">L’autosauvegarde est suspendue pour éviter d’écraser le travail de l’autre onglet.</p>
          <Button type="button" variant="outline" className="mt-2 min-h-10 border-[#d79b3e] bg-white text-[#704b10]" onClick={() => void reloadLatestProjectVersion()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Recharger la version enregistrée
          </Button>
        </div>
      )}
      <div className="relative mb-3 flex gap-2">
        {selected.levels.map(level => (
          <button
            key={level.id}
            onClick={() => setActiveLevelId(level.id)}
            className={
              activeLevel?.id === level.id
                ? "rounded-lg bg-[#27358f] px-3 py-2 text-[11px] font-bold text-white"
                : "rounded-lg bg-white px-3 py-2 text-[11px] font-bold text-[#555]"
            }
          >
            {level.label}
          </button>
        ))}
        <button
          onClick={addLevel}
          className="rounded-lg bg-[#eee8ff] px-3 py-2 text-[11px] font-bold text-[#6247a8]"
        >
          + Ajouter un niveau
        </button>
        {showMenu && (
          <div className="absolute right-0 top-11 z-30 w-[235px] rounded-xl bg-white p-2 shadow-xl">
            {menuItems.map(item => (
              <button
                key={item}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-[11px] hover:bg-[#f5f8f9]"
                onClick={() => {
                  if (item === "Historique des versions") {
                    setShowMenu(false);
                    void openProjectHistory();
                    return;
                  }
                  if (item === "Dupliquer ce niveau vers…" && activeLevel) {
                    setDuplicateIds(
                      activeLevel.elements.map(element => element.id)
                    );
                    setDuplicateTargetLevelIds([]);
                  }
                  setPanel(item);
                  setShowMenu(false);
                }}
              >
                {item === "Grille de trame" ? (
                  <Grid3X3 className="h-4 w-4" />
                ) : item === "Éléments du niveau" ? (
                  <Table2 className="h-4 w-4" />
                ) : item === "Calculer la descente" ? (
                  <Calculator className="h-4 w-4" />
                ) : item === "Paramètres" ? (
                  <Settings2 className="h-4 w-4" />
                ) : item === "Historique des versions" ? (
                  <History className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {item}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="mb-3 flex items-center justify-between">
        <Badge className="bg-[#eaf5ed] text-[#29734a] hover:bg-[#eaf5ed]">
          {activeLevel?.elements.length ?? 0} éléments
        </Badge>
        <span className="text-[10px] text-[#879298]">
          Cliquez sur la grille pour placer · cliquez sur un élément pour
          supprimer
        </span>
      </div>
      {buildingCalculation && (
        <div className="mb-2 rounded-lg border border-[#dce7eb] bg-white px-2 py-1.5 text-[10px]">
          <div className="mb-1 flex items-center justify-between font-semibold text-[#45616b]"><span>Échelle Nu — poteaux et semelles</span><span>{loadScale.minimum.toFixed(1)} à {loadScale.maximum.toFixed(1)} kN</span></div>
          <div className="h-2 rounded-full" style={{ background: "linear-gradient(90deg, #ffecb4 0%, #ff9a45 50%, #ff1717 100%)" }} aria-label="Échelle progressive des charges" />
          <div className="mt-0.5 flex justify-between text-[9px] text-[#74858c]"><span>faible</span><span>intermédiaire</span><span>maximale</span></div>
          {threeD && <div className="mt-1.5 flex gap-2 overflow-x-auto">
            <button type="button" onClick={() => setShowAnalysisValues(value => !value)} className={`whitespace-nowrap rounded-md px-2 py-1 ${showAnalysisValues ? "bg-[#049b9b] text-white" : "bg-[#eef5f6] text-[#45616b]"}`}>Valeurs G/Q/Nu/Nser</button>
            <button type="button" onClick={() => setShowAnalysisMoments(value => !value)} className={`whitespace-nowrap rounded-md px-2 py-1 ${showAnalysisMoments ? "bg-[#27358f] text-white" : "bg-[#eef0f8] text-[#45616b]"}`}>Moments M</button>
            <button type="button" onClick={() => setShowLoadValues(value => !value)} className={`whitespace-nowrap rounded-md px-2 py-1 ${showLoadValues ? "bg-[#ff1717] text-white" : "bg-[#fff0f0] text-[#9a2f2f]"}`}>Charges 3D</button>
          </div>}
        </div>
      )}
      {threeD ? actualThreeDView : grid}
      <div className="mt-3 grid grid-cols-[44px_44px_1fr] items-center gap-2">
        <Button
          variant="outline"
          disabled={movementHistory.past.length === 0}
          className={`h-10 ${movementHistory.past.length ? "border-[#f0b08a] text-[#e87538]" : "border-[#d7dde0] text-[#aab3b7]"}`}
          onClick={undoMovement}
          aria-label="Revenir à l’action précédente"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Button
          variant="outline"
          disabled={movementHistory.future.length === 0}
          className={`h-10 ${movementHistory.future.length ? "border-[#f0b08a] text-[#e87538]" : "border-[#d7dde0] text-[#aab3b7]"}`}
          onClick={redoMovement}
          aria-label="Rétablir l’action suivante"
        >
          <ArrowRight className="h-5 w-5" />
        </Button>
        <Button
          className="h-10 bg-[#27358f] text-white hover:bg-[#1f2b78]"
          onClick={openCalculationPreflight}
        >
          Lancer les calculs
        </Button>
      </div>
      <div className="mt-3 rounded-lg border border-[#e2e8eb] bg-white px-2.5 py-2">
        <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold text-[#59666b]">
          <span
            className="h-3 w-3 rounded-sm"
            style={{ backgroundColor: colorForModel(modelType, modelSection) }}
          />
          Modèle actif : <b className="text-[#27358f]">{modelSection}</b>
          <span className="text-[#8b9498]">
            ({colorForModel(modelType, modelSection)})
          </span>
        </div>
        <div className="grid grid-cols-[.8fr_1.2fr] gap-2">
          <select
            className="h-9 rounded-lg border border-[#e2e8eb] bg-white px-2 text-[10px]"
            value={modelType}
            onChange={event => {
              const type = event.target.value;
              const nextSection = optionsForType(type)[0] ?? "";
              setModelType(type);
              setModelSection(nextSection);
              setElementSelectionMode(false);
              if (type === "Dalle")
                setFloorConfig(floorConfigForSection(nextSection));
              setPlacementStart(null);
              setHoverPoint(null);
              setStairLandingPoint(null);
              setStairConstructionPoints([]);
              setStairPointLevels([]);
              setStairPlacementStage(1);
            }}
          >
            {modelTypes.map(type => (
              <option key={type}>{type}</option>
            ))}
          </select>
          <select
            className="h-9 rounded-lg border border-[#e2e8eb] bg-white px-2 text-[10px]"
            value={modelSection}
            onChange={event => {
              const nextSection = event.target.value;
              setModelSection(nextSection);
              setElementSelectionMode(false);
              if (modelType === "Dalle")
                setFloorConfig(floorConfigForSection(nextSection));
              setPlacementStart(null);
              setHoverPoint(null);
              setStairLandingPoint(null);
              setStairConstructionPoints([]);
              setStairPointLevels([]);
              setStairPlacementStage(1);
            }}
          >
            {optionsForType(modelType).map(section => (
              <option key={section}>{section}</option>
            ))}
          </select>
        </div>
        <Button
          variant="outline"
          className={`mt-2 w-full ${elementSelectionMode ? "border-[#e87538] bg-[#fff4ed] text-[#c85f2b]" : "border-[#dfe7ea] text-[#52656b]"}`}
          onClick={() => {
            setElementSelectionMode(mode => !mode);
            setPlacementStart(null);
            setHoverPoint(null);
            setFloorPreview(null);
            setStairLandingPoint(null);
            setStairConstructionPoints([]);
            setStairPointLevels([]);
            setStairPlacementStage(1);
          }}
        >
          <Table2 className="mr-2 h-4 w-4" />
          {elementSelectionMode
            ? "Quitter la sélection"
            : "Sélectionner un élément existant"}
        </Button>
      </div>
      <details className="mt-2 rounded-lg border border-[#dce7eb] bg-white p-2 text-[10px] text-[#52656b]">
        <summary className="cursor-pointer font-semibold text-[#27358f]">Catalogue structural · {structuralCatalog.length} modèles</summary>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {structuralCatalog.map(model => (
            <button
              key={`${model.type}:${model.name}`}
              type="button"
              className="flex items-center gap-2 rounded border border-[#edf1f1] p-2 text-left hover:bg-[#f7fbfb]"
              onClick={() => {
                setModelType(model.type);
                setModelSection(model.name);
                if (model.type === "Dalle") setFloorConfig(floorConfigForSection(model.name));
              }}
            >
              <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: model.color }} />
              <span><b>{model.name}</b><span className="ml-1 text-[#89969c]">· {model.family} · {model.dimensions}</span></span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[9px] text-[#7a898e]">Les sections sont utilisées par le modèle analytique pour déduire les dimensions, aires et inerties. Les propriétés de matériau restent à confirmer selon le béton et la norme du projet.</p>
      </details>
      {modelType === "Dalle" && (
        <Button
          variant="outline"
          className="mt-2 w-full border-[#049b9b] text-[#087f7f]"
          onClick={() => setPanel("Configuration du plancher")}
        >
          Configurer le plancher · {floorConfig.type} · {floorConfig.thickness}
        </Button>
      )}
      {modelType === "Escaliers" && (
        <div className="mt-2 rounded-lg border border-[#e87538]/40 bg-[#fff7f1] px-3 py-2 text-[10px] text-[#9a4318]">
          Escaliers configurés comme une <b>dalle pleine BA de 15 cm</b> · poids propre 3,75 kN/m² · pose par deux volées de quatre points.
        </div>
      )}
      {panel && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 px-3 pb-20">
          <div className="max-h-[82vh] w-full max-w-[430px] overflow-y-auto rounded-t-[22px] bg-[#f7f9fa] p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[17px] font-bold">{panel}</h3>
              <button
                onClick={() => {
                  if (panel === "Éditer l’élément") setElementSelectionMode(false);
                  setPanel(null);
                }}
                className="grid h-8 w-8 place-items-center rounded-full bg-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {panel === "Configuration du plancher" && (
              <FloorConfigPanel
                value={floorConfig}
                onChange={setFloorConfig}
                onClose={() => {
                  setPanel(null);
                  toast.success("Configuration du plancher enregistrée");
                }}
              />
            )}
            {panel === "Grille de trame" && (
              <GridAxisPanel
                xAxes={xAxes}
                yAxes={yAxes}
                zLevels={selected.levels.map(level => ({
                  id: level.id,
                  label: level.label,
                  elevation: level.elevation,
                  height: level.height,
                  elementsCount: level.elements.length,
                }))}
                gridDistance={gridDistance}
                xDistances={xDistances}
                yDistances={yDistances}
                xNumbering={xNumbering}
                yNumbering={yNumbering}
                onXNumberingChange={value => {
                  setXNumbering(value);
                  setXAxes(
                    xAxes.map((_, index) =>
                      value === "numeric"
                        ? String(index + 1)
                        : String.fromCharCode(65 + index)
                    )
                  );
                }}
                onYNumberingChange={value => {
                  setYNumbering(value);
                  setYAxes(
                    yAxes.map((_, index) =>
                      value === "numeric"
                        ? String(index + 1)
                        : String.fromCharCode(65 + index)
                    )
                  );
                }}
                onXAxesChange={nextLabels => remapAxisChange("x", nextLabels)}
                onYAxesChange={nextLabels => remapAxisChange("y", nextLabels)}
                onInsertAxis={insertAxis}
                onRemoveAxis={removeAxis}
                onChangeAxisDistance={changeAxisDistance}
                onXDistancesChange={setXDistances}
                onYDistancesChange={setYDistances}
                onEditLevel={(id, patch) =>
                  updateSelected({
                    levels: selected.levels.map(level =>
                      level.id === id ? { ...level, ...patch } : level
                    ),
                  })
                }
                onDeleteLevel={id => {
                  if (id === "foundation" || id === "rdc")
                    return toast.info("Les niveaux Fondation et RDC ne peuvent pas être supprimés");
                  if (selected.levels.length <= 2)
                    return toast.info("Les niveaux de base ne peuvent pas être supprimés");
                  updateSelected({
                    levels: selected.levels.filter(level => level.id !== id),
                  });
                  setActiveLevelId(
                    activeLevelId === id ? "rdc" : activeLevelId
                  );
                }}
                onAddLevel={addLevel}
                onAddBasement={addBasement}
              />
            )}
            {false && panel === "Grille de trame" && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1">
                    Axe X
                  </Button>
                  <Button variant="outline" className="flex-1">
                    Axe Y
                  </Button>
                  <Button variant="outline" className="flex-1">
                    Axe Z
                  </Button>
                </div>
                <Card>
                  <CardContent className="space-y-3 p-3">
                    <Label>Distance entre lignes (m)</Label>
                    <Input
                      value={gridDistance}
                      onChange={event => setGridDistance(event.target.value)}
                    />
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex items-center gap-2 rounded bg-white p-2 text-[10px]">
                          <input
                            type="checkbox"
                            checked={snapToGrid}
                            onChange={event =>
                              setSnapToGrid(event.target.checked)
                            }
                          />
                          Aimantation
                        </label>
                        <label className="flex items-center gap-2 rounded bg-white p-2 text-[10px]">
                          <input
                            type="checkbox"
                            checked={showLabels}
                            onChange={event =>
                              setShowLabels(event.target.checked)
                            }
                          />
                          Afficher les noms
                        </label>
                      </div>
                      <Label>Opacité de la grille (%)</Label>
                      <Input
                        type="number"
                        min="10"
                        max="100"
                        value={gridOpacity}
                        onChange={event => setGridOpacity(event.target.value)}
                      />
                      <div className="text-[11px] font-semibold">Axe X</div>
                      {xAxes.map((axis, index) => (
                        <div key={`x-${index}`} className="flex gap-2">
                          <Input
                            value={axis}
                            onChange={event =>
                              setXAxes(prev =>
                                prev.map((item, i) =>
                                  i === index ? event.target.value : item
                                )
                              )
                            }
                          />
                          <Button
                            variant="outline"
                            onClick={() =>
                              remapAxisChange("x", xAxes.filter((_, i) => i !== index))
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <div className="text-[11px] font-semibold">Axe Y</div>
                      {yAxes.map((axis, index) => (
                        <div key={`y-${index}`} className="flex gap-2">
                          <Input
                            value={axis}
                            onChange={event =>
                              setYAxes(prev =>
                                prev.map((item, i) =>
                                  i === index ? event.target.value : item
                                )
                              )
                            }
                          />
                          <Button
                            variant="outline"
                            onClick={() =>
                              remapAxisChange("y", yAxes.filter((_, i) => i !== index))
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <div className="text-[11px] font-semibold">
                        Axe Z — niveaux
                      </div>
                      {zLevels.map((level, index) => (
                        <div key={`z-${index}`} className="flex gap-2">
                          <Input
                            value={level}
                            onChange={event =>
                              setZLevels(prev =>
                                prev.map((item, i) =>
                                  i === index ? event.target.value : item
                                )
                              )
                            }
                          />
                          <Button
                            variant="outline"
                            onClick={() =>
                              setZLevels(prev =>
                                prev.filter((_, i) => i !== index)
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => addAxis("x")}>
                        <Plus className="mr-1 h-4 w-4" />
                        Ajouter X
                      </Button>
                      <Button variant="outline" onClick={() => addAxis("y")}>
                        <Plus className="mr-1 h-4 w-4" />
                        Ajouter Y
                      </Button>
                      <Button variant="outline" onClick={() => addAxis("z")}>
                        <Plus className="mr-1 h-4 w-4" />
                        Ajouter Z
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
            {panel === "Mes modèles" && (
              <ModelCatalogPanel
                selectedType={modelType}
                selectedName={modelSection}
                customModels={customModels}
                onModelsChange={setCustomModels}
                onSelect={model => {
                  setModelType(model.type);
                  setModelSection(model.name);
                  setElementSelectionMode(false);
                  if (model.type === "Dalle")
                    setFloorConfig(floorConfigForSection(model.name));
                  setPanel(null);
                  toast.success(`${model.name} sélectionné`);
                }}
              />
            )}
            {panel === "Éditer l’élément" && (
              <Card>
                <CardContent className="space-y-3 p-3">
                  <div>
                    <Label>Type</Label>
                    <select
                      className="h-10 w-full rounded border bg-white px-2 text-[11px]"
                      value={editType}
                      onChange={event => {
                        setEditType(event.target.value);
                        setEditSection(
                          optionsForType(event.target.value)[0] ?? ""
                        );
                      }}
                    >
                      {modelTypes.map(type => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Section ou plancher</Label>
                    <select
                      className="h-10 w-full rounded border bg-white px-2 text-[11px]"
                      value={editSection}
                      onChange={event => setEditSection(event.target.value)}
                    >
                      {optionsForType(editType).map(section => (
                        <option key={section}>{section}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Couleur de l’élément</Label>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {MODEL_COLOR_PALETTE.map(color => (
                        <button
                          type="button"
                          key={color}
                          aria-label={`Choisir ${color}`}
                          onClick={() => setEditColor(color)}
                          className={`h-7 w-7 rounded-full border-2 ${editColor.toLowerCase() === color ? "border-[#202025] ring-2 ring-[#d9c7ff]" : "border-white"}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <Input
                      value={editColor}
                      onChange={event => setEditColor(event.target.value)}
                      className="mt-2 h-9 text-[11px]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Position X</Label>
                      <Input
                        value={editX}
                        onChange={event => setEditX(event.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Position Y</Label>
                      <Input
                        value={editY}
                        onChange={event => setEditY(event.target.value)}
                      />
                    </div>
                  </div>
                  {editType === "Dalle" && (
                    <div className="space-y-1 rounded-lg border border-[#d7e2ec] bg-[#f6f9fc] p-2">
                      <Label>Trémies rectangulaires (m)</Label>
                      <textarea
                        aria-label="Trémies rectangulaires en mètres"
                        value={editSurfaceOpenings}
                        onChange={event => setEditSurfaceOpenings(event.target.value)}
                        placeholder="x1;y1;x2;y2 — une ouverture par ligne"
                        className="min-h-16 w-full rounded border bg-white p-2 text-[10px]"
                      />
                      <p className="text-[9px] text-[#68767d]">Coordonnées locales depuis le coin inférieur gauche de la dalle, en mètres; laisser vide si aucune trémie. Exemple : 1;1;2;2.</p>
                    </div>
                  )}
                  <div>
                    <Label>Niveau cible</Label>
                    <select
                      className="h-10 w-full rounded border bg-white px-2 text-[11px]"
                      value={targetLevelId}
                      onChange={event => setTargetLevelId(event.target.value)}
                    >
                      {selected.levels.map(level => (
                        <option key={level.id} value={level.id}>
                          {level.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-[#27358f] text-white"
                      onClick={saveElementEdit}
                    >
                      Enregistrer
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() =>
                        editingElement && deleteElement(editingElement.id)
                      }
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Supprimer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            {panel === "Éléments du niveau" && (
              <Card>
                <CardContent className="space-y-2 p-3">
                  <div className="rounded-lg bg-[#e7f7f6] p-3 text-[10px] text-[#166b6b]">
                    <b>Charges du niveau</b>
                    <br />
                    {activeLevel?.elements
                      .reduce(
                        (sum, item) =>
                          sum +
                          elementLoadSummary(item, gridDistance, floorConfig)
                            .design,
                        0
                      )
                      .toFixed(2)}{" "}
                    kN ELU · {activeLevel?.elements.length ?? 0} éléments
                  </div>
                  {activeLevel?.elements.length ? (
                    activeLevel.elements.map(item => (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between rounded-lg bg-white p-3 text-[11px] ${editingElement?.id === item.id ? "ring-2 ring-[#e87538]" : ""}`}
                      >
                        <button
                          className="min-w-0 flex-1 text-left"
                          onClick={() => openElementEditor(item)}
                        >
                          <b>{item.id}</b> · {item.type}
                          <br />
                          <span className="text-[#7b878b]">{item.section}</span>
                          {item.type === "Dalle" && item.floorConfig && (
                            <>
                              <br />
                              <span className="text-[#087f7f]">
                                {item.floorConfig.type} ·{" "}
                                {item.floorConfig.thickness} · portée{" "}
                                {item.floorConfig.span} m
                              </span>
                            </>
                          )}
                          {(() => {
                            const load = elementLoadSummary(
                              item,
                              gridDistance,
                              floorConfig
                            );
                            return (
                              <>
                                <br />
                                <span className="text-[#8a5a21]">
                                  {load.label} · Gk {load.gk.toFixed(1)} · Qk{" "}
                                  {load.qk.toFixed(1)} · ELU{" "}
                                  {load.design.toFixed(1)} kN
                                </span>
                              </>
                            );
                          })()}
                        </button>
                        <button
                          aria-label={`Supprimer ${item.id}`}
                          onClick={() => deleteElement(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-[#d65d4d]" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-[12px] text-[#7b878b]">
                      Aucun élément sur ce niveau.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
            {panel === "Dupliquer ce niveau vers…" && (
              <Card>
                <CardContent className="space-y-3 p-3">
                  <p className="text-[11px] text-[#68767d]">
                    Cochez les éléments source puis un ou plusieurs niveaux cibles. Les copies reçoivent une nomenclature globale unique.
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Niveaux cibles</Label>
                      <span className="text-[10px] font-semibold text-[#27358f]">{duplicateTargetLevelIds.length} sélectionné(s)</span>
                    </div>
                    <div className="space-y-1.5 rounded-lg border border-[#dfe6ea] bg-[#f8fafb] p-2">
                      {selected.levels.filter(level => level.id !== activeLevel?.id).map(level => {
                        const checked = duplicateTargetLevelIds.includes(level.id);
                        return (
                          <label key={level.id} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-[11px] transition-colors ${checked ? "border-[#27358f] bg-[#eef0ff] text-[#27358f]" : "border-transparent bg-white text-[#59676d]"}`}>
                            <input
                              type="checkbox"
                              aria-label={`Dupliquer vers ${level.label}`}
                              checked={checked}
                              onChange={event => setDuplicateTargetLevelIds(current => event.target.checked ? Array.from(new Set([...current, level.id])) : current.filter(id => id !== level.id))}
                              className="h-4 w-4 accent-[#27358f]"
                            />
                            <span className="flex-1 font-semibold">{level.label}</span>
                            <span className="text-[10px] text-[#87939a]">{level.elements.length} élément(s)</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Éléments à copier</Label>
                    <span className="text-[10px] font-semibold text-[#27358f]">{duplicateIds.length} sélectionné(s)</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 rounded-lg border border-[#dfe6ea] bg-[#f8fafb] p-2">
                    {["Semelle", "Semelle excentrée", "Longrine de redressement", "Voile", "Poteau", "Poutre", "Dalle", "Escaliers"].map(type => {
                      const count = activeLevel?.elements.filter(item => item.type === type).length ?? 0;
                      if (!count) return null;
                      const groupIds = activeLevel?.elements.filter(item => item.type === type).map(item => item.id) ?? [];
                      const allSelected = groupIds.length > 0 && groupIds.every(id => duplicateIds.includes(id));
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => toggleDuplicateGroup(type)}
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors ${allSelected ? "border-[#e87538] bg-[#fff0e5] text-[#b95620]" : "border-[#cfdbe0] bg-white text-[#59676d]"}`}
                        >
                          {allSelected ? "✓ " : "＋ "}{type} ({count})
                        </button>
                      );
                    })}
                  </div>
                  <div className="space-y-1.5">
                    {activeLevel?.elements.map(item => {
                      const checked = duplicateIds.includes(item.id);
                      return (
                        <label key={item.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-[11px] transition-colors ${checked ? "border-[#e87538] bg-[#fff5ed]" : "border-transparent bg-white"}`}>
                          <input
                            type="checkbox"
                            aria-label={`Sélectionner ${item.id}`}
                            checked={checked}
                            onChange={event => setDuplicateIds(current => event.target.checked ? Array.from(new Set([...current, item.id])) : current.filter(id => id !== item.id))}
                            className="h-4 w-4 accent-[#e87538]"
                          />
                          <span className="flex-1">{item.id} · {item.type} · {item.section}</span>
                        </label>
                      );
                    })}
                  </div>
                  <Button
                    className="w-full bg-[#27358f] text-white"
                    onClick={duplicateElements}
                  >
                    Dupliquer vers les niveaux sélectionnés
                  </Button>
                </CardContent>
              </Card>
            )}
            {panel === "Paramètres" && (
              <Card>
                <CardContent className="space-y-3 p-3">
                  <div>
                    <Label>Pays</Label>
                    <select
                      className="mt-1 h-10 w-full rounded border bg-white px-2 text-[11px]"
                      value={country}
                      onChange={event => {
                        const nextCountry = event.target.value;
                        const nextCity =
                          getCitiesForCountry(nextCountry)[0]?.city ?? "";
                        const nextProfile = getRegulatorySiteProfile(
                          nextCountry,
                          nextCity
                        );
                        setCountry(nextCountry);
                        setCity(nextCity);
                        setNorm(nextProfile.preferredNorm);
                        updateSelected({
                          country: nextCountry,
                          city: nextCity,
                          norm: nextProfile.preferredNorm,
                        });
                        toast.success(
                          `Profil ${nextCountry} activé automatiquement`
                        );
                      }}
                    >
                      {DSRCAD_COUNTRIES.map(item => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Ville principale</Label>
                    <select
                      className="mt-1 h-10 w-full rounded border bg-white px-2 text-[11px]"
                      value={city}
                      onChange={event => {
                        const nextCity = event.target.value;
                        setCity(nextCity);
                        updateSelected({ city: nextCity });
                      }}
                    >
                      <option value="">Sélectionner une ville</option>
                      {getCitiesForCountry(country).map(item => (
                        <option key={item.city} value={item.city}>
                          {item.city}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Emplacement</Label>
                    <Input
                      value={location}
                      onChange={event => {
                        setLocation(event.target.value);
                        updateSelected({ location: event.target.value });
                      }}
                      placeholder="Quartier, parcelle ou adresse"
                    />
                  </div>
                  <div>
                    <Label>Nature de la structure</Label>
                    <select
                      className="h-10 w-full rounded border bg-white px-2 text-[11px]"
                      value={structure}
                      onChange={event => {
                        setStructure(event.target.value);
                        updateSelected({ structure: event.target.value });
                      }}
                    >
                      <option>Béton armé</option>
                      <option>Acier</option>
                      <option>Maçonnerie porteuse</option>
                      <option>Mixte</option>
                    </select>
                  </div>
                  <div>
                    <Label>Norme</Label>
                    <select
                      className="h-10 w-full rounded border bg-white px-2 text-[11px]"
                      value={norm}
                      onChange={event => {
                        setNorm(event.target.value);
                        updateSelected({ norm: event.target.value });
                      }}
                    >
                      {DSRCAD_NORMS.map(item => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Tolérance de fusion analytique (m)</Label>
                    <Input
                      className="mt-1 h-10 text-[11px]"
                      type="number"
                      min="0.001"
                      max="0.25"
                      step="0.001"
                      value={analyticalTolerance}
                      onChange={event => setAnalyticalTolerance(event.target.value)}
                    />
                    <p className="mt-1 text-[9px] text-[#77888d]">Distance 3D maximale pour fusionner deux nœuds graphiques ; valeur par défaut : 0,01 m.</p>
                  </div>
                  <div className="rounded-lg border border-[#bfe4e2] bg-[#eaf8f7] p-3 text-[10px] text-[#245e60]">
                    <b>
                      Profil automatique activé : {regulatoryProfile.country}
                    </b>
                    <br />
                    Norme proposée : {regulatoryProfile.preferredNorm}
                    <br />
                    {regulatoryProfile.constructionContext}
                    <br />
                    <span className="text-[#8a5a21]">
                      Zone climatique : {regulatoryProfile.climate.climateZone}
                      <br />
                      Vent : {regulatoryProfile.wind.status} · Exposition :{" "}
                      {regulatoryProfile.climate.windExposure}
                      <br />
                      Pluie : {regulatoryProfile.climate.rainfallExposure} ·
                      Neige : {regulatoryProfile.snow.status} · Séisme :{" "}
                      {regulatoryProfile.seismic.status}
                    </span>
                    <br />
                    <span className="opacity-80">
                      {regulatoryProfile.climate.note}
                      <br />
                      {regulatoryProfile.rule.note}
                    </span>
                  </div>
                  {constructionCodeCompliance.applicable && (
                    <div className="rounded-lg border border-[#e7d2a8] bg-[#fffaf0] p-3 text-[10px] text-[#6f5627]">
                      <b>Code de la Construction — Sénégal 2023-21 / décret 2024-1495</b>
                      <div className="mt-1 space-y-1">
                        {constructionCodeCompliance.checks.map(check => (
                          <div key={check.id}><b>{check.status.toUpperCase()}</b> · {check.label} — {check.message}</div>
                        ))}
                      </div>
                      <div className="mt-2 text-[9px]">Les contrôles administratifs et techniques doivent être documentés dans le dossier du projet avant conclusion réglementaire.</div>
                    </div>
                  )}
                  <div className="rounded-lg border border-[#c8d9e0] bg-[#f7fbfd] p-3">
                    <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#173b4c]">Gabarit A4 — ferraillage type Robot Analysis</div>
                    <p className="mb-3 text-[9px] text-[#6d7c83]">Ces informations alimentent automatiquement le cartouche de chaque fiche A4/PDF de ferraillage et restent enregistrées dans les paramètres de l’application.</p>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        ["companyName", "Nom / entreprise"], ["officeReference", "Référence bureau d’études"],
                        ["companyAddress", "Adresse"], ["companyPhone", "Téléphone"],
                        ["companyEmail", "Email"], ["companyWebsite", "Site web"],
                        ["engineerName", "Ingénieur / responsable"], ["drafterName", "Dessinateur / projeteur"],
                        ["clientName", "Client / maître d’ouvrage"],
                        ["projectName", "Nom du projet"], ["projectReference", "Référence projet"],
                        ["projectAddress", "Adresse du projet"], ["drawingPrefix", "Préfixe des plans"],
                        ["logoText", "Texte logo / cartouche"], ["scaleLabel", "Mention d’échelle"],
                      ] as Array<[keyof ReinforcementTemplate, string]>).map(([key, label]) => (
                        <label key={key} className={key === "companyAddress" || key === "projectAddress" ? "col-span-2" : ""}>
                          <span className="text-[9px] font-semibold">{label}</span>
                          <Input className="mt-1 h-8 bg-white text-[10px]" value={reinforcementTemplate[key] as string} onChange={event => updateReinforcementTemplate(key, event.target.value as ReinforcementTemplate[typeof key])} />
                        </label>
                      ))}
                    </div>
                    <label className="mt-2 block"><span className="text-[9px] font-semibold">Note de bas de page</span><textarea className="mt-1 min-h-14 w-full rounded border bg-white p-2 text-[10px]" value={reinforcementTemplate.footerNote} onChange={event => updateReinforcementTemplate("footerNote", event.target.value)} /></label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label><span className="text-[9px] font-semibold">Format</span><select className="mt-1 h-8 w-full rounded border bg-white px-2 text-[10px]" value={reinforcementTemplate.paperFormat} onChange={event => updateReinforcementTemplate("paperFormat", event.target.value as "A4")}><option value="A4">A4</option></select></label>
                      <label><span className="text-[9px] font-semibold">Orientation</span><select className="mt-1 h-8 w-full rounded border bg-white px-2 text-[10px]" value={reinforcementTemplate.orientation} onChange={event => updateReinforcementTemplate("orientation", event.target.value as ReinforcementTemplate["orientation"])}><option value="landscape">Paysage — plan technique</option><option value="portrait">Portrait</option></select></label>
                    </div>
                    <Button type="button" className="mt-3 w-full bg-[#102f45] text-white" onClick={saveReinforcementTemplateSettings}>Enregistrer le gabarit A4 de ferraillage</Button>
                  </div>
                  <div className="rounded-lg border border-[#dfe8e8] bg-[#f8fbfb] p-3">
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#087f7f]">
                      Charges du projet · kN/m²
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Revêtements + chape</Label>
                        <Input
                          inputMode="decimal"
                          value={floorConfig.finishLoad ?? "1.00"}
                          onChange={event =>
                            setFloorConfig(current => ({
                              ...current,
                              finishLoad: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label>Plafonds + réseaux</Label>
                        <Input
                          inputMode="decimal"
                          value={floorConfig.ceilingLoad ?? "0.30"}
                          onChange={event =>
                            setFloorConfig(current => ({
                              ...current,
                              ceilingLoad: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label>Cloisons réparties</Label>
                        <Input
                          inputMode="decimal"
                          value={floorConfig.partitionLoad ?? "1.00"}
                          onChange={event =>
                            setFloorConfig(current => ({
                              ...current,
                              partitionLoad: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label>Équipements fixes</Label>
                        <Input
                          inputMode="decimal"
                          value={floorConfig.equipmentLoad ?? "0.50"}
                          onChange={event =>
                            setFloorConfig(current => ({
                              ...current,
                              equipmentLoad: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label>Exploitation</Label>
                        <Input
                          inputMode="decimal"
                          value={floorConfig.imposedLoad ?? "2.00"}
                          onChange={event =>
                            setFloorConfig(current => ({
                              ...current,
                              imposedLoad: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label>Toiture / entretien</Label>
                        <Input
                          inputMode="decimal"
                          value={floorConfig.roofLoad ?? "0.80"}
                          onChange={event =>
                            setFloorConfig(current => ({
                              ...current,
                              roofLoad: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <p className="mt-2 text-[9px] text-[#718083]">
                      Les zones et valeurs climatiques restent à confirmer selon
                      la ville, le sol et le référentiel applicable.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(loads).map(([key, value]) => (
                      <label
                        key={key}
                        className="flex items-center gap-2 rounded bg-white p-2 text-[10px]"
                      >
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={event =>
                            setLoads(prev => ({
                              ...prev,
                              [key]: event.target.checked,
                            }))
                          }
                        />
                        {key === "permanent"
                          ? "Permanentes"
                          : key === "exploitation"
                            ? "Exploitation"
                            : key === "wind"
                              ? "Vent"
                              : "Séisme"}
                      </label>
                    ))}
                  </div>
                  <div className="rounded-lg bg-[#fff5e8] p-3 text-[10px] text-[#8a5a21]">
                    <b>Sol proposé selon l’emplacement :</b> {soilProposal.soil}{" "}
                    · qadm {soilProposal.qadm} · {soilProposal.groundwater}.
                    <br />
                    <span className="opacity-80">
                      Statut {soilProposal.status} — {soilProposal.basis}.
                    </span>
                  </div>
                  <Button
                    className="w-full bg-[#27358f] text-white"
                    onClick={() => setPanel(null)}
                  >
                    Enregistrer les paramètres
                  </Button>
                </CardContent>
              </Card>
            )}
            {panel === "Historique des versions" && (
              <Card>
                <CardHeader className="p-3 pb-0">
                  <CardTitle className="text-sm">Historique local · {selected.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 p-3">
                  <p className="text-[10px] text-[#718083]">Les versions sont conservées sur cet appareil. Restaurer crée une nouvelle version et ne supprime pas les précédentes.</p>
                  {projectHistory.length ? projectHistory.map(snapshot => (
                    <div key={`${snapshot.projectId}:${snapshot.revision}`} className="flex items-center justify-between gap-2 rounded-lg border border-[#e2e8eb] bg-white p-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold">Version {snapshot.revision}</p>
                        <p className="truncate text-[9px] text-[#718083]">{new Date(snapshot.savedAt).toLocaleString()} · {snapshot.project.levels.length} niveau(x) · {snapshot.project.levels.reduce((count, level) => count + (Array.isArray(level.elements) ? level.elements.length : 0), 0)} élément(s)</p>
                      </div>
                      <Button type="button" variant="outline" className="min-h-10 shrink-0 px-3 text-[10px]" onClick={() => void restoreProjectVersion(snapshot)}>Restaurer</Button>
                    </div>
                  )) : <p className="rounded-lg bg-white p-3 text-[10px] text-[#718083]">Aucune version enregistrée pour le moment. Les modifications sont sauvegardées automatiquement après une courte pause.</p>}
                  <Button type="button" variant="outline" className="min-h-10 w-full" onClick={() => void loadBuildingProjectHistory<Project>(selected.id).then(setProjectHistory)}>Actualiser l’historique</Button>
                </CardContent>
              </Card>
            )}
            {panel === "Calculer la descente" && (
              <Card>
                <CardContent className="space-y-3 p-3">
                  {analyticalPrecheck && analyticalModel && (
                    <div className={`space-y-2 rounded-lg border p-3 text-[10px] ${analyticalPrecheck.ok ? "border-[#bfe4e2] bg-[#eaf8f7] text-[#245e60]" : "border-[#efc4b9] bg-[#fff1ed] text-[#914d3d]"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <b>{analyticalPrecheck.ok ? "Pré-contrôle géométrique réussi" : "Pré-contrôle géométrique échoué — calcul bloqué"}</b>
                        <span>Schéma v{analyticalModel.schemaVersion}</span>
                      </div>
                      <div>{analyticalPrecheck.checkedNodeCount} nœud(s) · {analyticalPrecheck.checkedFrameCount} barre(s) · {analyticalPrecheck.checkedSurfaceCount} surface(s) · tolérance {analyticalModel.nodeMergeToleranceM.toFixed(3)} m</div>
                      <AnalyticalPlanPreview model={analyticalModel} />
                      <Button type="button" variant="outline" className="h-8 bg-white text-[10px]" onClick={downloadAnalyticalJson}>Exporter le modèle analytique JSON</Button>
                      {analyticalPrecheck.errors.map((item,index) => <div key={`${item.code}-${index}`} className="rounded bg-white/80 p-2">Erreur · {item.message}</div>)}
                      {analyticalPrecheck.warnings.map((item,index) => <div key={`${item.code}-${index}`} className="rounded bg-white/70 p-2">Avertissement · {item.message}</div>)}
                    </div>
                  )}
                  <p className="text-[11px] text-[#68767d]">
                    Pré-étude : le calcul tributaire n’est autorisé qu’après le pré-contrôle de connectivité. Il ne remplace pas une analyse structurale par rigidité.
                  </p>
                  <LoadProgramEditor
                    program={loadProgram}
                    onChange={setLoadProgram}
                    patternValues={loadProgramPatternValues}
                    evaluation={loadProgramEvaluation}
                    diagnostics={loadProgramDiagnostics}
                    projectNorm={selected?.norm ?? norm}
                  />
                  {analyticalModel && analyticalPrecheck?.ok && buildingLoadModel && (
                    <div className="space-y-2 rounded-lg border border-[#cbd5ef] bg-[#f4f6fc] p-3 text-[10px] text-[#354477]">
                      <b>Diagnostic 2D optionnel — portiques plans</b>
                      <div className="grid grid-cols-[1fr_1.5fr_auto] gap-2">
                        <select aria-label="Plan d’analyse" className="h-8 rounded border bg-white px-2" value={analysisPlane} onChange={event=>{setAnalysisPlane(event.target.value as FramePlane);setPlaneAnalysis(null);}}><option value="XZ">Plan XZ</option><option value="YZ">Plan YZ</option></select>
                        <select aria-label="Combinaison du solveur" className="h-8 rounded border bg-white px-2" value={solverCombinationId} onChange={event=>{setSolverCombinationId(event.target.value);setPlaneAnalysis(null);}}>{loadProgram.combinations.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>
                        <Button type="button" className="h-8 bg-[#27358f] px-3 text-[9px] text-white" onClick={runPlanarAnalysis}>Résoudre</Button>
                      </div>
                      <div className="rounded bg-white p-2 text-[9px] text-[#647087]">Diagnostic local d’un portique dans le plan choisi. Le calcul principal des réactions de fondation est déjà lancé automatiquement par le solveur global 3D ci-dessous.</div>
                      {planeAnalysis && (
                        <div className="space-y-1 rounded bg-white p-2">
                          {planeAnalysis.errors.map((message,index)=><div key={`solver-error-${index}`} className="text-[#914d3d]">Erreur · {message}</div>)}
                          {planeAnalysis.result && <>
                            <div className="font-semibold">Résultats du solveur linéaire · {planeAnalysis.result.elements.length} barre(s) · max déplacement {Math.max(0,...planeAnalysis.result.displacements.map(item=>Math.hypot(item.uxM,item.uzM))).toFixed(5)} m · max |M extrémité| {Math.max(0,...planeAnalysis.result.elements.map(item=>Math.max(Math.abs(item.localEndForces.momentIKnM),Math.abs(item.localEndForces.momentJKnM)))).toFixed(2)} kN·m</div>
                            {planeAnalysis.comparison && <div>Comparaison équilibre vertical · tributaires {planeAnalysis.comparison.expectedReactionKn.toFixed(2)} kN · réactions du solveur {planeAnalysis.comparison.solverReactionKn.toFixed(2)} kN · écart {planeAnalysis.comparison.differencePercent.toFixed(2)} %</div>}
                            <div className="grid grid-cols-[1.2fr_repeat(3,1fr)] gap-1 border-b pb-1 font-semibold"><span>Barre</span><span>N i/j kN</span><span>V i/j kN</span><span>M i/j kN·m</span></div>
                            {planeAnalysis.result.elements.map(item=><div key={item.elementId} className="grid grid-cols-[1.2fr_repeat(3,1fr)] gap-1"><span>{item.elementId}</span><span>{item.localEndForces.axialIKn.toFixed(1)} / {item.localEndForces.axialJKn.toFixed(1)}</span><span>{item.localEndForces.shearIKn.toFixed(1)} / {item.localEndForces.shearJKn.toFixed(1)}</span><span>{item.localEndForces.momentIKnM.toFixed(1)} / {item.localEndForces.momentJKnM.toFixed(1)}</span></div>)}
                          </>}
                          {planeAnalysis.warnings.map((message,index)=><div key={`solver-warning-${index}`} className="text-[#8a5a21]">Avertissement · {message}</div>)}
                        </div>
                      )}
                    </div>
                  )}
                  {analyticalModel && analyticalPrecheck?.ok && (
                    <div className="space-y-2 rounded-lg border border-[#bddbd6] bg-[#eef9f6] p-3 text-[10px] text-[#285a52]">
                      <b>Surfaces — maillage triangulaire et plaque</b>
                      <div className="grid grid-cols-[1fr_auto] gap-2">
                        <label className="flex items-center gap-2">Taille cible de maille (m)
                          <Input aria-label="Taille de maille des surfaces en mètres" inputMode="decimal" value={surfaceMeshSizeM} onChange={event => setSurfaceMeshSizeM(event.target.value)} className="h-8 w-24 bg-white text-[10px]" />
                        </label>
                        <Button type="button" className="h-8 bg-[#087f7f] px-3 text-[9px] text-white" onClick={() => { const ready = runSurfaceAnalysis(); setMeshPrerequisiteReady(ready); }}>Mailler / analyser</Button>
                      </div>
                      <div className="rounded bg-white p-2 text-[9px] text-[#647087]">Le maillage calcule les zones rectangulaires et leurs charges pour tous les planchers. Le solveur de plaque v1 dimensionne uniquement les dalles pleines homogènes, simplement appuyées sur quatre bords ; les planchers à corps creux restent calculés par répartition tributaire vers les poutres. Les trémies, appuis continus, voiles, diaphragmes et couplage global avec les poutres ne sont pas dimensionnés par ce solveur.</div>
                      {surfaceAnalysis && (
                        <div className="space-y-2">
                          {surfaceAnalysis.errors.length === 0 && <div className="rounded bg-white p-2">Toutes les surfaces traitées sans erreur de maillage ni d’équilibre global.</div>}
                          {surfaceAnalysis.rows.map(row => (
                            <div key={row.elementId} className="space-y-2 rounded border border-[#d8e8e4] bg-white p-2">
                              <div className="font-semibold">{row.elementId} · {row.levelLabel} · aire nette {row.areaM2.toFixed(2)} m² · {row.openingCount} trémie(s)</div>
                              <SurfaceMeshPreview analysis={row.analysis} />
                              {row.analysis.mesh && <div>{row.analysis.mesh.nodes.length} nœuds · {row.analysis.mesh.triangles.length} triangles · aspect max {row.analysis.mesh.maximumAspectRatio.toFixed(2)} · charge nette {row.analysis.mesh.totalUniformLoadKn.toFixed(2)} kN</div>}
                              {row.analysis.plate && <>
                                <div className="grid grid-cols-2 gap-1 rounded bg-[#eef9f6] p-2 font-semibold">
                                  <span>Flèche max {(row.analysis.plate.maximumDeflectionM * 1000).toFixed(2)} mm</span>
                                  <span>Max |Mx| {row.analysis.plate.maximumMxKnMPerM.toFixed(2)} kN·m/m</span>
                                  <span>Max |My| {row.analysis.plate.maximumMyKnMPerM.toFixed(2)} kN·m/m</span>
                                  <span>Charge/équilibre {row.analysis.plate.totalLoadKn.toFixed(2)} / résidu {row.analysis.plate.equilibriumResidualKn.toExponential(1)} kN</span>
                                </div>
                                <div className="grid grid-cols-2 gap-1">{row.analysis.plate.edgeReactions.map(edge => <span key={edge.edge}>{edge.edge} : {edge.totalKn.toFixed(2)} kN · {edge.lineLoadKnM.toFixed(2)} kN/m</span>)}</div>
                              </>}
                              {row.analysis.errors.map((message, index) => <div key={`${row.elementId}-error-${index}`} className="rounded bg-[#fff1ed] p-2 text-[#914d3d]">Non calculé · {message}</div>)}
                              {row.analysis.warnings.map((message, index) => <div key={`${row.elementId}-warning-${index}`} className="rounded bg-[#fff5e8] p-2 text-[#8a5a21]">Avertissement · {message}</div>)}
                            </div>
                          ))}
                          {surfaceAnalysis.rows.length === 0 && surfaceAnalysis.errors.map((message, index) => <div key={`surface-error-${index}`} className="rounded bg-[#fff1ed] p-2 text-[#914d3d]">Erreur · {message}</div>)}
                          <Button type="button" variant="outline" className="h-8 bg-white text-[9px]" onClick={downloadSurfaceAnalysis}>Exporter résultats de surfaces JSON</Button>
                        </div>
                      )}
                    </div>
                  )}
                  {selected && buildingCalculation && analyticalPrecheck?.ok && (
                    <ReinforcedConcretePanel
                      projectId={selected.id}
                      projectNorm={selected.norm ?? norm}
                      members={rcMemberExtraction.demands}
                      slabs={rcSlabDemands}
                      foundations={rcFoundationDemands}
                      walls={rcWallDemands}
                      sourceWarnings={rcSourceWarnings}
                      onResultChange={setRcDesignResult}
                      onApplySection={applyOptimizedSection}
                      optimizedElementIds={optimizationLockedElementIds}
                    />
                  )}
                  {selected && buildingCalculation && analyticalPrecheck?.ok && (
                    <FoundationReactionPanel
                      key={`${selected.id}:${selected.levels.length}`}
                      model={analyticalModel}
                      result={planeAnalysis?.result ?? null}
                      gravityResult={automaticFoundationResult}
                      plane={analysisPlane}
                      soilName={soilProposal.soil}
                      suggestedBearingKPa={Number.parseFloat(soilProposal.qadm)}
                      suggestedSource={`${soilProposal.basis} · ${soilProposal.groundwater}`}
                      onResultChange={setFoundationEvaluation}
                    />
                  )}
                  {buildingCalculation && (
                    <div className="space-y-2 rounded-lg border border-[#bfe4e2] bg-[#eaf8f7] p-3 text-[10px] text-[#245e60]">
                      <div className="font-bold text-[#087f7f]">
                        Calcul terminé sur la structure modélisée
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <span>Dalles : {buildingCalculation.floorCount}</span>
                        <span>Poutres : {buildingCalculation.beamCount}</span>
                        <span>
                          Appuis poteaux : {buildingCalculation.columnCount}
                        </span>
                        <span>
                          Fondations chargées :{" "}
                          {buildingCalculation.foundationCount}
                        </span>
                      </div>
                      <div className="border-t border-[#c7e6e4] pt-2 font-semibold">
                        Gk transmis : {buildingCalculation.totalGk.toFixed(2)}{" "}
                        kN · Qk transmis :{" "}
                        {buildingCalculation.totalQk.toFixed(2)} kN
                      </div>
                      <div className="grid grid-cols-2 gap-1 rounded bg-white/70 p-2 text-[9px]">
                        {Object.entries(buildingCalculation.levelLoads).map(
                          ([levelId, level]) => (
                            <span key={levelId}>
                              <b>
                                {selected.levels.find(
                                  item => item.id === levelId
                                )?.label ?? levelId}
                              </b>{" "}
                              · G {level.totalGk.toFixed(1)} · Q{" "}
                              {level.totalQk.toFixed(1)} kN
                            </span>
                          )
                        )}
                      </div>
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center justify-between px-1 text-[10px] font-bold text-[#3f6265]">
                          <span>Synthèse par famille et sollicitation</span>
                          <span className="font-normal text-[#789095]">{analysisGroups.length} groupe(s)</span>
                        </div>
                        {analysisGroups.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-[#cbd9dc] bg-white p-3 text-[10px] text-[#74858c]">
                            Aucun élément calculé à afficher.
                          </div>
                        ) : analysisGroups.map(group => (
                          <div key={group.key} className="overflow-hidden rounded-lg border border-[#dfe8e8] bg-white">
                            <div className="flex items-center justify-between bg-[#f2f7f7] px-2 py-2 text-[9px]">
                              <div>
                                <b className="text-[#245e60]">{group.label}</b>
                                <span className="ml-1 text-[#7c8e92]">· groupe {group.key.split("-").at(-1)}</span>
                              </div>
                              <span className="font-semibold text-[#087f7f]">Nu {group.minimumNu.toFixed(1)}–{group.maximumNu.toFixed(1)} kN</span>
                            </div>
                            {group.rows.map(row => (
                              <button
                                type="button"
                                key={`${row.levelId}:${row.id}`}
                                onClick={() => setSelectedAnalysisRow(row)}
                                className="grid w-full grid-cols-[1.35fr_.7fr_.7fr_.8fr_.8fr] gap-1 border-t border-[#edf1f1] px-2 py-2 text-left text-[9px] text-[#4c5e61] transition-colors hover:bg-[#f8fbfb]"
                              >
                                <span className="font-semibold">
                                  {row.label}
                                  <small className="ml-1 block font-normal text-[#8a9799]">
                                    {selected.levels.find(level => level.id === row.levelId)?.label ?? row.levelId}
                                    {row.section ? ` · ${row.section}` : ""}
                                  </small>
                                </span>
                                <span>{row.gk.toFixed(1)}</span>
                                <span>{row.qk.toFixed(1)}</span>
                                <span className="font-bold text-[#087f7f]">{row.nu.toFixed(1)}</span>
                                <span>{row.nser.toFixed(1)}</span>
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                      {selectedPassport && (
                        <div className="mt-2 rounded-xl border border-[#f0b08a] bg-[#fffaf6] p-3 text-[10px] text-[#4c5e61]">
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <div>
                              <div className="text-[11px] font-bold text-[#9a4318]">Structural Passport</div>
                              <div className="font-semibold text-[#27358f]">{selectedPassport.label}</div>
                              <div className="text-[9px] text-[#7f8d91]">{selectedPassport.elementType} · {selectedPassport.levelLabel}</div>
                            </div>
                            <button type="button" onClick={() => setSelectedAnalysisRow(null)} className="grid h-7 w-7 place-items-center rounded-full bg-white text-[#7f8d91]" aria-label="Fermer la fiche">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="mt-2 grid gap-1 rounded-lg bg-white p-2">
                            {renderStructuralPassport(selectedPassport).map((line, index) => <div key={index}>{line}</div>)}
                          </div>
                        </div>
                      )}
                      {buildingCalculation.warnings.length > 0 && (
                        <div className="rounded bg-[#fff5e8] p-2 text-[#8a5a21]">
                          {buildingCalculation.warnings
                            .slice(0, 4)
                            .map(warning => (
                              <div key={warning}>⚠ {warning}</div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                  <Button
                    className="w-full bg-[#049b9b] text-white"
                    onClick={() => {
                      const analytical = buildCurrentAnalytical();
                      if (!analytical) return;
                      setAnalyticalModel(analytical.model);
                      setAnalyticalPrecheck(analytical.precheck);
                      if (!analytical.precheck.ok) {
                        setBuildingCalculation(null);
                        toast.error(`Rapport bloqué : ${analytical.precheck.errors.length} erreur(s) de connectivité ou de géométrie`);
                        return;
                      }
                      const programErrors = validateLoadProgram(loadProgram).filter(item=>item.severity === "error");
                      if (programErrors.length) {
                        toast.error(`Rapport bloqué : ${programErrors.length} erreur(s) dans les cas ou combinaisons de charges`);
                        return;
                      }
                      const floorLoads = summarizeFloorLoads(
                        activeLevel?.elements ?? [],
                        gridDistance,
                        floorConfig
                      );
                      const loadElements = selected.levels.flatMap(level =>
                        level.elements.map(element => ({
                          ...element,
                          levelId: level.id,
                        }))
                      );
                      const buildingLoadModel = buildBuildingLoadModel(
                        loadElements,
                        {
                          levelOrder: selected.levels.map(level => level.id),
                          levelHeights: Object.fromEntries(
                            selected.levels.map(level => [
                              level.id,
                              Number(
                                level.height ??
                                  (level.id === "foundation" ? 1 : 3.2)
                              ),
                            ])
                          ),
                          gridDistance:
                            Number(gridDistance.replace(",", ".")) || 4,
                        }
                      );
                      const buildingSummary =
                        summarizeBuildingLoads(buildingLoadModel);
                      const reportGroups = buildLoadSynthesis(buildingSummary.rows);
                      const reportLoadProgramEvaluation = evaluateLoadProgram(loadProgram, {
                        ...Object.fromEntries(loadProgram.patterns.map(pattern=>[pattern.id,pattern.value])),
                        G: buildingSummary.totalGk,
                        Q: buildingSummary.totalQk,
                      });
                      const reportLoadProgramWarnings = validateLoadProgram(loadProgram).filter(item=>item.severity === "warning");
                      const propagationNote = [
                        "",
                        "Propagation sur éléments réels",
                        `Dalles : ${buildingSummary.floorCount} · Poutres : ${buildingSummary.beamCount} · Appuis poteaux : ${buildingSummary.columnCount} · Fondations chargées : ${buildingSummary.foundationCount}`,
                        `Charges transmises aux fondations : Gk ${buildingSummary.totalGk.toFixed(2)} kN · Qk ${buildingSummary.totalQk.toFixed(2)} kN`,
                        ...(buildingSummary.warnings.length
                          ? ["Avertissements :", ...buildingSummary.warnings]
                          : ["Aucun avertissement de liaison géométrique."]),
                      ].join("\n");
                      const report = [
                        `NOTE DE CALCUL — DESCENTE DE CHARGES`,
                        `Projet : ${selected.name}`,
                        `Pays : ${selected.country} · Ville : ${selected.city || "non renseignée"} · Emplacement : ${selected.location || "non renseigné"}`,
                        `Structure : ${selected.structure} · Référentiel : ${selected.norm}`,
                        `Périmètre : tous les niveaux (${selected.levels.map(level => level.label).join(", ")})`,
                        `Plancher : ${floorNoteSummary(floorConfig)}`,
                        "",
                        "CATALOGUE DES ACTIONS",
                        ...loadCatalogForFloor(floorConfig).map(
                          entry =>
                            `${entry.label} : ${entry.defaultValue.toFixed(2)} ${entry.unit} — ${entry.source}`
                        ),
                        "",
                        "CAS DE CHARGES, COMBINAISONS ET SOURCE DE MASSE — PRÉ-ÉTUDE",
                        `Référentiel déclaré : ${selected.norm} · coefficients génériques provisoires, non validés pour une annexe nationale`,
                        `Source de masse : ${reportLoadProgramEvaluation.massTonnes.toFixed(3)} t équivalentes · ${loadProgram.massSource.note}`,
                        ...reportLoadProgramEvaluation.combinations.filter(item=>item.enabled).map(item=>`${item.name} : ${item.value.toFixed(2)} kN globaux · ${item.status} · ${loadProgram.combinations.find(combination=>combination.id===item.id)?.note ?? ""}`),
                        ...reportLoadProgramWarnings.map(item=>`Avertissement : ${item.message}`),
                        "",
                        "ANALYSE STRUCTURALE 2D — RÉSULTATS À L’ÉCHELLE D’UN PORTIQUE",
                        ...(planeAnalysis?.result ? [
                          `Plan ${planeAnalysis.result.plane} · ${planeAnalysis.result.elements.length} barre(s) · méthode linéaire Euler–Bernoulli`,
                          `Réactions verticales : ${planeAnalysis.result.equilibrium.reactionFzKn.toFixed(2)} kN · charge tributaire globale attendue : ${planeAnalysis.comparison?.expectedReactionKn.toFixed(2) ?? "—"} kN · écart : ${planeAnalysis.comparison?.differencePercent.toFixed(2) ?? "—"} %`,
                          ...planeAnalysis.result.elements.map(item=>`${item.elementId} · N(i/j) ${item.localEndForces.axialIKn.toFixed(2)}/${item.localEndForces.axialJKn.toFixed(2)} kN · V(i/j) ${item.localEndForces.shearIKn.toFixed(2)}/${item.localEndForces.shearJKn.toFixed(2)} kN · M(i/j) ${item.localEndForces.momentIKnM.toFixed(2)}/${item.localEndForces.momentJKnM.toFixed(2)} kN·m`),
                          ...planeAnalysis.warnings.map(message=>`Avertissement solveur : ${message}`),
                        ] : ["Analyse 2D non exécutée : lancer le solveur sur le portique coplanaire proposé dans le panneau ci-dessus. La descente tributaire reste disponible séparément."]),
                        "",
                        "ANALYSE GLOBALE 3D — RÉSULTATS ET TRAÇABILITÉ",
                        ...(spatial3DResult ? [
                          `Nœuds : ${spatial3DResult.nodeDisplacements.length} · réactions : ${spatial3DResult.reactions.length} · éléments : ${spatial3DResult.elementCount}`,
                          `Équilibre appliqué/réactions : Fx ${spatial3DResult.equilibrium.appliedFxKn.toFixed(2)}/${spatial3DResult.equilibrium.reactionFxKn.toFixed(2)} kN · Fy ${spatial3DResult.equilibrium.appliedFyKn.toFixed(2)}/${spatial3DResult.equilibrium.reactionFyKn.toFixed(2)} kN · Fz ${spatial3DResult.equilibrium.appliedFzKn.toFixed(2)}/${spatial3DResult.equilibrium.reactionFzKn.toFixed(2)} kN`,
                          `Équilibre moments : Mx ${(spatial3DResult.equilibrium.appliedMxKnM ?? 0).toFixed(2)}/${(spatial3DResult.equilibrium.reactionMxKnM ?? 0).toFixed(2)} · My ${(spatial3DResult.equilibrium.appliedMyKnM ?? 0).toFixed(2)}/${(spatial3DResult.equilibrium.reactionMyKnM ?? 0).toFixed(2)} · Mz ${(spatial3DResult.equilibrium.appliedMzKnM ?? 0).toFixed(2)}/${(spatial3DResult.equilibrium.reactionMzKnM ?? 0).toFixed(2)} kN·m`,
                          ...spatial3DResult.elements.map(item => `${item.sourceElementId} · N(i/j) ${item.start.axialKn.toFixed(2)}/${item.end.axialKn.toFixed(2)} kN · Vy(i/j) ${item.start.shearYKn.toFixed(2)}/${item.end.shearYKn.toFixed(2)} kN · Vz(i/j) ${item.start.shearZKn.toFixed(2)}/${item.end.shearZKn.toFixed(2)} kN · My(i/j) ${item.start.momentYKnM.toFixed(2)}/${item.end.momentYKnM.toFixed(2)} · Mz(i/j) ${item.start.momentZKnM.toFixed(2)}/${item.end.momentZKnM.toFixed(2)} kN·m · T(i/j) ${item.start.torsionKnM.toFixed(2)}/${item.end.torsionKnM.toFixed(2)} kN·m`),
                          ...(spatial3DResult.pDelta ? [`P-Δ itératif : indice ${spatial3DResult.pDelta.stabilityIndex.toFixed(3)} · itérations ${spatial3DResult.pDelta.iterations} · convergence ${spatial3DResult.pDelta.converged ? "OK" : "NON"}`] : ["P-Δ : résultat non disponible"]),
                          ...spatial3DResult.nonlinearStates?.map(item => `${item.elementId} · déformation axiale ${item.axialStrain.toExponential(3)} · régime ${item.state.regime} · contrainte ${item.state.stressMpa.toFixed(2)} MPa · rupture ${item.state.failed ? "OUI" : "non"}`) ?? [],
                          ...spatial3DResult.warnings.map(message => `Avertissement 3D : ${message}`),
                        ] : ["Analyse globale 3D non exécutée : lancer le calcul spatial avant l’export." ]),
                        "",
                        "ACTIONS SISMIQUES ET CLIMATIQUES",
                        ...(climateAnalysis ? [
                          `Séisme : masse ${climateAnalysis.seismic.totalMassTonnes.toFixed(3)} t · cisaillement de base ${climateAnalysis.seismic.baseShearKn.toFixed(2)} kN`,
                          ...climateAnalysis.seismic.stories.map(story => `Étage ${story.storyIndex + 1} · F ${story.lateralForceKn.toFixed(2)} kN · V ${story.storyShearKn.toFixed(2)} kN · dérive ${(story.driftRatio * 100).toFixed(3)} %`),
                          ...climateAnalysis.errors.map(message => `Erreur action climatique : ${message}`),
                          ...climateAnalysis.warnings.map(message => `Avertissement action climatique : ${message}`),
                        ] : ["Analyse climatique/sismique non exécutée dans cette session."]),
                        "",
                        "PRÉ-DIMENSIONNEMENT BÉTON ARMÉ — NON RÉGLEMENTAIRE",
                        ...(rcDesignResult ? [
                          `Statut : ${rcDesignResult.status} · référentiel ${rcDesignResult.standard || "non renseigné"} · annexe ${rcDesignResult.nationalAnnex || "non renseignée"} · source ${rcDesignResult.sourceReference || "non renseignée"}`,
                          `Matériaux/détails saisis : fck ${rcDesignResult.materialBasis.fckMpa} MPa · fyk ${rcDesignResult.materialBasis.fykMpa} MPa · γc ${rcDesignResult.materialBasis.gammaC} · γs ${rcDesignResult.materialBasis.gammaS} · αcc ${rcDesignResult.materialBasis.alphaCC} · enrobage ${rcDesignResult.materialBasis.coverMm} mm · ρmin/max ${rcDesignResult.materialBasis.minReinforcementRatio}/${rcDesignResult.materialBasis.maxReinforcementRatio} · τRd,c ${rcDesignResult.materialBasis.concreteShearStressLimitMpa} MPa · τbd ${rcDesignResult.materialBasis.bondStressMpa} MPa · saisie confirmée ${rcDesignResult.materialBasis.basisConfirmed}`,
                          ...rcDesignResult.elements.flatMap(item => [
                            `${item.type} ${item.elementId} · combinaison gouvernante déclarée ${item.combinationName} (${item.combinationId})`,
                            ...item.reinforcement.map(bar => `${bar.label} : ${bar.count} HA ${bar.diameterMm} · ${bar.areaMm2.toFixed(0)} mm² · longueur ${bar.totalLengthM.toFixed(2)} m · masse ${bar.massKg.toFixed(2)} kg`),
                            ...item.checks.map(check => `${check.label} : ${check.status} · Ed ${check.demand?.toFixed(2) ?? "—"} ${check.unit} · Rd ${check.resistance?.toFixed(2) ?? "—"} ${check.unit} · ${check.formula}`),
                            ...item.limitations.map(message => `Limite ${item.elementId} : ${message}`),
                          ]),
                          ...rcDesignResult.schedule.map(item => `Nomenclature HA ${item.diameterMm} : ${item.totalLengthM.toFixed(2)} m · ${item.massKg.toFixed(2)} kg`),
                          ...rcDesignResult.errors.map(message => `Bloqué : ${message}`),
                          ...rcDesignResult.blockers.map(message => `Limite réglementaire : ${message}`),
                          ...rcDesignResult.warnings.map(message => `Avertissement : ${message}`),
                        ] : ["Aucun calcul d’armatures n’a été lancé ; aucun ferraillage ne doit être déduit de cette note."]),
                        "",
                        "ANALYSE VISUELLE — ÉCHELLE PROGRESSIVE Nu",
                        `Échelle poteaux/semelles : ${loadScale.minimum.toFixed(2)} kN (jaune pâle) → ${loadScale.maximum.toFixed(2)} kN (rouge vif)`,
                        "Code couleur : charge faible = jaune pâle · charge intermédiaire = orange · charge maximale = rouge vif",
                        `Poteau le plus chargé : ${criticalColumn?.label ?? "non disponible"} · Nu ${criticalColumn?.nu.toFixed(2) ?? "0.00"} kN · rouge vif`,
                        `Semelle la plus chargée : ${criticalFoundation?.label ?? "non disponible"} · Nu ${criticalFoundation?.nu.toFixed(2) ?? "0.00"} kN · rouge vif`,
                        "",
                        "SYNTHÈSE PAR FAMILLE ET SOLLICITATION",
                        "Élément | Niveau | G (kN) | Q (kN) | Nu (kN) | Nser (kN) | M (kN·m)",
                        ...reportGroups.flatMap(group => [
                          `${group.label} — groupe ${group.key.split("-").at(-1)} · Nu ${group.minimumNu.toFixed(2)} à ${group.maximumNu.toFixed(2)} kN`,
                          ...group.rows.map(row => {
                            const moment = analysisValues[`${row.levelId}:${row.id}`]?.moment;
                            return `${row.label} | ${selected.levels.find(level => level.id === row.levelId)?.label ?? row.levelId} | ${row.gk.toFixed(2)} | ${row.qk.toFixed(2)} | ${row.nu.toFixed(2)} | ${row.nser.toFixed(2)} | ${moment?.toFixed(2) ?? "—"}`;
                          }),
                        ]),
                        "",
                        ...propagationNote.split("\n"),
                        "",
                        "AVERTISSEMENT : résultat indicatif à vérifier et valider par un ingénieur structure avant exécution.",
                      ].join("\n");
                      const reportPassports = reportGroups.flatMap(group => group.rows.map(row => {
                        const moment = analysisValues[`${row.levelId}:${row.id}`]?.moment;
                        return createStructuralPassport({
                          elementId: row.id,
                          label: row.label,
                          elementType: loadFamilyLabel(row.type),
                          levelLabel: selected.levels.find(level => level.id === row.levelId)?.label ?? row.levelId,
                          section: row.section ?? "Non renseigné",
                          gkKn: row.gk,
                          qkKn: row.qk,
                          nuKn: row.nu,
                          nserKn: row.nser,
                          momentKnM: typeof moment === "number" ? moment : null,
                          supports: row.supports,
                          sources: row.sources,
                        });
                      }));
                      const foundationReportLines = [
                        `Provenance : ${foundationEvaluation?.basis.source || "non renseignée"} · sol proposé ${foundationEvaluation?.basis.soilName || soilProposal.soil}`,
                        `qadm déclaré : ${foundationEvaluation?.basis.allowableBearingKPa?.toFixed(2) ?? "non renseigné"} kPa · coefficients portance/glissement ${foundationEvaluation?.basis.bearingSafetyFactor ?? "—"}/${foundationEvaluation?.basis.slidingSafetyFactor ?? "—"}`,
                        ...(foundationEvaluation?.rows.length ? foundationEvaluation.rows.flatMap(row => [
                          `${row.footingId} · poteau ${row.columnId} · appui ${row.reaction.nodeId} · N ${row.reaction.verticalReactionKn.toFixed(2)} kN · H ${row.reaction.horizontalReactionKn.toFixed(2)} kN · M ${row.reaction.momentReactionKnM.toFixed(2)} kN·m · axe ${row.reaction.momentAxis.toUpperCase()}`,
                          ...(row.result ? [
                            `${row.result.status} · N effectif ${row.result.effectiveAxialKn.toFixed(2)} kN · e ${row.result.eccentricityM.toFixed(3)} m · qmin ${row.result.minimumPressureKPa.toFixed(2)} kPa · qmax ${Number.isFinite(row.result.maximumPressureKPa) ? row.result.maximumPressureKPa.toFixed(2) : "∞"} kPa`,
                            ...row.result.checks.map(check => `${check.label} : ${check.status} · Ed ${check.demand === null ? "—" : Number.isFinite(check.demand) ? check.demand.toFixed(2) : "∞"} ${check.unit} · Rd ${check.resistance === null ? "—" : check.resistance.toFixed(2)} ${check.unit} · ${check.note}`),
                            ...row.result.warnings,
                          ] : [`Vérification non calculée : ${row.error ?? "paramètres manquants"}`]),
                        ]) : ["Aucune réaction de fondation du solveur n’est disponible ; aucune vérification de fondation n’est produite."]),
                        ...(foundationEvaluation?.warnings ?? []),
                      ];
                      const reportDocument = createStructuralReport({
                        title: "NOTE DE CALCUL — DESCENTE DE CHARGES",
                        generatedAt: new Date().toISOString(),
                        project: { id: selected.id, name: selected.name, country: selected.country, city: selected.city, location: selected.location, structure: selected.structure, norm: selected.norm },
                        body: report,
                        passports: reportPassports,
                        sections: [
                          { title: "Fondations — vérifications à partir des réactions du solveur", lines: foundationReportLines },
                          { title: "Avertissements et limites", lines: [...(foundationEvaluation?.warnings ?? []), ...(rcDesignResult?.blockers ?? []), "Les résultats restent indicatifs et ne valent pas visa, validation normative ou autorisation d’exécuter."] },
                        ],
                      });
                      const unifiedReport = renderStructuralReport(reportDocument);
                      setLastStructuralReport(unifiedReport);
                      try { sessionStorage.setItem("gcbtp-last-structural-report", JSON.stringify(reportDocument)); } catch { /* Le rapport reste disponible pour l’aperçu et l’export courant. */ }
                      sessionStorage.setItem(
                        "gcbtp-last-floor-note",
                        floorNoteSummary(floorConfig)
                      );
                      sessionStorage.setItem(
                        "gcbtp-floor-load-data",
                        JSON.stringify({
                          floorLoads,
                          buildingSummary,
                          loadProgram,
                          loadProgramEvaluation: reportLoadProgramEvaluation,
                          planeAnalysis,
                          rcDesignResult,
                          foundationEvaluation,
                          reportDocument,
                          propagation: buildingLoadModel.propagation,
                        })
                      );
                      onExport(unifiedReport);
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Exporter le PDF et afficher l’aperçu unifié
                  </Button>
                  {lastStructuralReport && <details open className="mt-2 rounded-xl border border-[#c7d9dd] bg-white p-2 text-[9px] text-[#455b61]">
                    <summary className="cursor-pointer font-bold">Aperçu du rapport · même contenu que le PDF</summary>
                    <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-[#f7fafb] p-2 font-sans">{lastStructuralReport}</pre>
                  </details>}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
      {showCalculationPreflight && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-[#102f45]/45 p-4" role="dialog" aria-modal="true" aria-labelledby="calculation-preflight-title">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl border border-[#cbdde1] bg-[#f8fbfc] p-4 shadow-2xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div><h2 id="calculation-preflight-title" className="text-base font-bold text-[#173b50]">Préparer le lancement des calculs</h2><p className="mt-1 text-[11px] text-[#63777f]">Deux étapes sont obligatoires : mailler les dalles et appliquer les cas de chargement actifs.</p></div>
              <button type="button" className="grid h-8 w-8 place-items-center rounded-full bg-white text-[#718083]" onClick={() => setShowCalculationPreflight(false)} aria-label="Fermer"><X className="h-4 w-4" /></button>
            </div>
            {analyticalPrecheck && !analyticalPrecheck.ok && <div className="mb-3 space-y-1 rounded-lg border border-[#efc4b9] bg-[#fff1ed] p-3 text-[10px] text-[#914d3d]"><b>Le modèle analytique doit être corrigé avant le calcul.</b>{analyticalPrecheck.errors.map((item, index) => <div key={`${item.code}-${index}`}>· {item.message}</div>)}</div>}
            <div className="grid gap-3 md:grid-cols-2">
              <div className={`rounded-xl border p-3 ${meshPrerequisiteReady ? "border-[#bfe4e2] bg-[#eaf8f7]" : "border-[#dce7eb] bg-white"}`}>
                <div className="flex items-center justify-between"><b className="text-[12px] text-[#245e60]">1. Maillage des dalles</b><span className="text-[10px] font-bold">{meshPrerequisiteReady ? "OK" : "À faire"}</span></div>
                <p className="mt-1 text-[10px] text-[#68767d]">Le maillage calcule les triangles, l’aire nette et les charges. L’aperçu 3D affichera ensuite les lignes du maillage.</p>
                <Button type="button" className="mt-3 h-9 w-full bg-[#087f7f] text-[10px] text-white" disabled={!analyticalPrecheck?.ok} onClick={() => { const ready = runSurfaceAnalysis(); setMeshPrerequisiteReady(ready); }}>{meshPrerequisiteReady ? "Recalculer le maillage" : "Mailler les dalles"}</Button>
                {surfaceAnalysis && <div className="mt-2 text-[9px] text-[#536b70]">{surfaceAnalysis.rows.length} dalle(s) · {surfaceAnalysis.errors.length} erreur(s) · charge nette {surfaceAnalysis.rows.reduce((sum, row) => sum + (row.analysis.mesh?.totalUniformLoadKn ?? 0), 0).toFixed(2)} kN</div>}
              </div>
              <div className={`rounded-xl border p-3 ${loadCasesPrerequisiteReady ? "border-[#bfe4e2] bg-[#eaf8f7]" : "border-[#dce7eb] bg-white"}`}>
                <div className="flex items-center justify-between"><b className="text-[12px] text-[#245e60]">2. Cas de chargement</b><span className="text-[10px] font-bold">{loadCasesPrerequisiteReady ? "OK" : "À appliquer"}</span></div>
                <p className="mt-1 text-[10px] text-[#68767d]">Les cas actifs seront transmis aux combinaisons. Le poids propre G est calculé depuis la géométrie et ne reste plus à zéro.</p>
                <div className="mt-2 rounded bg-[#f7fafb] p-2 text-[9px] text-[#536b70]">Gk calculé : <b>{buildingCalculation?.totalGk.toFixed(2) ?? "0.00"} kN</b> · Qk calculé : <b>{buildingCalculation?.totalQk.toFixed(2) ?? "0.00"} kN</b> · {loadProgram.cases.filter(item => item.enabled).length} cas actifs · {loadProgram.combinations.filter(item => item.enabled).length} combinaisons actives</div>
                <Button type="button" className="mt-3 h-9 w-full bg-[#27358f] text-[10px] text-white" disabled={loadProgramDiagnostics.some(item => item.severity === "error") || !loadProgram.combinations.some(item => item.enabled)} onClick={() => setLoadCasesPrerequisiteReady(true)}>{loadCasesPrerequisiteReady ? "Cas appliqués" : "Appliquer les cas actifs"}</Button>
                {loadProgramDiagnostics.filter(item => item.severity === "error").map((item, index) => <div key={`${item.code}-${index}`} className="mt-1 text-[9px] text-[#914d3d]">{item.message}</div>)}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#dce7eb] bg-white p-3"><span className="text-[10px] text-[#68767d]">{meshPrerequisiteReady && loadCasesPrerequisiteReady ? "Les deux prérequis sont validés." : "Validez les deux étapes pour continuer."}</span><Button type="button" className="h-9 bg-[#102f45] px-4 text-[10px] text-white" disabled={!analyticalPrecheck?.ok || !meshPrerequisiteReady || !loadCasesPrerequisiteReady} onClick={executeBuildingCalculation}>Lancer les calculs maintenant</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function AnalyticalPlanPreview({ model }: { model: AnalyticalModel }) {
  const width = 320;
  const height = 132;
  const padding = 14;
  const xs = model.nodes.map(node => node.x);
  const ys = model.nodes.map(node => node.y);
  const minX = Math.min(...xs, 0), maxX = Math.max(...xs, 1);
  const minY = Math.min(...ys, 0), maxY = Math.max(...ys, 1);
  const scale = Math.min((width - padding * 2) / Math.max(maxX - minX, 0.1), (height - padding * 2) / Math.max(maxY - minY, 0.1));
  const offsetX = (width - (maxX - minX) * scale) / 2;
  const offsetY = (height - (maxY - minY) * scale) / 2;
  const point = (nodeId: string) => {
    const node = model.nodes.find(item => item.id === nodeId);
    return node ? { x: offsetX + (node.x - minX) * scale, y: height - offsetY - (node.y - minY) * scale, node } : null;
  };
  return <div className="overflow-hidden rounded border border-[#d9e4e5] bg-white">
    <div className="flex items-center justify-between px-2 py-1 text-[9px] text-[#64787d]"><span>Graphe analytique — plan XY (m)</span><span>{model.supports.length} appui(s)</span></div>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Aperçu XY du modèle analytique" className="h-[132px] w-full">
      {model.surfaces.map(surface => {
        const points = surface.nodeIds.map(point).filter((item): item is NonNullable<typeof item> => Boolean(item));
        if (points.length < 2) return null;
        return <polygon key={surface.id} points={points.map(item => `${item.x},${item.y}`).join(" ")} fill={surface.kind === "footing" ? "#ef8a5420" : "#079ca020"} stroke={surface.kind === "footing" ? "#ef8a54" : "#079ca0"} strokeWidth="1.5" />;
      })}
      {model.frames.map(frame => {
        const a = point(frame.startNodeId), b = point(frame.endNodeId);
        return a && b ? <line key={frame.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={frame.sourceType === "Poteau" ? "#27358f" : "#102f45"} strokeWidth="2.5" /> : null;
      })}
      {model.nodes.map(node => {
        const p = point(node.id);
        if (!p) return null;
        const isSupport = model.supports.some(support => support.nodeId === node.id);
        return <g key={node.id}><circle cx={p.x} cy={p.y} r={isSupport ? 4.5 : 2.8} fill={isSupport ? "#e87538" : "#102f45"} stroke="white" strokeWidth="1"/><title>{`${node.id} · ${node.x.toFixed(2)}, ${node.y.toFixed(2)}, ${node.z.toFixed(2)} m`}</title></g>;
      })}
    </svg>
  </div>;
}

function LoadProgramEditor({
  program,
  onChange,
  patternValues,
  evaluation,
  diagnostics,
  projectNorm,
}: {
  program: LoadProgram;
  onChange: (next: LoadProgram) => void;
  patternValues: Record<string, number>;
  evaluation: ReturnType<typeof evaluateLoadProgram>;
  diagnostics: ReturnType<typeof validateLoadProgram>;
  projectNorm: string;
}) {
  const updatePattern = (id: string, patch: Partial<LoadProgram["patterns"][number]>) => onChange({
    ...program,
    patterns: program.patterns.map(pattern => pattern.id === id ? { ...pattern, ...patch } : pattern),
  });
  const updateCombinationFactor = (combinationId: string, caseId: string, value: number) => onChange({
    ...program,
    combinations: program.combinations.map(combination => combination.id === combinationId ? {
      ...combination,
      caseFactors: { ...combination.caseFactors, [caseId]: value },
      origin: "manual",
      status: "provisional",
      note: "Coefficient modifié par l’utilisateur ; conformité normative à confirmer.",
    } : combination),
  });
  const updateMassFactor = (patternId: string, value: number) => onChange({
    ...program,
    massSource: { ...program.massSource, patternFactors: { ...program.massSource.patternFactors, [patternId]: value }, status: "provisional" },
  });
  const warnings = diagnostics.filter(item=>item.severity === "warning");
  return <details className="rounded-lg border border-[#dce7eb] bg-white p-3 text-[10px] text-[#3d4b50]">
    <summary className="cursor-pointer font-bold text-[#27358f]">Cas de charges, combinaisons et source de masse — {program.cases.length} cas / {program.combinations.filter(item=>item.enabled).length} combinaisons actives</summary>
    <div className="mt-2 space-y-2">
      <div className="rounded bg-[#fff5e8] p-2 text-[#8a5a21]">
        <b>Statut pré-étude.</b> Référentiel déclaré : {projectNorm || program.selectedStandard}. Les coefficients sont provisoires et non vérifiés pour une annexe nationale. G/Q proviennent de la descente tributaire ; les autres valeurs saisies sont des résultantes globales non distribuées spatialement et ne constituent pas des cas dimensionnants.
      </div>
      <div className="space-y-1">
        <div className="font-semibold">Actions / patterns</div>
        {program.patterns.filter(pattern => pattern.enabled).map(pattern => {
          const value = patternValues[pattern.id] ?? pattern.value;
          return <div key={pattern.id} className="grid grid-cols-[1fr_90px] items-center gap-2 rounded border border-[#edf1f1] p-2">
            <div><b>{pattern.name}</b><div className="text-[9px] text-[#74858c]">{pattern.source} · {pattern.status}{pattern.selfWeightMultiplier ? ` · poids propre × ${pattern.selfWeightMultiplier}` : ""}</div></div>
            <div className="text-right font-semibold">{value.toFixed(2)} kN</div>
          </div>;
        })}
      </div>
      <div className="grid gap-1 rounded border border-[#edf1f1] p-2">
        <div className="font-semibold">Source de masse : {evaluation.massTonnes.toFixed(3)} t équivalentes</div>
        <div className="text-[9px] text-[#74858c]">Σ poids des actions × fractions de masse ÷ g ; statut {program.massSource.status}. Fraction Q provisoire, à confirmer selon l’usage et la norme.</div>
        <label className="flex items-center gap-2">Fraction de Q incluse dans la masse
          <input className="h-7 w-20 rounded border px-1" type="number" min="0" max="1" step="0.05" value={program.massSource.patternFactors.Q ?? 0} onChange={event=>updateMassFactor("Q",Number(event.target.value))} />
        </label>
      </div>
      <div className="space-y-1">
        <div className="font-semibold">Combinaisons — valeurs globales indicatives</div>
        {evaluation.combinations.filter(item=>item.enabled).map(result=>{
          const combination=program.combinations.find(item=>item.id===result.id)!;
          return <details key={result.id} className="rounded border border-[#edf1f1] p-2">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2"><span><b>{result.name}</b> · {combination.status}</span><span className="font-bold">{result.value.toFixed(2)} kN</span></summary>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {Object.entries(combination.caseFactors).map(([caseId,factor])=>{
                const analysisCase=program.cases.find(item=>item.id===caseId);
                return <label key={caseId} className="flex items-center justify-between gap-1 text-[9px]">{analysisCase?.name ?? caseId}
                  <input className="h-7 w-16 rounded border px-1 text-right" type="number" step="0.05" value={factor} onChange={event=>updateCombinationFactor(combination.id,caseId,Number(event.target.value))} />
                </label>;
              })}
            </div>
            <div className="mt-1 text-[9px] text-[#8a5a21]">{combination.note}</div>
          </details>;
        })}
      </div>
      {evaluation.governing && <div className="rounded bg-[#eef0f8] p-2 text-[#27358f]">Combinaison gouvernante en valeur absolue : <b>{evaluation.governing.name}</b> · {evaluation.governing.value.toFixed(2)} kN <span className="text-[9px]">(pré-étude globale, pas un effort interne)</span></div>}
      {warnings.slice(0,3).map((item,index)=><div key={`${item.code}-${index}`} className="rounded bg-[#fff5e8] p-2 text-[#8a5a21]">{item.message}</div>)}
      {diagnostics.some(item=>item.severity==="error") && diagnostics.filter(item=>item.severity==="error").map((item,index)=><div key={`${item.code}-${index}`} className="rounded bg-[#fff1ed] p-2 text-[#914d3d]">{item.message}</div>)}
    </div>
  </details>;
}


function SurfaceMeshPreview({ analysis }: { analysis: SurfaceAnalysis }) {
  const mesh = analysis.mesh;
  if (!mesh || !mesh.triangles.length) return <div className="rounded bg-[#f6f9fc] p-2 text-[9px] text-[#718083]">Aucun triangle valide à afficher.</div>;
  const xs = mesh.nodes.map(node => node.xM), ys = mesh.nodes.map(node => node.yM);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const width = Math.max(maxX - minX, 1e-8), height = Math.max(maxY - minY, 1e-8);
  const x = (value: number) => 10 + (value - minX) / width * 280;
  const y = (value: number) => 160 - (value - minY) / height * 140;
  const nodeById = new Map(mesh.nodes.map(node => [node.id, node]));
  const deflectionByNode = new Map(analysis.plate?.nodeResults.map(result => [result.nodeId, Math.abs(result.deflectionM)]) ?? []);
  const maxDeflection = Math.max(1e-12, ...Array.from(deflectionByNode.values()));
  return <svg viewBox="0 0 300 180" role="img" aria-label="Maillage triangulaire de la surface" className="h-36 w-full rounded border bg-[#fbfdfd]">
    {mesh.triangles.map(triangle => {
      const points = triangle.nodeIds.map(id => nodeById.get(id)).filter((node): node is NonNullable<typeof node> => Boolean(node));
      if (points.length !== 3) return null;
      const averageDeflection = points.reduce((sum, node) => sum + (deflectionByNode.get(node.id) ?? 0), 0) / 3;
      const opacity = analysis.plate ? 0.12 + 0.58 * averageDeflection / maxDeflection : 0.12;
      return <polygon key={triangle.id} points={points.map(node => `${x(node.xM)},${y(node.yM)}`).join(" ")} fill={`rgba(8,127,127,${opacity.toFixed(3)})`} stroke="#69aaa4" strokeWidth="0.45" />;
    })}
    <text x="10" y="174" className="fill-[#51666a] text-[7px]">{analysis.plate ? "Couleur : amplitude de flèche (non déformée à l’échelle)" : "Maillage et trémies — aucun résultat de flèche calculé"}</text>
  </svg>;
}


type ClimateActionPanelProps = {
  draft: ClimateDraft;
  onDraftChange: (next: ClimateDraft) => void;
  result: ClimateActionsResult | null;
  onRun: () => void;
  storyLabels: string[];
  massTonnes: number;
  massSourceNote: string;
  regulatoryStatus: string;
  onExport: (details?: string) => void;
};

function ClimateNumberField({ label, value, unit, step = "any", onChange, sourceStatus }: { label: string; value: string; unit: string; step?: string; onChange: (value: string) => void; sourceStatus: string }) {
  return <label className="grid gap-0.5 rounded border border-[#e5ecef] bg-white p-2">
    <span className="font-semibold">{label} <span className="font-normal text-[#77888d]">({unit})</span></span>
    <Input aria-label={label} type="number" step={step} value={value} onChange={event => onChange(event.target.value)} className="h-8 text-[10px]" />
    <small className="text-[8px] text-[#77888d]">{value.trim() ? sourceStatus : "À confirmer — valeur manquante"}</small>
  </label>;
}

function ClimateActionPanel({ draft, onDraftChange, result, onRun, storyLabels, massTonnes, massSourceNote, regulatoryStatus, onExport }: ClimateActionPanelProps) {
  const update = (patch: Partial<ClimateDraft>) => onDraftChange({ ...draft, ...patch });
  const updateWind = (key: keyof ClimateDraft["wind"], value: string) => update({ wind: { ...draft.wind, [key]: value } });
  const updateSnow = (key: keyof ClimateDraft["snow"], value: string) => update({ snow: { ...draft.snow, [key]: value } });
  const updateSeismic = (key: keyof ClimateDraft["seismic"], value: string) => update({ seismic: { ...draft.seismic, [key]: value } });
  const updateStoryStiffness = (index: number, value: string) => update({ seismic: { ...draft.seismic, storyStiffnessKnPerM: draft.seismic.storyStiffnessKnPerM.map((current, item) => item === index ? value : current) } });
  const dataStatus = draft.sourceClaim === "official" && draft.sourceReference.trim() ? "Source officielle déclarée — référence à vérifier" : "Saisie utilisateur / provisoire";
  const spectrumParse = parseClimateSpectrum(draft.seismic.spectrumText);
  const requiredOfficial = [draft.altitudeM, draft.terrainCategory, draft.wind.basicSpeedMPerS, draft.wind.exposureFactor, draft.wind.orographyFactor, draft.wind.topographyFactor, draft.wind.netPressureCoefficientX, draft.wind.netPressureCoefficientY, draft.snow.groundLoadKnM2, draft.snow.shapeCoefficient, draft.snow.exposureCoefficient, draft.snow.thermalCoefficient, draft.seismic.zone, draft.seismic.soilClass, draft.seismic.importanceClass, draft.seismic.designLifeYears, draft.seismic.referenceAccelerationG, draft.seismic.importanceFactor, draft.seismic.behaviourFactor, draft.seismic.dampingFactor, ...draft.seismic.storyStiffnessKnPerM];
  const allRequiredEntered = requiredOfficial.every(value => value.trim() !== "") && spectrumParse.errors.length === 0;
  const reportReady = Boolean(result && result.errors.length === 0 && allRequiredEntered && draft.sourceClaim === "official" && draft.sourceReference.trim() && (regulatoryStatus === "national" || regulatoryStatus === "adopted"));
  const regulatoryReason = !draft.sourceReference.trim() ? "Référence documentaire officielle absente." : draft.sourceClaim !== "official" ? "Les données sont encore déclarées comme saisies utilisateur." : !allRequiredEntered ? "Au moins un paramètre, une raideur d’étage ou un point de spectre est incomplet." : result?.errors.length ? "Les contrôles climatiques, de masse ou de spectre comportent des erreurs." : regulatoryStatus !== "national" && regulatoryStatus !== "adopted" ? "Le référentiel national/annexe n’est pas confirmé dans le profil du projet." : "Les méthodes latérales v1 restent simplifiées et non validées pour un document réglementaire signé.";
  const canExportPreStudy = Boolean(result && result.wind.errors.length === 0 && result.snow.errors.length === 0);
  const exportPreStudy = () => {
    if (!result) return;
    const lines = [
      "ACTIONS CLIMATIQUES — PRÉ-ÉTUDE, NON RÉGLEMENTAIRE",
      `Projet / site : ${draft.sourceReference || "source documentaire non renseignée"}`,
      `Origine déclarée : ${dataStatus}`,
      `Vent : qref ${result.wind.referencePressureKnM2.toFixed(3)} kN/m² ; X± ${result.wind.totalsKn.xPlus.toFixed(2)} kN ; Y± ${result.wind.totalsKn.yPlus.toFixed(2)} kN`,
      ...result.wind.stories.map(story => `Vent étage ${story.storyIndex + 1}: X± ${story.xPlusKn.toFixed(2)} kN ; Y± ${story.yPlusKn.toFixed(2)} kN`),
      `Neige toiture : ${result.snow.roofPressureKnM2.toFixed(3)} kN/m² ; total symétrique ${result.snow.totalKn.toFixed(2)} kN`,
      `Neige dissymétrique X haute/basse : ${result.snow.asymmetricX.highHalfKn.toFixed(2)}/${result.snow.asymmetricX.lowHalfKn.toFixed(2)} kN`,
      `Neige dissymétrique Y haute/basse : ${result.snow.asymmetricY.highHalfKn.toFixed(2)}/${result.snow.asymmetricY.lowHalfKn.toFixed(2)} kN`,
      `Masse sismique issue du registre existant : ${result.seismic.totalMassTonnes.toFixed(3)} t (source globale déclarée ${massTonnes.toFixed(3)} t ; ${massSourceNote})`,
      `Cisaillement de base modal SRSS : ${result.seismic.baseShearKn.toFixed(2)} kN`,
      ...result.seismic.modes.map(mode => `Mode ${mode.mode}: T=${mode.periodS.toFixed(3)} s ; masse effective=${mode.effectiveMassTonnes.toFixed(3)} t ; participation cumulée=${(mode.cumulativeMassParticipation * 100).toFixed(1)} %`),
      ...result.seismic.stories.map(story => `Étage ${story.storyIndex + 1}: F=${story.lateralForceKn.toFixed(2)} kN ; V=${story.storyShearKn.toFixed(2)} kN ; déplacement=${(story.displacementM * 1000).toFixed(2)} mm ; dérive=${(story.driftRatio * 100).toFixed(3)} %`),
      "Avertissement : calcul paramétrique simplifié; aucune vérification de zone, annexe nationale, torsion, diaphragme, irrégularité, P-Δ ou dimensionnement. Validation obligatoire par ingénieur.",
      ...(result.errors.length ? ["Erreurs / sections bloquées :", ...result.errors] : []),
      ...result.warnings.map(message => `Avertissement : ${message}`),
    ];
    onExport(lines.join("\n"));
  };
  return <div className="space-y-2 rounded-lg border border-[#d8c9f0] bg-[#f8f5fc] p-3 text-[10px] text-[#4b3d68]">
    <div className="font-bold text-[#563695]">Vent, neige et séisme — actions par niveau</div>
    <div className="rounded bg-white p-2 text-[9px] text-[#715f38]">Pré-étude paramétrique : aucune vitesse, zone, classe de sol ou coefficient réglementaire n’est déduit du seul nom de ville. Fournir les données locales et leur document source. Les résultats restent non réglementaires tant que le référentiel, l’annexe nationale et la méthode latérale ne sont pas vérifiés.</div>
    <div className="grid grid-cols-2 gap-2">
      <label className="grid gap-1">Origine déclarée des données
        <select aria-label="Origine déclarée des données climatiques" className="h-8 rounded border bg-white px-2" value={draft.sourceClaim} onChange={event => update({ sourceClaim: event.target.value as ClimateDraft["sourceClaim"] })}><option value="user-input">Saisie utilisateur — à confirmer</option><option value="official">Document officiel consulté par l’utilisateur</option></select>
      </label>
      <label className="grid gap-1">Document, édition, clause, autorité
        <Input aria-label="Référence officielle des paramètres climatiques" value={draft.sourceReference} onChange={event => update({ sourceReference: event.target.value })} placeholder="Ex. annexe nationale / carte / étude de sol" className="h-8 text-[9px]" />
      </label>
    </div>
    <div className="rounded bg-white p-2">Pays / ville / site du projet : <b>{draft.seismic.zone ? "données géographiques du projet" : "à confirmer"}</b> · altitude : {draft.altitudeM || "—"} m · statut source : <b>{dataStatus}</b></div>
    <details open className="rounded border border-[#e5dff0] bg-white p-2">
      <summary className="cursor-pointer font-semibold">Vent — paramètres et façades</summary>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <ClimateNumberField label="Altitude du site" value={draft.altitudeM} unit="m" onChange={value => update({ altitudeM: value })} sourceStatus={dataStatus} />
        <label className="grid gap-0.5 rounded border border-[#e5dff0] bg-white p-2">Catégorie de terrain
          <input aria-label="Catégorie de terrain pour le vent" className="h-8 rounded border px-2 text-[10px]" value={draft.terrainCategory} onChange={event => update({ terrainCategory: event.target.value })} placeholder="Référence du code local" />
          <small className="text-[8px] text-[#77888d]">{draft.terrainCategory ? dataStatus : "À confirmer"}</small>
        </label>
        <ClimateNumberField label="Vitesse de base" value={draft.wind.basicSpeedMPerS} unit="m/s" onChange={value => updateWind("basicSpeedMPerS", value)} sourceStatus={dataStatus} />
        <ClimateNumberField label="Facteur d’exposition Cₑ" value={draft.wind.exposureFactor} unit="—" onChange={value => updateWind("exposureFactor", value)} sourceStatus={dataStatus} />
        <ClimateNumberField label="Facteur d’orographie Cₒ" value={draft.wind.orographyFactor} unit="—" onChange={value => updateWind("orographyFactor", value)} sourceStatus={dataStatus} />
        <ClimateNumberField label="Facteur topographique Cₜ" value={draft.wind.topographyFactor} unit="—" onChange={value => updateWind("topographyFactor", value)} sourceStatus={dataStatus} />
        <ClimateNumberField label="Coefficient net de pression X" value={draft.wind.netPressureCoefficientX} unit="—" onChange={value => updateWind("netPressureCoefficientX", value)} sourceStatus={dataStatus} />
        <ClimateNumberField label="Coefficient net de pression Y" value={draft.wind.netPressureCoefficientY} unit="—" onChange={value => updateWind("netPressureCoefficientY", value)} sourceStatus={dataStatus} />
        <ClimateNumberField label="Densité de l’air" value={draft.wind.airDensityKgM3} unit="kg/m³" onChange={value => updateWind("airDensityKgM3", value)} sourceStatus={draft.wind.airDensityKgM3 === "1.225" ? "Provisoire — valeur générique" : dataStatus} />
      </div>
      {result && <div className="mt-2 space-y-1 rounded bg-[#f7faff] p-2">
        {result.wind.errors.map((message, index) => <div key={`wind-error-${index}`} className="text-[#914d3d]">Vent bloqué · {message}</div>)}
        {!result.wind.errors.length && <><div>qref = <b>{result.wind.referencePressureKnM2.toFixed(3)} kN/m²</b> · totaux X± {result.wind.totalsKn.xPlus.toFixed(2)} kN · Y± {result.wind.totalsKn.yPlus.toFixed(2)} kN</div>
          <div className="grid grid-cols-[1fr_repeat(4,1fr)] gap-1 border-b pb-1 font-semibold"><span>Étage</span><span>X + kN</span><span>X − kN</span><span>Y + kN</span><span>Y − kN</span></div>
          {result.wind.stories.map(story => <div key={`wind-${story.storyIndex}`} className="grid grid-cols-[1fr_repeat(4,1fr)] gap-1"><span>{storyLabels[story.storyIndex] ?? `Étage ${story.storyIndex + 1}`}</span><span>{story.xPlusKn.toFixed(1)}</span><span>{story.xMinusKn.toFixed(1)}</span><span>{story.yPlusKn.toFixed(1)}</span><span>{story.yMinusKn.toFixed(1)}</span></div>)}</>}
      </div>}
    </details>
    <details className="rounded border border-[#e5dff0] bg-white p-2">
      <summary className="cursor-pointer font-semibold">Neige — toiture, coefficients et dissymétrie</summary>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <ClimateNumberField label="Charge de neige au sol" value={draft.snow.groundLoadKnM2} unit="kN/m²" onChange={value => updateSnow("groundLoadKnM2", value)} sourceStatus={dataStatus} />
        <ClimateNumberField label="Coefficient de forme μ" value={draft.snow.shapeCoefficient} unit="—" onChange={value => updateSnow("shapeCoefficient", value)} sourceStatus={dataStatus} />
        <ClimateNumberField label="Coefficient d’exposition Cₑ" value={draft.snow.exposureCoefficient} unit="—" onChange={value => updateSnow("exposureCoefficient", value)} sourceStatus={dataStatus} />
        <ClimateNumberField label="Coefficient thermique Cₜ" value={draft.snow.thermalCoefficient} unit="—" onChange={value => updateSnow("thermalCoefficient", value)} sourceStatus={dataStatus} />
        <ClimateNumberField label="Ratio de dissymétrie" value={draft.snow.asymmetryRatio} unit="0–1" onChange={value => updateSnow("asymmetryRatio", value)} sourceStatus={draft.snow.asymmetryRatio === "0" ? "Provisoire — symétrie supposée" : dataStatus} />
      </div>
      {result && <div className="mt-2 rounded bg-[#f7faff] p-2">
        {result.snow.errors.map((message, index) => <div key={`snow-error-${index}`} className="text-[#914d3d]">Neige bloquée · {message}</div>)}
        {!result.snow.errors.length && <div>Toiture : {result.snow.roofPressureKnM2.toFixed(3)} kN/m² · total {result.snow.totalKn.toFixed(2)} kN · demi-zones X forte/faible {result.snow.asymmetricX.highHalfKn.toFixed(2)}/{result.snow.asymmetricX.lowHalfKn.toFixed(2)} kN · Y {result.snow.asymmetricY.highHalfKn.toFixed(2)}/{result.snow.asymmetricY.lowHalfKn.toFixed(2)} kN</div>}
      </div>}
    </details>
    <details className="rounded border border-[#e5dff0] bg-white p-2">
      <summary className="cursor-pointer font-semibold">Séisme — masse, spectre, modes et dérives</summary>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="grid gap-0.5 rounded border border-[#e5ecef] p-2">Zone sismique<input aria-label="Zone sismique" className="h-8 rounded border px-2 text-[10px]" value={draft.seismic.zone} onChange={event => updateSeismic("zone", event.target.value)} /></label>
        <label className="grid gap-0.5 rounded border border-[#e5ecef] p-2">Classe de sol<input aria-label="Classe de sol" className="h-8 rounded border px-2 text-[10px]" value={draft.seismic.soilClass} onChange={event => updateSeismic("soilClass", event.target.value)} /></label>
        <label className="grid gap-0.5 rounded border border-[#e5ecef] p-2">Classe d’importance<input aria-label="Classe d’importance sismique" className="h-8 rounded border px-2 text-[10px]" value={draft.seismic.importanceClass} onChange={event => updateSeismic("importanceClass", event.target.value)} /></label>
        <ClimateNumberField label="Durée de vie de projet" value={draft.seismic.designLifeYears} unit="années" onChange={value => updateSeismic("designLifeYears", value)} sourceStatus={dataStatus} />
        <ClimateNumberField label="Accélération de référence" value={draft.seismic.referenceAccelerationG} unit="g" onChange={value => updateSeismic("referenceAccelerationG", value)} sourceStatus={dataStatus} />
        <ClimateNumberField label="Facteur d’importance γI" value={draft.seismic.importanceFactor} unit="—" onChange={value => updateSeismic("importanceFactor", value)} sourceStatus={dataStatus} />
        <ClimateNumberField label="Facteur de comportement q" value={draft.seismic.behaviourFactor} unit="—" onChange={value => updateSeismic("behaviourFactor", value)} sourceStatus={dataStatus} />
        <ClimateNumberField label="Correction d’amortissement" value={draft.seismic.dampingFactor} unit="—" onChange={value => updateSeismic("dampingFactor", value)} sourceStatus={dataStatus} />
      </div>
      <div className="mt-2 grid gap-2">
        <label className="grid gap-1">Spectre de réponse fourni par le projet — une ligne par point <span className="text-[8px] text-[#77888d]">T(s); Sa/g · interpolation linéaire sans extrapolation</span>
          <textarea aria-label="Points du spectre sismique" value={draft.seismic.spectrumText} onChange={event => updateSeismic("spectrumText", event.target.value)} placeholder="0;0.25\n0.2;0.60\n1.0;0.15" className="min-h-20 rounded border p-2 font-mono text-[9px]" />
        </label>
        {spectrumParse.errors.map((message, index) => <div key={`spectrum-input-error-${index}`} className="text-[9px] text-[#914d3d]">{message}</div>)}
        <div className="font-semibold">Raideur latérale équivalente saisie par étage — kN/m</div>
        {storyLabels.map((label, index) => <ClimateNumberField key={`stiffness-${index}`} label={`${label} — raideur d’étage`} value={draft.seismic.storyStiffnessKnPerM[index] ?? ""} unit="kN/m" onChange={value => updateStoryStiffness(index, value)} sourceStatus={dataStatus} />)}
      </div>
      <div className="mt-2 rounded bg-[#f7faff] p-2 text-[9px]">Masse source globale actuelle : <b>{massTonnes.toFixed(3)} t</b> · {massSourceNote}. Répartition par niveau dérivée des lignes G/Q déjà calculées; une action globale non affectée à un niveau bloque l’analyse modale.</div>
      {result && <div className="mt-2 space-y-1 rounded bg-[#f7faff] p-2">
        {result.seismic.errors.map((message, index) => <div key={`seismic-error-${index}`} className="text-[#914d3d]">Séisme bloqué · {message}</div>)}
        {!result.seismic.errors.length && <>
          <div>Masse calculée par étages : {result.seismic.totalMassTonnes.toFixed(3)} t · cisaillement de base SRSS {result.seismic.baseShearKn.toFixed(2)} kN</div>
          <div className="grid grid-cols-[40px_1fr_1fr_1fr] gap-1 border-b pb-1 font-semibold"><span>Mode</span><span>T (s)</span><span>Masse effective</span><span>Participation cumulée</span></div>
          {result.seismic.modes.map(mode => <div key={`mode-${mode.mode}`} className="grid grid-cols-[40px_1fr_1fr_1fr] gap-1"><span>{mode.mode}</span><span>{mode.periodS.toFixed(3)}</span><span>{mode.effectiveMassTonnes.toFixed(2)} t</span><span>{(mode.cumulativeMassParticipation * 100).toFixed(1)} %</span></div>)}
          <div className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-1 border-b pb-1 pt-1 font-semibold"><span>Étage</span><span>F / V kN</span><span>Déplacement mm</span><span>Dérive</span></div>
          {result.seismic.stories.map(story => <div key={`seismic-story-${story.storyIndex}`} className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-1"><span>{storyLabels[story.storyIndex] ?? `Étage ${story.storyIndex + 1}`}</span><span>{story.lateralForceKn.toFixed(1)} / {story.storyShearKn.toFixed(1)}</span><span>{(story.displacementM * 1000).toFixed(2)}</span><span>{(story.driftRatio * 100).toFixed(3)} %</span></div>)}
        </>}
        {result.seismic.warnings.map((message, index) => <div key={`seismic-warning-${index}`} className="text-[#8a5a21]">Avertissement · {message}</div>)}
      </div>}
    </details>
    <div className="flex flex-wrap gap-2">
      <Button type="button" className="h-8 bg-[#563695] px-3 text-[9px] text-white" onClick={onRun}>Générer / actualiser les actions</Button>
      <Button type="button" variant="outline" disabled={!canExportPreStudy} className="h-8 bg-white text-[9px]" onClick={exportPreStudy}>Exporter le bilan climatique de pré-étude</Button>
    </div>
    {result && <div className="rounded bg-white p-2 text-[9px]">Les patterns vent X/Y, neige et séisme sont transmis au registre existant; les combinaisons signées s’y recalculent. Origines conservées sur chaque action: {dataStatus} · {draft.sourceReference || "référence absente"}.</div>}
    <div className="rounded border border-[#e7c5bd] bg-[#fff4f0] p-2 text-[9px] text-[#914d3d]">Rapport réglementaire : <b>bloqué</b> — {regulatoryReason} Même avec des données complètes, les résultats restent préliminaires tant que le spectre, les dérives, le modèle latéral global et le référentiel/annexe ne sont pas vérifiés et approuvés par un ingénieur. {reportReady ? "Données de saisie complètes détectées, mais la méthode v1 empêche encore un rapport réglementaire signé." : "Les paramètres manquants ou non sourcés empêchent également toute conclusion réglementaire."}</div>
  </div>;
}
