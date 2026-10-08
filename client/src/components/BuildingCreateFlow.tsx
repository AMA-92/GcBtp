import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Building2,
  Calculator,
  ChevronLeft,
  Copy,
  Download,
  Grid3X3,
  History,
  MoreHorizontal,
  PersonStanding,
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
import {
  CONCRETE_CLASSES,
  DEFAULT_PROJECT_MATERIALS,
  getCountryProjectStandard,
  getProjectMaterialSummary,
  getProjectStandardId,
  normalizeProjectMaterials,
  PROJECT_COUNTRIES,
  PROJECT_STANDARD_CATALOG,
  REINFORCEMENT_STEEL_CATALOG,
  STRUCTURAL_STEEL_CATALOG,
  type ProjectMaterialSelection,
  type ProjectStandard,
  type ProjectStandardId,
} from "@shared/project-catalogs";
import { getFrenchCalculationBasisLabel, normalizeProjectStandard } from "@shared/french-standard-profile";
import {
  restoreBuildingDraft,
  serializeBuildingDraft,
  validateBuildingName,
} from "@shared/building-flow";
import { proposeSoil } from "@shared/site-soil";
import { footingCenterOffset, normalizeFootingEccentricAxes, type FootingDirectionSelection, type FootingEccentricAxes, type FootingLayoutMode } from "@shared/footing-geometry";
import {
  moveElement,
  removeElement,
  updateElement,
} from "@shared/building-elements";
import {
  defaultFloorConfig,
  defaultBalconyFloorConfig,
  isSlabElementType,
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
  GRID_UNITS_PER_METER,
} from "@shared/proportional-grid";
import { floorTopElevation, levelIndexShift } from "@shared/vertical-structure";
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
import { meshAnalyticalSurfaces } from "@shared/analytical-surface-mesh";
import { createDefaultLoadProgram, evaluateLoadProgram, normalizeLoadProgram, validateLoadProgram, type LoadProgram } from "@shared/load-case-program";
import { FRENCH_PROJECT_USAGE_CATALOG, type FrenchProjectUsage } from "@shared/french-load-catalog";
import { buildGravityMemberLoads, solveAnalyticalPlane, type FramePlane, type PlaneFrameResult } from "@shared/frame-solver-2d";
import { solveGlobal3D, type Spatial3DStoryLateralLoad, type Spatial3DResult } from "@shared/frame-solver-3d";
import { runProfessionalAnalysis } from "@shared/professional-analysis";
import { analyzeCantileverRectangularPlate, analyzeOneWayOrthotropicRectangularPlate, analyzeSimplySupportedRectangularPlate, checkRectangularSurfaceEdgeSupports, meshRectangularSurface, SURFACE_ANALYSIS_SCHEMA_VERSION, type RectangularOpening, type RectangularSurfaceEdge, type SurfaceAnalysis } from "@shared/surface-analysis";
import { resolveFloorPlateStiffness } from "@shared/plate-stiffness";
import { deriveStoryMassesFromCumulativeLoads, generateClimateActions, parseClimateSpectrum, type ClimateActionInput, type ClimateActionsResult, type ClimateFieldSource } from "@shared/climate-actions";
import { deriveRCMemberDemandsFromPlane, deriveRCMemberDemandsFromSpatial, type RCDesignResult, type RCMemberDemand, type RCSlabDemand, type RCFootingDemand, type RCStairDemand } from "@shared/rc-design";
import { formatHACatalogArea } from "@shared/ha-bar-areas";
import { calculateStairPermanentLoad } from "@shared/stair-load";
import { mapFoundationReactions } from "@shared/foundation-reaction";
import { EMPTY_PROJECT_GEOTECHNICAL_PROFILE, normalizeProjectGeotechnicalProfile, type ProjectGeotechnicalProfile } from "@shared/geotechnical-profile";
import { copyCatalogToProject, DEFAULT_GEOTECHNICAL_CATALOG_ID, GEOTECHNICAL_CATALOG_COUNTRIES, getGeotechnicalCatalogProfile, getGeotechnicalCatalogProfiles } from "@shared/geotechnical-catalog";
import { validateStructuralModel, type StructuralValidationResult } from "@shared/structural-validation";
import type { WallDemand } from "@shared/wall-design";
import ReinforcedConcretePanel from "@/components/ReinforcedConcretePanel";
import FoundationReactionPanel, { type FoundationPanelEvaluation } from "@/components/FoundationReactionPanel";
import { createStructuralPassport, createStructuralReport, renderStructuralPassport, renderStructuralReport } from "@shared/structural-report";
import { downloadElementsReportPdf } from "@shared/local-pdf";
import { loadReinforcementTemplate, saveReinforcementTemplate, type ReinforcementTemplate } from "@shared/reinforcement-report";
import { createBuildingProjectBundle, loadBuildingProjectHistory, loadBuildingProjects, parseBuildingProjectBundle, removeBuildingProject, saveBuildingProject, serializeBuildingProjectBundle, type BuildingProjectSnapshot } from "@shared/building-persistence";
import { supabase } from "@/lib/supabase";
import { deleteCloudBuildingProject, loadAccountBuildingProjectCache, loadCloudBuildingProjects, loadLegacyProjectsForAccount, removeAccountBuildingProjectCache, saveAccountBuildingProjectCache, saveCloudBuildingProject } from "@/lib/building-cloud";

const scopedSessionKey = (key: string, accountId: string | null) => `${key}:account:${accountId ?? "local"}`;

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
  kind?: "foundation" | "habitation" | "edicule" | "technical";
  elements: ElementItem[];
};
type GridPoint = { x: number; y: number };
type SurfaceRunRow = { elementId: string; levelLabel: string; areaM2: number; openingCount: number; spanXM: number; spanYM: number; spanDirection: "X" | "Y"; thicknessMm: number; uniformLoadKnM2: number; columnWidthMm: number; columnDepthMm: number; negativeMxKnMPerM: number; negativeMyKnMPerM: number; floorType: FloorConfig["type"]; analysis: SurfaceAnalysis; supportErrors: string[] };
type LoadApplicationReport = {
  errors: string[];
  warnings: string[];
  surfaceRows: Array<{ id: string; loadName: string; sourceType: string; kind: string; areaM2: number; gkKnM2: number; qkKnM2: number; gk: number; qk: number; transferred: boolean }>;
  skeletonRows: Array<{ id: string; loadName: string; type: string; gk: number; qk: number; sources: string[] }>;
  combinationRows: Array<{ id: string; name: string; category: string; formula: string; status: string; lineLoadCount: number }>;
  lineLoadCount: number;
};
type ColumnVerificationLoad = { id: string; category: string; label: string; axialKn: string };
type ColumnVerificationGeometry = { shape: "rectangular" | "circular"; widthM: string; depthM: string; diameterM: string; heightM: string; levelId: string; selfWeight: boolean; dirty: boolean };
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
  // La copie conserve le même intervalle vertical relatif :
  // Fondation→RDC devient RDC→R+1, puis R+1→R+2, etc.
  const levelShift = levelIndexShift(levels, sourceLevelId, targetLevelId);
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
const metricGridAxisPositions = (xDistances: Array<string | number | undefined>, yDistances: Array<string | number | undefined>, xCount: number, yCount: number, gridDistance: string | number | undefined) => {
  const fallback = numericGridDistance(gridDistance);
  return {
    xAxisPositionsM: cumulativeGridPositions(xDistances.map(value => numericGridDistance(value, fallback)), xCount),
    yAxisPositionsM: cumulativeGridPositions(yDistances.map(value => numericGridDistance(value, fallback)), yCount),
  };
};
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
const freezeStairGeometry = (geometry: StairGeometry | undefined, xPositions: number[], yPositions: number[]): StairGeometry["absolute"] => {
  if (!geometry) return undefined;
  if (geometry.absolute) return geometry.absolute;
  const freezePoint = (point?: GridPoint) => point
    ? { x: indexToMetric(point.x, xPositions), y: indexToMetric(point.y, yPositions) }
    : undefined;
  const freezeFlight = (flight?: StairFlightGeometry) => flight
    ? { ...flight, lowerA: freezePoint(flight.lowerA)!, lowerB: freezePoint(flight.lowerB)!, upperA: freezePoint(flight.upperA)!, upperB: freezePoint(flight.upperB)! }
    : undefined;
  return {
    flight1: freezeFlight(geometry.flight1),
    flight2: freezeFlight(geometry.flight2),
    baseA: freezePoint(geometry.baseA),
    baseB: freezePoint(geometry.baseB),
    midA: freezePoint(geometry.midA),
    midB: freezePoint(geometry.midB),
    topA: freezePoint(geometry.topA),
    topB: freezePoint(geometry.topB),
    landingZ: geometry.landingZ,
  };
};
const metricToIndex = (metric: number, positions: number[]) => {
  if (!positions.length) return metric;
  if (metric <= positions[0]) {
    const span = Math.max(positions[Math.min(1, positions.length - 1)] - positions[0], 0.01);
    return (metric - positions[0]) / span;
  }
  const last = positions.length - 1;
  if (metric >= positions[last]) {
    const span = Math.max(positions[last] - positions[Math.max(0, last - 1)], 0.01);
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
  if (metric <= nextPositions[0]) {
    const span = Math.max(nextPositions[Math.min(1, last)] - nextPositions[0], 0.01);
    return (metric - nextPositions[0]) / span;
  }
  if (metric >= nextPositions[last]) {
    const span = Math.max(nextPositions[last] - nextPositions[Math.max(0, last - 1)], 0.01);
    return last + (metric - nextPositions[last]) / span;
  }
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

type ColumnVerificationSnapshot = {
  savedAt: string;
  standard: string;
  sectionName: string;
  combinationId: string;
  combinationName: string;
  geometry: { shape: "rectangular" | "circular"; widthMm: number; depthMm: number; lengthMm: number; bucklingLengthMm: number };
  loads: { axialKn: number; momentXKnM: number; momentYKnM: number };
  reinforcement: Array<{ label: string; diameterMm: number; count: number; areaMm2: number; requiredAreaMm2: number }>;
  checks: Array<{ id: string; label: string; status: string; demand: number | null; resistance: number | null; utilization: number | null; unit: string; formula: string }>;
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
  columnVerificationSnapshot?: ColumnVerificationSnapshot;
  foundationMode?: FootingLayoutMode;
  foundationDirection?: FootingDirectionSelection;
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
  regulatoryCatalogId?: ProjectStandardId;
  materials?: ProjectMaterialSelection;
  optimizationLockedElementIds?: string[];
  soil?: ProjectGeotechnicalProfile;
};
type ProjectSettingsDraft = {
  country: string;
  city: string;
  location: string;
  structure: string;
  norm: ProjectStandard;
  regulatoryCatalogId: ProjectStandardId;
  materials: ProjectMaterialSelection;
};
type ProjectUsage = FrenchProjectUsage;
const PROJECT_USAGE_OPTIONS = Object.values(FRENCH_PROJECT_USAGE_CATALOG);
const usageProfile = (usage: ProjectUsage = "habitation") => FRENCH_PROJECT_USAGE_CATALOG[usage] ?? FRENCH_PROJECT_USAGE_CATALOG.habitation;
const LOAD_PROGRAM_STATUS_LABELS: Record<string, string> = { catalogued: "catalogué", ready: "validé", provisional: "à vérifier", calculated: "calculé", "default-provisional": "défaut provisoire", "to-confirm": "à confirmer", "user-input": "saisi" };
const loadProgramStatusLabel = (status: string) => LOAD_PROGRAM_STATUS_LABELS[status] ?? status;
const optionalGeotechnicalNumber = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};
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
    kind: "foundation",
    elements: [],
  },
  { id: "rdc", label: "RDC", elevation: "0.00", height: "3.20", kind: "habitation", elements: [] },
];
const normalizeProjectMetadata = (project: Project): Project => {
  const norm = normalizeProjectStandard(project.norm);
  const existingSoil = normalizeProjectGeotechnicalProfile(project.soil);
  const catalogDefault = getGeotechnicalCatalogProfiles(project.country)[0] ?? getGeotechnicalCatalogProfile(DEFAULT_GEOTECHNICAL_CATALOG_ID);
  const soil = existingSoil.catalogProfileId || existingSoil.bearingCapacityAdmissibleKPa !== null || existingSoil.source
    ? existingSoil
    : copyCatalogToProject(catalogDefault);
  return {
    ...project,
    norm,
    regulatoryCatalogId: getProjectStandardId(norm),
    soil,
    levels: project.levels.map(level => {
      const isEdicule = level.kind === "edicule" || /^(r\+3|édifice|edifice)$/i.test(level.label.trim());
      return { ...level, label: isEdicule ? "Édifice" : level.label, kind: isEdicule ? "edicule" : (level.kind ?? (level.id === "foundation" ? "foundation" : "habitation")) };
    }),
  };
};
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
  const [authResolved, setAuthResolved] = useState(false);
  const [cloudAccountId, setCloudAccountId] = useState<string | null>(null);
  useEffect(() => {
    setOptimizationLockedElementIds(new Set(selected?.optimizationLockedElementIds ?? []));
  }, [selected?.id, selected?.optimizationLockedElementIds]);
  const [projectsHydrated, setProjectsHydrated] = useState(false);
  const [persistenceStatus, setPersistenceStatus] = useState("Récupération locale…");
  const [autosaveRetry, setAutosaveRetry] = useState(0);
  const [conflictProjectId, setConflictProjectId] = useState<string | null>(null);
  const [projectHistory, setProjectHistory] = useState<BuildingProjectSnapshot<Project>[]>([]);
  const [projectPendingDeletion, setProjectPendingDeletion] = useState<Project | null>(null);
  const [projectDeletionInProgress, setProjectDeletionInProgress] = useState(false);
  const projectRevisions = useRef<Record<string, number>>({});
  const autosaveBlocked = useRef(new Set<string>());
  const autosaveInFlight = useRef(new Set<string>());
  const autosavePending = useRef(new Set<string>());
  const projectContents = useRef<Record<string, string>>({});
  const workspaceByProject = useRef<Record<string, BuildingWorkspaceSnapshot>>({});
  const projectImportInput = useRef<HTMLInputElement>(null);
  const activeAccountRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    let mounted = true;
    const activateAccount = (accountId: string | null) => {
      if (!mounted) return;
      if (activeAccountRef.current !== accountId) {
        const switchingExistingAccount = activeAccountRef.current !== undefined;
        activeAccountRef.current = accountId;
        setProjectsHydrated(false);
        setProjects([]);
        setSelected(null);
        setConflictProjectId(null);
        setProjectHistory([]);
        setProjectPendingDeletion(null);
        setProjectDeletionInProgress(false);
        setPanel(null);
        projectRevisions.current = {};
        projectContents.current = {};
        workspaceByProject.current = {};
        autosaveBlocked.current.clear();
        autosavePending.current.clear();
        if (switchingExistingAccount) {
          setXAxes(["1", "2", "3", "4"]);
          setYAxes(["A", "B", "C", "D"]);
          setZLevels(["Fondation -1.00 m", "RDC 0.00 m"]);
          setXDistances(["4.00", "4.00", "4.00"]);
          setYDistances(["4.00", "4.00", "4.00"]);
          setXNumbering("numeric");
          setYNumbering("alpha");
          setGridDistance("4.00");
          setLoads({ permanent: true, exploitation: true, wind: false, seismic: false });
          setAnalyticalTolerance(String(DEFAULT_NODE_MERGE_TOLERANCE_M));
          setCustomModels([]);
          setLoadProgram(createDefaultLoadProgram(norm, "habitation"));
          setClimateDraft(createClimateDraft());
          setClimateLoadedProjectId(null);
          setFloorConfig(defaultFloorConfig);
          setProjectUsage("habitation");
          setActiveLevelId("rdc");
          setThreeD(false);
          setModelType("Aucun");
          setModelSection("");
          setShowLabels(true);
          setGridOpacity("100");
          setSnapToGrid(true);
        }
        setPersistenceStatus(accountId ? "Récupération des projets de votre compte…" : "Récupération locale…");
      }
      setCloudAccountId(accountId);
      setAuthResolved(true);
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      activateAccount(session?.user.id ?? null);
    });
    void supabase.auth.getSession()
      .then(({ data }) => activateAccount(data.session?.user.id ?? null))
      .catch(() => activateAccount(null));
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    const retryWhenOnline = () => setAutosaveRetry(value => value + 1);
    window.addEventListener("online", retryWhenOnline);
    return () => window.removeEventListener("online", retryWhenOnline);
  }, []);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectUsage, setProjectUsage] = useState<ProjectUsage>("habitation");
  const [projectWizardStep, setProjectWizardStep] = useState<"identity" | "settings">("identity");
  const [projectSettingsDraft, setProjectSettingsDraft] = useState<ProjectSettingsDraft>(() => {
    const initialCity = getCitiesForCountry(country)[0]?.city ?? "";
    const initialNorm = getCountryProjectStandard(country, initialCity);
    return {
      country,
      city: initialCity,
      location: "",
      structure: "Béton armé",
      norm: initialNorm,
      regulatoryCatalogId: getProjectStandardId(initialNorm),
      materials: { ...DEFAULT_PROJECT_MATERIALS },
    };
  });
  const [activeLevelId, setActiveLevelId] = useState("rdc");
  const [showMenu, setShowMenu] = useState(false);
  const [showPersistenceMenu, setShowPersistenceMenu] = useState(false);
  const [panel, setPanel] = useState<string | null>(null);
  const [modelType, setModelType] = useState("Aucun");
  const [modelSection, setModelSection] = useState("");
  const [foundationPlacementMode, setFoundationPlacementMode] = useState<FootingLayoutMode>("centered");
  const [foundationPlacementDirection, setFoundationPlacementDirection] = useState<FootingEccentricAxes>({ x: "none", y: "none" });
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
  const [bulkSelectedElementIds, setBulkSelectedElementIds] = useState<string[]>([]);
  const [bulkElementType, setBulkElementType] = useState("Tous");
  const [bulkSection, setBulkSection] = useState("");
  const [bulkSectionPickerOpen, setBulkSectionPickerOpen] = useState(false);
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
  const [calculationExecuted, setCalculationExecuted] = useState(false);
  const [optimizationRecalcRequested, setOptimizationRecalcRequested] = useState(false);
  const [optimizationLockedElementIds, setOptimizationLockedElementIds] = useState<Set<string>>(new Set());
  const [analyticalModel, setAnalyticalModel] = useState<AnalyticalModel | null>(null);
  const [analyticalPrecheck, setAnalyticalPrecheck] = useState<AnalyticalPrecheck | null>(null);
  const [structuralValidation, setStructuralValidation] = useState<StructuralValidationResult | null>(null);
  const [buildingLoadModel, setBuildingLoadModel] = useState<ReturnType<typeof buildBuildingLoadModel> | null>(null);
  const [showCalculationPreflight, setShowCalculationPreflight] = useState(false);
  const [meshPrerequisiteReady, setMeshPrerequisiteReady] = useState(false);
  const [loadCasesPrerequisiteReady, setLoadCasesPrerequisiteReady] = useState(false);
  const [showMeshDetails, setShowMeshDetails] = useState(false);
  const [showLoadDetails, setShowLoadDetails] = useState(false);
  const [analyticalSurfaceMesh, setAnalyticalSurfaceMesh] = useState<ReturnType<typeof meshAnalyticalSurfaces> | null>(null);
  const [loadApplicationReport, setLoadApplicationReport] = useState<LoadApplicationReport | null>(null);
  const [reinforcementPlanRequestToken, setReinforcementPlanRequestToken] = useState(0);
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
  const [columnVerificationOpen, setColumnVerificationOpen] = useState(false);
  const [columnVerificationGeometry, setColumnVerificationGeometry] = useState<ColumnVerificationGeometry | null>(null);
  const [columnVerificationLoads, setColumnVerificationLoads] = useState<ColumnVerificationLoad[]>([]);
  const [columnVerificationRequested, setColumnVerificationRequested] = useState(false);
  const [columnVerificationFeedback, setColumnVerificationFeedback] = useState<string | null>(null);
  const [columnVerificationSavedKey, setColumnVerificationSavedKey] = useState<string | null>(null);
  const [showColumnBarCatalog, setShowColumnBarCatalog] = useState(false);
  const [columnVerificationLoadsDirty, setColumnVerificationLoadsDirty] = useState(false);
  const [columnVerificationSelectedBarDiameters, setColumnVerificationSelectedBarDiameters] = useState<number[]>([]);
  const [columnVerificationSelectedBarCount, setColumnVerificationSelectedBarCount] = useState<number | null>(null);
  const lastColumnVerificationNotice = useRef("");
  const [visualizationOptions, setVisualizationOptions] = useState({ efforts: false, moments: false, linearLoads: false, surfaceLoads: false });
  const [visualizationDraft, setVisualizationDraft] = useState({ efforts: false, moments: false, linearLoads: false, surfaceLoads: false });
  const [showStructureValuesMenu, setShowStructureValuesMenu] = useState(false);
  useEffect(() => {
    const massSourceConfirmed = loadProgram.massSource.status === "ready" || loadProgram.massSource.provenance === "confirmed";
    if (!massSourceConfirmed || !loadApplicationReport) return;
    const warnings = loadApplicationReport.warnings.filter(message => !/source de masse sismique reste une pré-étude/i.test(message));
    if (warnings.length === loadApplicationReport.warnings.length) return;
    setLoadApplicationReport({ ...loadApplicationReport, warnings });
    setLoadCasesPrerequisiteReady(loadApplicationReport.errors.length === 0 && warnings.length === 0);
  }, [loadProgram.massSource.status, loadProgram.massSource.provenance, loadApplicationReport]);
  const dragSnapshot = useRef<Project | null>(null);
  const beamTraceRef = useRef(false);
  const noteReportButtonRef = useRef<HTMLButtonElement | null>(null);
  const analysisRows = buildingCalculation?.rows ?? [];
  const loadProgramPatternValues = {
    ...Object.fromEntries(loadProgram.patterns.map(pattern => [pattern.id, pattern.value])),
    G: buildingCalculation?.totalGk ?? 0,
    Q: buildingCalculation?.totalQk ?? 0,
  };
  const loadProgramEvaluation = evaluateLoadProgram(loadProgram, loadProgramPatternValues);
  const loadProgramDiagnostics = validateLoadProgram(loadProgram);
  const analysisGroups = buildLoadSynthesis(analysisRows);
  const downloadElementsPdf = () => {
    if (!selected || !analysisRows.length) return toast.info("Lancez d’abord les calculs pour générer la liste des éléments.");
    const projectFileName = selected.name.replace(/\br\+/gi, "R+").trim();
    downloadElementsReportPdf("Note de calcul", [
      ["Projet", selected.name],
      ["Pays", selected.country || "non renseigné"],
      ["Ville", selected.city || "non renseignée"],
      ["Lieu", selected.location || "non renseigné"],
      ["Structure", selected.structure || "Béton armé"],
      ["Référentiel", selected.norm || norm],
    ], analysisRows.map(row => ({
      element: row.label,
      level: selected.levels.find(level => level.id === row.levelId)?.label ?? row.levelId,
      section: row.section ?? "—",
      g: row.gk,
      q: row.qk,
      nu: row.nu,
      nser: row.nser,
    })), `note de calcul ${projectFileName}`);
  };
  const rcMemberExtraction = useMemo(() => {
    const addLevelMetadata = (demand: RCMemberDemand): RCMemberDemand => {
      const levelIndex = selected?.levels.findIndex(level => level.elements.some(element => element.id === demand.id)) ?? -1;
      const level = levelIndex >= 0 ? selected?.levels[levelIndex] : undefined;
      const levelLabel = level?.label ?? "Niveau non renseigné";
      if (!demand.columnContext || levelIndex < 0 || !selected) return { ...demand, levelLabel };
      const columnLevels = selected.levels.flatMap((item, index) => item.elements.some(element => element.type === "Poteau") ? [index] : []);
      const firstColumnLevel = columnLevels[0];
      const lastColumnLevel = columnLevels[columnLevels.length - 1];
      const classification = /fondation|foundation/i.test(levelLabel)
        ? "poteau-de-fondation"
        : /\brdc\b|rez[- ]de[- ]chauss/i.test(levelLabel)
          ? "RDC"
          : levelIndex === firstColumnLevel && demand.columnContext.baseSupportKind
            ? "RDC"
            : levelIndex === lastColumnLevel
              ? "dernier-niveau"
              : levelIndex > (firstColumnLevel ?? levelIndex) && levelIndex < (lastColumnLevel ?? levelIndex)
                ? "étage-intermédiaire"
                : demand.columnContext.classification;
      return { ...demand, levelLabel, columnContext: { ...demand.columnContext, classification } };
    };
    if (analyticalModel && spatial3DResult) {
      const extracted = deriveRCMemberDemandsFromSpatial({ model: analyticalModel, result: spatial3DResult, combinationId: solverCombinationId, combinationName: loadProgram.combinations.find(item => item.id === solverCombinationId)?.name ?? solverCombinationId });
      return { ...extracted, demands: extracted.demands.map(addLevelMetadata) };
    }
    if (!analyticalModel || !planeAnalysis?.result || !planeAnalysis.combinationId || !planeAnalysis.combinationName) return { demands: [] as RCMemberDemand[], warnings: [] as string[] };
    const extracted = deriveRCMemberDemandsFromPlane({ model: analyticalModel, result: planeAnalysis.result, combinationId: planeAnalysis.combinationId, combinationName: planeAnalysis.combinationName, memberLoads: planeAnalysis.memberLoads });
    return { ...extracted, demands: extracted.demands.map(addLevelMetadata) };
  }, [analyticalModel, spatial3DResult, solverCombinationId, loadProgram.combinations, planeAnalysis, selected]);
  const columnVerificationMemberDemands = useMemo(() => {
    if (selectedAnalysisRow?.type !== "Poteau" || !columnVerificationGeometry) return rcMemberExtraction.demands;
    const sourceDemand = rcMemberExtraction.demands.find(demand => demand.id === selectedAnalysisRow.id && demand.type === "column");
    if (!sourceDemand) return rcMemberExtraction.demands;
    const numericInput = (value: string) => {
      const parsed = Number(value.trim().replace(",", "."));
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const combination = loadProgram.combinations.find(item => item.id === solverCombinationId);
    const factors = combination?.caseFactors ?? {};
    const factorG = factors["case:G"] ?? 1;
    const factorQ = factors["case:Q"] ?? 1;
    const permanentInput = columnVerificationLoads.filter(load => load.category === "G").reduce((sum, load) => sum + numericInput(load.axialKn), 0);
    const variableInput = columnVerificationLoads.filter(load => load.category === "Q").reduce((sum, load) => sum + numericInput(load.axialKn), 0);
    const otherInput = columnVerificationLoads.filter(load => !["G", "Q"].includes(load.category)).reduce((sum, load) => {
      const caseIds = load.category === "W" ? ["case:windX", "case:windY", "case:wind"]
        : load.category === "S" ? ["case:snow", "case:roof"]
          : load.category === "E" ? ["case:seismicX", "case:seismicY", "case:seismic"] : [];
      const actionFactor = load.category === "Autre" ? 1 : Math.max(0, ...caseIds.map(id => factors[id] ?? 0));
      return sum + numericInput(load.axialKn) * actionFactor;
    }, 0);
    const oldSelfWeight = buildingLoadModel?.columnSelfWeights[selectedAnalysisRow.id] ?? 0;
    const sectionAreaM2 = columnVerificationGeometry.shape === "circular"
      ? Math.PI * Math.pow(numericInput(columnVerificationGeometry.diameterM), 2) / 4
      : numericInput(columnVerificationGeometry.widthM) * numericInput(columnVerificationGeometry.depthM);
    const updatedSelfWeight = columnVerificationGeometry.selfWeight
      ? sectionAreaM2 * numericInput(columnVerificationGeometry.heightM) * 25
      : 0;
    const adjustedPermanent = permanentInput - oldSelfWeight + updatedSelfWeight;
    const axialKn = Math.abs(adjustedPermanent * factorG + variableInput * factorQ + otherInput);
    const widthMm = (columnVerificationGeometry.shape === "circular"
      ? numericInput(columnVerificationGeometry.diameterM)
      : numericInput(columnVerificationGeometry.widthM)) * 1000;
    const depthMm = (columnVerificationGeometry.shape === "circular"
      ? numericInput(columnVerificationGeometry.diameterM)
      : numericInput(columnVerificationGeometry.depthM)) * 1000;
    const lengthMm = numericInput(columnVerificationGeometry.heightM) * 1000;
    const momentXKnM = sourceDemand.momentXKnM ?? sourceDemand.momentKnM;
    const momentYKnM = sourceDemand.momentYKnM ?? 0;
    return rcMemberExtraction.demands.map(demand => demand.id === selectedAnalysisRow.id && demand.type === "column" ? {
      ...demand,
      sectionWidthMm: widthMm,
      sectionDepthMm: depthMm,
      sectionShape: columnVerificationGeometry.shape,
      lengthMm: lengthMm > 0 ? lengthMm : demand.lengthMm,
      bucklingLengthMm: lengthMm,
      axialKn,
      momentXKnM,
      momentYKnM,
      momentKnM: Math.max(Math.abs(momentXKnM), Math.abs(momentYKnM)),
      combinationId: combination?.id ?? demand.combinationId,
      combinationName: combination?.name ?? demand.combinationName,
    } : demand);
  }, [rcMemberExtraction.demands, selectedAnalysisRow, columnVerificationGeometry, columnVerificationLoads, loadProgram.combinations, solverCombinationId, buildingLoadModel]);
  const rcSlabDemands = useMemo<RCSlabDemand[]>(() => {
    if (!surfaceAnalysis?.combinationId || !surfaceAnalysis.combinationName) return [];
    return surfaceAnalysis.rows.flatMap(row => {
      const plate = row.analysis.plate;
      if (!plate) return [];
      return [{
      id: row.elementId,
      combinationId: surfaceAnalysis.combinationId as string,
      combinationName: surfaceAnalysis.combinationName as string,
      spanXM: row.spanXM,
      spanYM: row.spanYM,
      spanDirection: row.spanDirection,
      boundaryMode: plate.boundary,
      thicknessMm: row.thicknessMm,
      mxKnMPerM: plate.maximumMxKnMPerM,
      myKnMPerM: plate.maximumMyKnMPerM,
      serviceDeflectionMm: plate.maximumDeflectionM * 1000,
      uniformLoadKnM2: row.uniformLoadKnM2,
      columnWidthMm: row.columnWidthMm,
      columnDepthMm: row.columnDepthMm,
      negativeMxKnMPerM: row.negativeMxKnMPerM,
      negativeMyKnMPerM: row.negativeMyKnMPerM,
      openingAreaRatio: row.areaM2 > 0 ? (row.analysis.mesh?.openingAreaM2 ?? 0) / row.areaM2 : 0,
      floorType: row.floorType,
      }];
    });
  }, [surfaceAnalysis]);
  const rcStairDemands = useMemo<RCStairDemand[]>(() => {
    if (!selected) return [];
    const combination = loadProgram.combinations.find(item => item.id === solverCombinationId);
    if (!combination) return [];
    const factor = (caseId: string, patternId: string) => {
      const actionCase = loadProgram.cases.find(item => item.id === caseId);
      const pattern = loadProgram.patterns.find(item => item.id === patternId);
      if (!actionCase?.enabled || !pattern?.enabled) return 0;
      return (combination.caseFactors[caseId] ?? 0) * (actionCase.patternFactors[patternId] ?? 0);
    };
    const gammaG = factor("case:G", "G");
    const gammaQ = factor("case:Q", "Q");
    const positions = metricGridAxisPositions(xDistances, yDistances, xAxes.length, yAxes.length, gridDistance);
    const numeric = (value: string | undefined, fallback: number) => {
      if (value === undefined || !value.trim()) return fallback;
      const parsed = Number(String(value ?? "").replace(",", "."));
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
    };
    const distance = (a: GridPoint, b: GridPoint) => Math.hypot(a.x - b.x, a.y - b.y);
    const center = (a: GridPoint, b: GridPoint) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    return selected.levels.flatMap(level => level.elements.filter(element => element.type === "Escaliers").map(element => {
      const geometry = element.absoluteStairGeometry ?? freezeStairGeometry(element.stairGeometry, positions.xAxisPositionsM, positions.yAxisPositionsM);
      const lowerIndex = selected.levels.findIndex(item => item.id === geometry?.flight1?.lowerLevelId);
      const upperIndex = selected.levels.findIndex(item => item.id === geometry?.flight1?.upperLevelId);
      const lowerZ = lowerIndex >= 0 ? floorTopElevation(selected.levels[lowerIndex], lowerIndex) : NaN;
      const upperZ = upperIndex >= 0 ? floorTopElevation(selected.levels[upperIndex], upperIndex) : NaN;
      const totalRise = upperZ - lowerZ;
      const landingRise = Number.isFinite(totalRise) && totalRise > 0
        ? Number.isFinite(geometry?.landingZ) && (geometry?.landingZ ?? 0) > 0 && (geometry?.landingZ ?? 0) < totalRise
          ? geometry!.landingZ
          : totalRise / 2
        : NaN;
      const config = normalizeFloorConfig(element.floorConfig ?? {
        ...defaultFloorConfig,
        type: "Dalle pleine",
        thickness: "15 cm",
        characteristicImposedLoad: usageProfile(selected.projectUsage).stairLoad.toFixed(2),
        stairRiser: "0.17",
        stairTread: "0.30",
        stairFinishLoad: "0.00",
      });
      const thicknessMm = (config.thickness.match(/\d+(?:[.,]\d+)?/g) ?? []).reduce((sum, part) => sum + Number(part.replace(",", ".")), 0) * 10;
      const imposedKnM2 = numeric(config.characteristicImposedLoad, usageProfile(selected.projectUsage).stairLoad);
      const flights = [geometry?.flight1, geometry?.flight2].flatMap((flight, flightIndex) => {
        if (!flight || !Number.isFinite(totalRise) || totalRise <= 0 || !Number.isFinite(landingRise)) return [];
        const lowerWidthM = distance(flight.lowerA, flight.lowerB);
        const upperWidthM = distance(flight.upperA, flight.upperB);
        const widthM = (lowerWidthM + upperWidthM) / 2;
        const horizontalRunM = distance(center(flight.lowerA, flight.lowerB), center(flight.upperA, flight.upperB));
        const riseM = flightIndex === 0 ? landingRise : totalRise - landingRise;
        if (![widthM, horizontalRunM, riseM, thicknessMm].every(value => Number.isFinite(value) && value > 0)) return [];
        const permanentKnM2 = calculateStairPermanentLoad({
          widthM,
          horizontalRunM,
          riseM,
          slabThicknessM: thicknessMm / 1000,
          stepHeightM: numeric(config.stairRiser, riseM / Math.max(1, Math.round(horizontalRunM / 0.3))),
          treadM: numeric(config.stairTread, 0.30),
          finishLoadKnM2: numeric(config.stairFinishLoad, 0),
        }).permanentRateKnM2;
        return [{ id: `${element.id}:flight-${flightIndex + 1}`, spanM: horizontalRunM, riseM, widthM, thicknessMm, permanentKnM2, imposedKnM2, gammaG, gammaQ }];
      });
      return {
        id: element.id,
        levelLabel: level.label,
        combinationId: combination.id,
        combinationName: combination.name,
        flights,
      };
    }));
  }, [selected, loadProgram, solverCombinationId, xDistances, yDistances, xAxes.length, yAxes.length, gridDistance]);
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
      soilBearingKPa: normalizeProjectGeotechnicalProfile(selected?.soil).bearingCapacityAdmissibleKPa,
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
    if (!surfaceAnalysis?.rows.some(row => row.analysis.plate)) warnings.push("Efforts de surface absents : lancer le maillage/analyse des dalles pleines, corps creux ou balcons avec leurs appuis définis.");
    if (rcStairDemands.length) warnings.push("Les escaliers sont pré-dimensionnés volée par volée comme bandes simplement appuyées; les paliers, appuis réels, cisaillement normatif, ancrages et recouvrements restent bloqués à vérifier.");
    warnings.push(...(surfaceAnalysis?.errors ?? []));
    return Array.from(new Set(warnings));
  }, [rcMemberExtraction, spatial3DResult, planeAnalysis, surfaceAnalysis, rcStairDemands]);
  const criticalColumn = analysisRows.filter(row => row.type === "Poteau").sort((a, b) => b.nu - a.nu)[0];
  const criticalFoundation = analysisRows.filter(row => row.type === "Semelle").sort((a, b) => b.nu - a.nu)[0];
  const criticalColumnKey = criticalColumn ? `${criticalColumn.levelId}:${criticalColumn.id}` : null;
  const criticalElementKeys = criticalColumnKey ? [criticalColumnKey] : [];
  const loadVisuals = useMemo(() => {
    const visuals: Record<string, { gk: number; qk: number; nu: number; nser?: number; moment?: number; lineKnM?: number; areaKnM2?: number; critical?: boolean }> = {};
    for (const row of analysisRows) visuals[`${row.levelId}:${row.id}`] = { gk: row.gk, qk: row.qk, nu: row.nu, nser: row.nser, moment: row.moment, critical: criticalElementKeys.includes(`${row.levelId}:${row.id}`) };
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
  const projectGeotechnical = normalizeProjectGeotechnicalProfile(selected?.soil);
  const projectGeotechnicalCatalogProfiles = getGeotechnicalCatalogProfiles(selected?.country ?? country);
  const projectGeotechnicalCatalogProfile = getGeotechnicalCatalogProfile(projectGeotechnical.catalogProfileId ?? projectGeotechnicalCatalogProfiles[0]?.id);
  const projectBearingKPa = projectGeotechnical.bearingCapacityAdmissibleKPa;
  const projectSoilName = projectGeotechnical.soilDescription || soilProposal.soil;
  const projectSoilSource = [projectGeotechnical.source, projectGeotechnical.reportDate, projectGeotechnical.reportPage ? `p. ${projectGeotechnical.reportPage}` : ""].filter(Boolean).join(" · ") || "aucun rapport renseigné";
  const projectSoilStatus = projectGeotechnical.status === "not_provided" ? "données géotechniques non renseignées" : projectGeotechnical.status === "geotechnical_confirmed" ? "données déclarées confirmées par l’utilisateur" : "données saisies — à vérifier sur le rapport";
  const regulatoryProfile = getRegulatorySiteProfile(country, city);
  const projectSetupProfile = getRegulatorySiteProfile(projectSettingsDraft.country, projectSettingsDraft.city);
  const projectSetupMaterials = getProjectMaterialSummary(projectSettingsDraft.materials);
  const selectedProjectMaterials = getProjectMaterialSummary(normalizeProjectMaterials(selected?.materials));
  const constructionCodeCompliance = useMemo(() => evaluateSenegalConstructionCode({
    country,
    buildingFloorsAboveGround: Math.max(0, (selected?.levels?.filter(level => level.id !== "foundation" && level.kind !== "edicule").length ?? 1)),
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
    try { allFloorConfigs = JSON.parse(sessionStorage.getItem(scopedSessionKey("gcbtp-floor-configs", cloudAccountId)) ?? "{}"); } catch { /* Use the in-memory active floor config. */ }
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
  const floorConfigForModel = (type: string, section: string, fallback = floorConfig): FloorConfig =>
    type === "Balcon" ? defaultBalconyFloorConfig(fallback) : floorConfigForSection(section, fallback);

  useEffect(() => {
    if (!authResolved) return;
    let cancelled = false;
    setProjectsHydrated(false);
    void (async () => {
      let snapshots: BuildingProjectSnapshot<Project>[] = [];
      let persistenceMessage = "";
      if (cloudAccountId) {
        try {
          const remote = await loadCloudBuildingProjects<Project>(cloudAccountId);
          if (cancelled) return;
          const merged = new Map(remote.map(snapshot => [snapshot.projectId, snapshot]));
          remote.forEach(snapshot => saveAccountBuildingProjectCache(cloudAccountId, snapshot));
          const localCandidates = new Map<string, BuildingProjectSnapshot<Project>>();
          [...loadAccountBuildingProjectCache<Project>(cloudAccountId), ...await loadLegacyProjectsForAccount<Project>(cloudAccountId)]
            .forEach(snapshot => {
              const existing = localCandidates.get(snapshot.projectId);
              if (!existing || snapshot.savedAt > existing.savedAt) localCandidates.set(snapshot.projectId, snapshot);
            });
          let conflictingProjectId: string | null = null;
          for (const local of localCandidates.values()) {
            if (cancelled) return;
            const current = merged.get(local.projectId);
            const localContent = JSON.stringify({ project: local.project, workspace: local.workspace });
            const currentContent = current ? JSON.stringify({ project: current.project, workspace: current.workspace }) : "";
            if (current && (localContent === currentContent || local.savedAt <= current.savedAt)) continue;
            const outcome = await saveCloudBuildingProject(cloudAccountId, local.project, current?.revision ?? 0, new Date(), local.workspace);
            if (outcome.status === "saved") {
              merged.set(local.projectId, outcome.snapshot);
              saveAccountBuildingProjectCache(cloudAccountId, outcome.snapshot);
            } else if (outcome.current) {
              conflictingProjectId = local.projectId;
              autosaveBlocked.current.add(local.projectId);
              merged.set(local.projectId, { ...local, revision: outcome.current.revision });
            }
          }
          snapshots = [...merged.values()].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
          snapshots.forEach(snapshot => {
            if (snapshot.projectId !== conflictingProjectId) saveAccountBuildingProjectCache(cloudAccountId, snapshot);
          });
          if (conflictingProjectId) {
            setConflictProjectId(conflictingProjectId);
            persistenceMessage = "Conflit de versions entre appareils · rechargez la version cloud ou restaurez une version locale";
          } else {
            persistenceMessage = "Projets synchronisés avec votre compte";
          }
        } catch {
          if (cancelled) return;
          snapshots = loadAccountBuildingProjectCache<Project>(cloudAccountId);
          if (!snapshots.length) snapshots = await loadLegacyProjectsForAccount<Project>(cloudAccountId);
          snapshots.forEach(snapshot => saveAccountBuildingProjectCache(cloudAccountId, snapshot));
          persistenceMessage = snapshots.length
            ? "Cloud indisponible · copie locale conservée pour ce compte"
            : "Synchronisation cloud indisponible · vérifiez l’accès Supabase";
        }
      } else {
        try { snapshots = await loadBuildingProjects<Project>(); } catch { /* La migration legacy reste disponible. */ }
        persistenceMessage = snapshots.length ? "Projet récupéré depuis le stockage local durable" : "Autosauvegarde locale activée";
      }
      if (cancelled) return;
      projectRevisions.current = Object.fromEntries(snapshots.map(snapshot => [snapshot.projectId, snapshot.revision]));
      workspaceByProject.current = Object.fromEntries(snapshots.filter(snapshot => snapshot.workspace && typeof snapshot.workspace === "object").map(snapshot => [snapshot.projectId, snapshot.workspace as BuildingWorkspaceSnapshot]));
      autosaveBlocked.current = new Set(autosaveBlocked.current);
      const restored = snapshots.map(snapshot => ({
        ...snapshot.project,
        levels: renumberBuildingElements(snapshot.project.levels),
      }));
      projectContents.current = Object.fromEntries(restored.map(project => [project.id, JSON.stringify({ project, workspace: workspaceByProject.current[project.id] })]));
      setProjects(restored);
      const latest = [...snapshots].sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0];
      if (latest) setSelectedProject(restored.find(project => project.id === latest.projectId) ?? restored[0]);
      if (!snapshots.length && !cloudAccountId) {
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
          persistenceMessage = "Ancien brouillon récupéré · migration en cours";
        }
      }
      setPersistenceStatus(persistenceMessage);
      setProjectsHydrated(true);
    })();
    return () => { cancelled = true; };
  }, [authResolved, cloudAccountId]);

  useEffect(() => {
    if (!projectsHydrated || !authResolved || activeAccountRef.current !== cloudAccountId) return;
    const snapshots = projects.map(project => ({
      project,
      workspace: project.id === selected?.id ? createWorkspaceSnapshot(project.id) : workspaceByProject.current[project.id],
    }));
    const changed = snapshots.filter(snapshot => JSON.stringify(snapshot) !== projectContents.current[snapshot.project.id]);
    if (!changed.length) return;
    setPersistenceStatus(cloudAccountId ? "Synchronisation avec votre compte…" : "Enregistrement sur cet appareil…");
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          for (const { project, workspace } of changed) {
            if (activeAccountRef.current !== cloudAccountId) return;
            if (autosaveBlocked.current.has(project.id)) continue;
            if (autosaveInFlight.current.has(project.id)) {
              autosavePending.current.add(project.id);
              continue;
            }
            autosaveInFlight.current.add(project.id);
            const expectedRevision = projectRevisions.current[project.id] ?? 0;
            try {
              if (cloudAccountId) {
                saveAccountBuildingProjectCache(cloudAccountId, {
                  projectId: project.id,
                  revision: expectedRevision,
                  savedAt: new Date().toISOString(),
                  project,
                  workspace,
                });
              }
              const outcome = cloudAccountId
                ? await saveCloudBuildingProject(cloudAccountId, project, expectedRevision, new Date(), workspace)
                : await saveBuildingProject(project, expectedRevision, new Date(), workspace);
              if (activeAccountRef.current !== cloudAccountId) return;
              if (outcome.status === "conflict") {
                autosaveBlocked.current.add(project.id);
                setConflictProjectId(project.id);
                setPersistenceStatus("Conflit détecté · une autre version est plus récente");
                return;
              }
              projectRevisions.current[project.id] = outcome.snapshot.revision;
              projectContents.current[project.id] = JSON.stringify({ project, workspace });
              if (workspace) workspaceByProject.current[project.id] = workspace as BuildingWorkspaceSnapshot;
              if (cloudAccountId) saveAccountBuildingProjectCache(cloudAccountId, outcome.snapshot);
            } finally {
              autosaveInFlight.current.delete(project.id);
              if (autosavePending.current.delete(project.id)) setAutosaveRetry(value => value + 1);
            }
          }
          if (activeAccountRef.current !== cloudAccountId) return;
          setPersistenceStatus(cloudAccountId
            ? `Synchronisé avec votre compte · ${new Date().toLocaleTimeString()}`
            : `Sauvegardé sur cet appareil · ${new Date().toLocaleTimeString()}`);
        } catch {
          if (activeAccountRef.current !== cloudAccountId) return;
          setPersistenceStatus(cloudAccountId
            ? "Cloud indisponible · copie locale de ce compte conservée, synchronisation à réessayer"
            : "Échec de sauvegarde · exportez une copie de sécurité");
        }
      })();
    }, 650);
    return () => window.clearTimeout(timer);
  }, [projects, projectsHydrated, authResolved, cloudAccountId, selected, xAxes, yAxes, zLevels, gridDistance, loads, xNumbering, yNumbering, xDistances, yDistances, analyticalTolerance, customModels, floorConfig, loadProgram, climateDraft, threeD, showLabels, gridOpacity, snapToGrid, autosaveRetry]);
  useEffect(() => {
    setModelSection(optionsForType(modelType)[0] ?? "");
  }, [modelType, customModels]);
  useEffect(() => {
    if (!authResolved) return;
    const view = sessionStorage.getItem(scopedSessionKey("gcbtp-building-view", cloudAccountId));
    if (view) setThreeD(view === "3d");
    const visualKey = scopedSessionKey("gcbtp-building-visual", cloudAccountId);
    const visual = sessionStorage.getItem(visualKey);
    if (visual) {
      try {
        const data = JSON.parse(visual);
        setShowLabels(data.showLabels ?? true);
        setGridOpacity(data.gridOpacity ?? "100");
        setSnapToGrid(data.snapToGrid ?? true);
      } catch {
        sessionStorage.removeItem(visualKey);
      }
    }
  }, [authResolved, cloudAccountId, setThreeD]);
  useEffect(() => {
    if (!authResolved) return;
    sessionStorage.setItem(scopedSessionKey("gcbtp-building-view", cloudAccountId), threeD ? "3d" : "2d");
  }, [threeD, authResolved, cloudAccountId]);
  useEffect(() => {
    if (!authResolved) return;
    sessionStorage.setItem(
      scopedSessionKey("gcbtp-building-visual", cloudAccountId),
      JSON.stringify({ showLabels, gridOpacity, snapToGrid })
    );
  }, [showLabels, gridOpacity, snapToGrid, authResolved, cloudAccountId]);
  useEffect(() => {
    if (!authResolved) return;
    const key = scopedSessionKey("gcbtp-building-config", cloudAccountId);
    const raw = sessionStorage.getItem(key);
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
        sessionStorage.removeItem(key);
      }
    }
  }, [authResolved, cloudAccountId]);
  useEffect(() => {
    if (!authResolved) return;
    const key = scopedSessionKey("gcbtp-building-config", cloudAccountId);
    const raw = sessionStorage.getItem(key);
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
        sessionStorage.removeItem(key);
      }
    }
  }, [authResolved, cloudAccountId]);
  useEffect(() => {
    if (!authResolved) return;
    sessionStorage.setItem(
      scopedSessionKey("gcbtp-building-config", cloudAccountId),
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
  }, [xAxes, yAxes, zLevels, gridDistance, loads, analyticalTolerance, authResolved, cloudAccountId]);
  useEffect(() => {
    if (!authResolved || !floorStorageKey) return;
    try {
      const map = JSON.parse(
        sessionStorage.getItem(scopedSessionKey("gcbtp-floor-configs", cloudAccountId)) ?? "{}"
      );
      setFloorConfig(normalizeFloorConfig(map[floorStorageKey]));
    } catch {
      setFloorConfig(defaultFloorConfig);
    }
  }, [floorStorageKey, authResolved, cloudAccountId]);
  useEffect(() => {
    if (!authResolved || !floorStorageKey) return;
    try {
      const map = JSON.parse(
        sessionStorage.getItem(scopedSessionKey("gcbtp-floor-configs", cloudAccountId)) ?? "{}"
      );
      map[floorStorageKey] = floorConfig;
      sessionStorage.setItem(scopedSessionKey("gcbtp-floor-configs", cloudAccountId), JSON.stringify(map));
    } catch {
      /* sessionStorage indisponible */
    }
  }, [floorStorageKey, floorConfig, authResolved, cloudAccountId]);

  useEffect(() => {
    setBuildingCalculation(null);
    setCalculationExecuted(false);
    setAnalyticalModel(null);
    setAnalyticalPrecheck(null);
    setStructuralValidation(null);
    setBuildingLoadModel(null);
    setPlaneAnalysis(null);
    setSurfaceAnalysis(null);
    setClimateAnalysis(null);
    setRcDesignResult(null);
    setShowCalculationPreflight(false);
    setMeshPrerequisiteReady(false);
    setLoadCasesPrerequisiteReady(false);
    setShowMeshDetails(false);
    setShowLoadDetails(false);
  }, [selected?.levels, selected?.structure, selected?.norm, xDistances, yDistances, floorConfig, analyticalTolerance, customModels]);

  useEffect(() => {
    setPlaneAnalysis(null);
    setSurfaceAnalysis(null);
    setRcDesignResult(null);
    setLoadCasesPrerequisiteReady(false);
    setShowMeshDetails(false);
    setShowLoadDetails(false);
  }, [loadProgram, surfaceMeshSizeM]);

  useEffect(() => {
    if (!authResolved || !selected) return;
    const key = scopedSessionKey(`gcbtp-load-program:${selected.id}`, cloudAccountId);
    try {
      const raw = sessionStorage.getItem(key);
      const restored = raw ? JSON.parse(raw) as LoadProgram : null;
      setLoadProgram(restored?.schemaVersion === 1 ? normalizeLoadProgram(restored, selected.norm, selected.projectUsage ?? "habitation") : createDefaultLoadProgram(selected.norm || norm, selected.projectUsage ?? "habitation"));
    } catch {
      setLoadProgram(createDefaultLoadProgram(selected.norm || norm, selected.projectUsage ?? "habitation"));
    }
  }, [selected?.id, selected?.norm, selected?.projectUsage, authResolved, cloudAccountId]);

  useEffect(() => {
    if (!authResolved || !selected) return;
    const storyCount = Math.max(1, selected.levels.filter(level => level.id !== "foundation").length);
    try {
      const raw = sessionStorage.getItem(scopedSessionKey(`gcbtp-climate:${selected.id}`, cloudAccountId));
      setClimateDraft(normalizeClimateDraft(raw ? JSON.parse(raw) : null, storyCount));
    } catch {
      setClimateDraft(createClimateDraft(storyCount));
    }
    setClimateAnalysis(null);
    setClimateLoadedProjectId(selected.id);
  }, [selected?.id, authResolved, cloudAccountId]);
  useEffect(() => {
    if (!authResolved || !selected || climateLoadedProjectId !== selected.id) return;
    try { sessionStorage.setItem(scopedSessionKey(`gcbtp-climate:${selected.id}`, cloudAccountId), JSON.stringify(climateDraft)); } catch { /* Le profil climatique reste disponible en mémoire. */ }
  }, [selected?.id, climateLoadedProjectId, climateDraft, authResolved, cloudAccountId]);
  useEffect(() => {
    setClimateAnalysis(null);
  }, [climateDraft]);
  useEffect(() => {
    if (!authResolved || !selected) return;
    try {
      sessionStorage.setItem(scopedSessionKey(`gcbtp-load-program:${selected.id}`, cloudAccountId), JSON.stringify(loadProgram));
    } catch {
      /* Le programme de charges reste utilisable même si le stockage local est indisponible. */
    }
  }, [selected?.id, loadProgram, authResolved, cloudAccountId]);

  const activeLevel = useMemo(
    () =>
      selected?.levels.find(level => level.id === activeLevelId) ??
      selected?.levels[0],
    [selected, activeLevelId]
  );
  const setSelectedProject = (next: Project) => {
    next = normalizeProjectMetadata(next);
    // Un escalier est affiché et enregistré sur son niveau d’arrivée.
    // Cette migration ne touche ni ses points, ni ses dimensions, ni sa géométrie.
    const stairsByTarget = new Map<string, ElementItem[]>();
    const levelsWithRehomedStairs = next.levels.map(level => ({
      ...level,
      elements: level.elements.filter(item => {
        if (item.type !== "Escaliers") return true;
        const targetId = item.stairGeometry?.flight2?.upperLevelId ?? item.absoluteStairGeometry?.flight2?.upperLevelId;
        if (!targetId || targetId === level.id || !next.levels.some(candidate => candidate.id === targetId)) return true;
        const target = stairsByTarget.get(targetId) ?? [];
        target.push(item);
        stairsByTarget.set(targetId, target);
        return false;
      }),
    })).map(level => ({
      ...level,
      elements: [...level.elements, ...(stairsByTarget.get(level.id) ?? [])],
    }));
    const normalized = {
      ...next,
      levels: renumberBuildingElements(levelsWithRehomedStairs),
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
      const restoredLoadProgram = workspace.loadProgram?.schemaVersion === 1 ? normalizeLoadProgram(workspace.loadProgram, normalized.norm, normalized.projectUsage ?? "habitation") : createDefaultLoadProgram(normalized.norm, normalized.projectUsage ?? "habitation");
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
        const floorKey = scopedSessionKey("gcbtp-floor-configs", cloudAccountId);
        const allFloorConfigs = JSON.parse(sessionStorage.getItem(floorKey) ?? "{}");
        sessionStorage.setItem(floorKey, JSON.stringify({ ...allFloorConfigs, ...floorConfigs }));
        sessionStorage.setItem(scopedSessionKey(`gcbtp-load-program:${normalized.id}`, cloudAccountId), JSON.stringify(restoredLoadProgram));
        sessionStorage.setItem(scopedSessionKey(`gcbtp-climate:${normalized.id}`, cloudAccountId), JSON.stringify(workspace.climateDraft));
        sessionStorage.setItem(scopedSessionKey("gcbtp-building-config", cloudAccountId), JSON.stringify(config));
      } catch { /* In-memory values are restored even when browser storage is blocked. */ }
      const targetLevelId = normalized.levels.find(level => level.id === "rdc")?.id ?? normalized.levels[0]?.id ?? "rdc";
      setFloorConfig(normalizeFloorConfig(floorConfigs[`${normalized.id}:${targetLevelId}`]));
    }
    setSelected(normalized);
    setProjectUsage(normalized.projectUsage ?? "habitation");
    setNorm(normalized.norm);
    setCountry(normalized.country);
    setCity(normalized.city ?? "");
    setLocation(normalized.location ?? "");
    setStructure(normalized.structure ?? "Béton armé");
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
  const openProjectDialog = () => {
    const availableCities = getCitiesForCountry(country);
    const initialCity = availableCities.some(item => item.city === city)
      ? city
      : availableCities[0]?.city ?? city;
    const initialNorm = getCountryProjectStandard(country, initialCity);
    setProjectSettingsDraft({
      country,
      city: initialCity,
      location,
      structure,
      norm: initialNorm,
      regulatoryCatalogId: getProjectStandardId(initialNorm),
      materials: { ...DEFAULT_PROJECT_MATERIALS },
    });
    setProjectWizardStep("identity");
    setDialogOpen(true);
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
      city: projectSettingsDraft.city.trim(),
      location: projectSettingsDraft.location.trim(),
      structure: projectSettingsDraft.structure,
      norm: projectSettingsDraft.norm,
      country: projectSettingsDraft.country,
      projectUsage,
      regulatoryCatalogId: projectSettingsDraft.regulatoryCatalogId,
      materials: { ...projectSettingsDraft.materials },
      soil: copyCatalogToProject(getGeotechnicalCatalogProfiles(projectSettingsDraft.country)[0] ?? getGeotechnicalCatalogProfile(DEFAULT_GEOTECHNICAL_CATALOG_ID)),
    };
    setProjects(prev => [project, ...prev]);
    setSelected(project);
    setLoadProgram(createDefaultLoadProgram(project.norm, projectUsage));
    setFloorConfig(normalizeFloorConfig({ ...floorConfig, characteristicImposedLoad: selectedUsage.load.toFixed(2) }));
    setProjectName("");
    setDialogOpen(false);
    setCity(project.city);
    setLocation(project.location);
    setStructure(project.structure);
    setCountry(project.country);
    setNorm(project.norm);
    setProjectWizardStep("identity");
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
  const deleteProjectFromHistory = async (project: Project) => {
    if (projectDeletionInProgress) return;
    autosaveBlocked.current.add(project.id);
    let cloudRemoved = !cloudAccountId;
    setProjectDeletionInProgress(true);
    try {
      const waitUntil = Date.now() + 10_000;
      while (autosaveInFlight.current.has(project.id) && Date.now() < waitUntil)
        await new Promise(resolve => window.setTimeout(resolve, 40));
      if (autosaveInFlight.current.has(project.id)) throw new Error("La sauvegarde du projet ne s’est pas terminée. Réessayez dans quelques secondes.");
      autosavePending.current.delete(project.id);
      if (cloudAccountId) {
        await deleteCloudBuildingProject(cloudAccountId, project.id);
        cloudRemoved = true;
        removeAccountBuildingProjectCache(cloudAccountId, project.id);
      }
      await removeBuildingProject(project.id);
      if (cloudAccountId) removeAccountBuildingProjectCache(cloudAccountId, project.id);
      delete projectRevisions.current[project.id];
      delete projectContents.current[project.id];
      delete workspaceByProject.current[project.id];
      autosavePending.current.delete(project.id);
      setProjects(previous => previous.filter(item => item.id !== project.id));
      setProjectHistory(previous => previous.filter(snapshot => snapshot.projectId !== project.id));
      setProjectPendingDeletion(null);
      toast.success(`Projet « ${project.name} » supprimé de l’historique`);
    } catch (error) {
      if (!cloudRemoved) autosaveBlocked.current.delete(project.id);
      console.error("Building project deletion failed", error);
      toast.error(error instanceof Error ? `Suppression impossible : ${error.message}` : "La suppression du projet a échoué.");
    } finally {
      setProjectDeletionInProgress(false);
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
      const expectedRevision = projectRevisions.current[projectId] ?? 0;
      const result = cloudAccountId
        ? await saveCloudBuildingProject(cloudAccountId, snapshot.project, expectedRevision, new Date(), workspace)
        : await saveBuildingProject(snapshot.project, expectedRevision, new Date(), workspace);
      if (result.status === "conflict") {
        autosaveBlocked.current.add(projectId);
        setConflictProjectId(projectId);
        setPersistenceStatus("Conflit détecté · rechargez la dernière version");
        return;
      }
      projectRevisions.current[projectId] = result.snapshot.revision;
      if (cloudAccountId) saveAccountBuildingProjectCache(cloudAccountId, result.snapshot);
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
      const snapshots = cloudAccountId
        ? await loadCloudBuildingProjects<Project>(cloudAccountId)
        : await loadBuildingProjects<Project>();
      const latest = snapshots.find(snapshot => snapshot.projectId === conflictProjectId);
      if (!latest) throw new Error("Aucune version enregistrée n’a été trouvée.");
      if (cloudAccountId) saveAccountBuildingProjectCache(cloudAccountId, latest);
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
      concreteClass: normalizeProjectMaterials(selected.materials).concreteClass,
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
      toast.error("Le calcul est verrouillé : validez le maillage de toutes les surfaces puis l’application des charges.");
      setShowCalculationPreflight(true);
      return;
    }
    if (!selected) return;
    setLastStructuralReport("");
    setCalculationExecuted(false);
    try { sessionStorage.removeItem("gcbtp-last-structural-report"); } catch { /* L’invalidation reste effective en mémoire. */ }
    const analytical = buildCurrentAnalytical();
    if (!analytical) return;
    setAnalyticalModel(analytical.model);
    setAnalyticalPrecheck(analytical.precheck);
    const latestStructuralValidation = validateStructuralModel(selected.levels);
    setStructuralValidation(latestStructuralValidation);
    const structuralErrors = latestStructuralValidation.issues.filter(item => item.severity === "error");
    if (structuralErrors.length) {
      setBuildingCalculation(null);
      setBuildingLoadModel(null);
      setPlaneAnalysis(null);
      setSpatial3DResult(null);
      setShowCalculationPreflight(true);
      toast.error(`Calcul bloqué : ${structuralErrors.length} erreur(s) structurelle(s) à corriger avant le solveur.`);
      return;
    }
    if (!analytical.precheck.ok) {
      setBuildingCalculation(null);
      setBuildingLoadModel(null);
      setPlaneAnalysis(null);
      setShowCalculationPreflight(true);
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
      ...metricGridAxisPositions(xDistances, yDistances, xAxes.length, yAxes.length, gridDistance),
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
    setCalculationExecuted(true);
    setPanel("Calculer la descente");
    const message = `Calcul terminé : ${summary.floorCount} surface(s) (dalles, balcons, escaliers), ${summary.foundationCount} fondation(s) chargée(s)`;
    if (summary.floorCount === 0) toast.info(`${message}. Ajoutez les surfaces porteuses pour inclure les charges d’exploitation et permanentes des niveaux.`);
    else toast.success(message);
    setShowCalculationPreflight(false);
  };
  const openCalculationPreflight = () => {
    if (!selected) return;
    setStructuralValidation(validateStructuralModel(selected.levels));
    setLastStructuralReport("");
    setCalculationExecuted(false);
    const analytical = buildCurrentAnalytical();
    if (!analytical) return;
    setAnalyticalModel(analytical.model);
    setAnalyticalPrecheck(analytical.precheck);
    const loadElements = selected.levels.flatMap(level => level.elements.map(element => ({ ...element, levelId: level.id })));
    const model = buildBuildingLoadModel(loadElements, {
      levelOrder: selected.levels.map(level => level.id),
      levelHeights: Object.fromEntries(selected.levels.map(level => [level.id, Number(level.height ?? (level.id === "foundation" ? 1 : 3.2))])),
      gridDistance: Number(gridDistance.replace(",", ".")) || 4,
      ...metricGridAxisPositions(xDistances, yDistances, xAxes.length, yAxes.length, gridDistance),
    });
    setBuildingLoadModel(model);
    setBuildingCalculation(summarizeBuildingLoads(model));
    setAnalyticalSurfaceMesh(null);
    setSurfaceAnalysis(null);
    setLoadApplicationReport(null);
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
    const slabs = selected.levels.flatMap(level => level.elements.filter(item => isSlabElementType(item.type) && item.x2 !== undefined && item.y2 !== undefined).map(element => ({ level, element })));
    if (!slabs.length) {
      setSurfaceAnalysis({ rows: [], errors: ["Aucune dalle ou balcon rectangulaire ne peut être maillé dans ce projet."], warnings: [] });
      toast.error("Aucune surface de dalle ou de balcon à analyser");
      return false;
    }
    const rows: SurfaceRunRow[] = slabs.map(({ level, element }) => {
      const config = normalizeFloorConfig(element.floorConfig ?? (element.type === "Balcon" ? defaultBalconyFloorConfig() : defaultFloorConfig));
      const metric = metricOfElement(element, xPositions, yPositions);
      const x1M = metric.xM, y1M = metric.yM;
      const x2M = metric.x2M ?? x1M, y2M = metric.y2M ?? y1M;
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
      const supportCheck = checkRectangularSurfaceEdgeSupports({ x1: element.x, y1: element.y, x2: element.x2 as number, y2: element.y2 as number }, level.elements);
      const mesh = meshRectangularSurface(input);
      const stiffness = resolveFloorPlateStiffness(config, input.elasticModulusKnM2, input.poissonRatio);
      let supportErrors: string[] = [];
      let spanDirection: "X" | "Y" = config.direction;
      let analysis: SurfaceAnalysis;
      if (element.type === "Balcon") {
        const configuredEdge = config.balconySupportEdge ?? "auto";
        const fixedEdge: RectangularSurfaceEdge | undefined = configuredEdge === "auto"
          ? supportCheck.supportedEdges.length === 1 ? supportCheck.supportedEdges[0] : undefined
          : configuredEdge;
        if (fixedEdge) spanDirection = fixedEdge === "left" || fixedEdge === "right" ? "X" : "Y";
        if (!fixedEdge) supportErrors = [supportCheck.supportedEdges.length > 1
          ? `Plusieurs rives sont portées sur ${element.id} : choisissez explicitement le bord d’encastrement du balcon.`
          : `Aucune rive d’encastrement unique détectée sur ${element.id} : ajoutez une poutre/voile continue ou choisissez la rive réelle.`];
        else if (!supportCheck.supportedEdges.includes(fixedEdge)) supportErrors = [`La rive ${fixedEdge} choisie comme encastrement de ${element.id} n’est pas portée par une poutre/voile continue.`];
        analysis = supportErrors.length
          ? { mesh: mesh.mesh, plate: null, errors: [...mesh.errors, ...supportErrors], warnings: mesh.warnings }
          : analyzeCantileverRectangularPlate(input, stiffness, fixedEdge as RectangularSurfaceEdge);
      } else if (config.type === "Dalle pleine") {
        supportErrors = supportCheck.missingEdges.map(edge => `Bord ${edge} sans poutre/voile continue sur ${element.id}.`);
        analysis = supportErrors.length
          ? { mesh: mesh.mesh, plate: null, errors: [...mesh.errors, ...supportErrors], warnings: mesh.warnings }
          : analyzeSimplySupportedRectangularPlate(input);
      } else {
        const bearingEdges = config.direction === "X" ? ["left", "right"] as const : ["bottom", "top"] as const;
        supportErrors = bearingEdges.filter(edge => !supportCheck.supportedEdges.includes(edge)).map(edge => `Rive d’appui ${edge} sans poutre/voile continue sur ${element.id} (sens de portée ${config.direction}).`);
        analysis = supportErrors.length
          ? { mesh: mesh.mesh, plate: null, errors: [...mesh.errors, ...supportErrors], warnings: mesh.warnings }
          : analyzeOneWayOrthotropicRectangularPlate(input, stiffness, config.direction);
      }
      const areaM2 = analysis.mesh?.netAreaM2 ?? Math.abs(x2M - x1M) * Math.abs(y2M - y1M);
      const column = level.elements.find(candidate => candidate.type === "Poteau" && [element.x, element.x2].includes(candidate.x) && [element.y, element.y2].includes(candidate.y));
      const dimensions = (column?.section ?? "300x300").match(/\d+(?:[.,]\d+)?/g)?.map(value => Number(value.replace(",", "."))) ?? [300, 300];
      return { elementId: element.id, levelLabel: level.label, areaM2, openingCount: (element.openings ?? []).length, spanXM: Math.abs(x2M - x1M), spanYM: Math.abs(y2M - y1M), spanDirection, thicknessMm: input.thicknessM * 1000, uniformLoadKnM2, columnWidthMm: dimensions[0] ?? 300, columnDepthMm: dimensions[1] ?? dimensions[0] ?? 300, negativeMxKnMPerM: Math.max(0, ...(analysis.plate?.nodeResults.map(result => -result.mxKnMPerM) ?? [])), negativeMyKnMPerM: Math.max(0, ...(analysis.plate?.nodeResults.map(result => -result.myKnMPerM) ?? [])), floorType: config.type, analysis, supportErrors };
    });
    const errors = rows.flatMap(row => row.analysis.errors.map(message => `${row.elementId} · ${message}`));
    const warnings = rows.flatMap(row => row.analysis.warnings.map(message => `${row.elementId} · ${message}`));
    setSurfaceAnalysis({ rows, errors, warnings, combinationId: combination.id, combinationName: combination.name });
    if (rows.some(row => row.analysis.plate)) toast.success(`Maillage et analyse de ${rows.filter(row => row.analysis.plate).length} surface(s) terminés`);
    else if (!errors.length && rows.length) toast.success(`Maillage et zones de charges de ${rows.length} surface(s) calculés.`);
    else toast.error(`Aucune surface calculée : ${errors[0] ?? "géométrie ou appuis incompatibles"}`);
    return errors.length === 0 && rows.length > 0;
  };
  const runAllSurfaceMeshing = () => {
    if (!selected) return;
    const analytical = analyticalModel ? { model: analyticalModel, precheck: analyticalPrecheck } : buildCurrentAnalytical();
    if (!analytical) return;
    setAnalyticalModel(analytical.model);
    if (analytical.precheck) setAnalyticalPrecheck(analytical.precheck);
    const size = Number(surfaceMeshSizeM.replace(",", "."));
    const mesh = meshAnalyticalSurfaces(analytical.model, size);
    setAnalyticalSurfaceMesh(mesh);
    setShowMeshDetails(false);
    const hasRectangularPlates = selected.levels.some(level => level.elements.some(element => isSlabElementType(element.type) && element.x2 !== undefined && element.y2 !== undefined));
    if (hasRectangularPlates) runSurfaceAnalysis();
    else setSurfaceAnalysis(null);
    const ready = mesh.errors.length === 0 && mesh.surfaces.every(surface => surface.triangleCount > 0);
    setMeshPrerequisiteReady(ready);
    setLoadCasesPrerequisiteReady(false);
    setLoadApplicationReport(null);
    setShowLoadDetails(false);
    if (ready) toast.success(`${mesh.surfaces.length} surface(s) géométrique(s) maillée(s) · ${mesh.nodes.length} nœud(s) · ${mesh.triangles.length} triangle(s)`);
    else toast.error(`Maillage incomplet : ${mesh.errors[0] ?? "une ou plusieurs surfaces n’ont pas produit de triangles"}`);
  };
  const applyBuildingLoads = () => {
    if (!selected || !analyticalModel || !buildingLoadModel) return;
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!meshPrerequisiteReady || !analyticalSurfaceMesh) errors.push("Faire et valider le maillage de toutes les surfaces avant d’appliquer les charges.");
    if (!analyticalPrecheck?.ok) errors.push(...(analyticalPrecheck?.errors.map(item => item.message) ?? ["Le pré-contrôle géométrique est absent ou invalide."]));
    const structural = validateStructuralModel(selected.levels);
    setStructuralValidation(structural);
    errors.push(...structural.issues.filter(item => item.severity === "error").map(item => item.message));
    const diagnostics = validateLoadProgram(loadProgram);
    errors.push(...diagnostics.filter(item => item.severity === "error").map(item => item.message));
    warnings.push(...diagnostics.filter(item => item.severity === "warning").map(item => item.message));
    warnings.push(...analyticalPrecheck?.warnings.map(item => item.message) ?? []);
    warnings.push(...buildingLoadModel.warnings);
    warnings.push(...analyticalSurfaceMesh?.warnings ?? []);
    const enabledCombinations = loadProgram.combinations.filter(item => item.enabled);
    const hasUls = enabledCombinations.some(item => item.category === "ULS");
    const hasSls = enabledCombinations.some(item => item.category.startsWith("SLS-"));
    if (!hasUls) errors.push("Aucune combinaison ELU active n’est définie.");
    if (!hasSls) errors.push("Aucune combinaison ELS active n’est définie.");
    const floors = buildingLoadModel.floors;
    const floorsById = new Map(floors.map(floor => [floor.id, floor]));
    const assignments = buildingLoadModel.surfaceAssignments;
    const meshBySourceElement = new Map((analyticalSurfaceMesh?.surfaces ?? []).map(surface => [surface.sourceElementId, surface]));
    const parentElementIds = new Set(floors.map(floor => floor.id));
    const missingAssignments = analyticalModel.surfaces.filter(surface => parentElementIds.has(surface.sourceElementId.split(":")[0]) && !assignments.some(assignment => assignment.meshSurfaceId === surface.sourceElementId));
    for (const surface of missingAssignments) errors.push(`Aucune charge propre n’est affectée à la surface maillée ${surface.sourceElementId}.`);
    const surfaceRows = assignments.map(assignment => {
      const floor = floorsById.get(assignment.parentElementId);
      const mesh = meshBySourceElement.get(assignment.meshSurfaceId);
      if (!floor) errors.push(`Surface ${assignment.id} sans élément porteur dans le modèle de charges.`);
      if (!mesh || mesh.triangleCount <= 0 || mesh.areaM2 <= 0) errors.push(`Surface chargée ${assignment.meshSurfaceId} absente ou non valide dans le maillage analytique.`);
      if (![assignment.areaM2, assignment.gkKnM2, assignment.qkKnM2, assignment.gkKn, assignment.qkKn].every(value => Number.isFinite(value) && value >= 0) || assignment.areaM2 <= 0)
        errors.push(`Affectation Gk/Qk invalide sur ${assignment.loadName}.`);
      const floorContributions = floor ? buildingLoadModel.contributions.filter(item => item.floorId === floor.id) : [];
      return { id: assignment.id, loadName: assignment.loadName, sourceType: assignment.sourceType, kind: assignment.kind, areaM2: assignment.areaM2, gkKnM2: assignment.gkKnM2, qkKnM2: assignment.qkKnM2, gk: assignment.gkKn, qk: assignment.qkKn, transferred: floorContributions.length > 0 };
    });
    for (const floor of floors) {
      const floorAssignments = assignments.filter(assignment => assignment.parentElementId === floor.id);
      const assignedGk = floorAssignments.reduce((sum, assignment) => sum + assignment.gkKn, 0);
      const assignedQk = floorAssignments.reduce((sum, assignment) => sum + assignment.qkKn, 0);
      const floorContributions = buildingLoadModel.contributions.filter(item => item.floorId === floor.id);
      const transferredGk = floorContributions.reduce((sum, item) => sum + item.gk, 0);
      const transferredQk = floorContributions.reduce((sum, item) => sum + item.qk, 0);
      if (!floorAssignments.length) errors.push(`Aucune charge propre n’est attribuée à l’élément porteur ${floor.id}.`);
      if (Math.abs(assignedGk - floor.gk) > Math.max(0.05, floor.gk * 0.01) || Math.abs(assignedQk - floor.qk) > Math.max(0.05, floor.qk * 0.01))
        errors.push(`Les affectations par surface de ${floor.id} ne rejoignent pas Gk/Qk de l’élément (résidus ${(assignedGk - floor.gk).toFixed(2)}/${(assignedQk - floor.qk).toFixed(2)} kN).`);
      if ((floor.gk > 1e-6 || floor.qk > 1e-6) && !floorContributions.length) errors.push(`Aucun transfert vers un appui réel n’est calculé pour la surface ${floor.id}.`);
      const gResidual = Math.abs(transferredGk - floor.gk), qResidual = Math.abs(transferredQk - floor.qk);
      if (floorContributions.length && (gResidual > Math.max(0.05, floor.gk * 0.01) || qResidual > Math.max(0.05, floor.qk * 0.01))) errors.push(`Le transfert de ${floor.id} ne conserve pas Gk/Qk (résidus ${gResidual.toFixed(2)}/${qResidual.toFixed(2)} kN).`);
    }
    const skeletonRows = buildingLoadModel.rows.filter(row => ["Poutre", "Voile", "Longrine de redressement", "Poteau", "Semelle"].includes(row.type)).map(row => ({
      id: row.id,
      loadName: row.type === "Semelle" ? `Fondation · résultante G/Q · ${row.id}` : `Squelette · ${row.type} · ${row.id}`,
      type: row.type,
      gk: row.gk,
      qk: row.qk,
      sources: row.sources,
    }));
    for (const row of skeletonRows) if (![row.gk, row.qk].every(value => Number.isFinite(value) && value >= 0)) errors.push(`Charges Gk/Qk invalides sur l’élément de squelette ${row.id}.`);
    const plateErrors = surfaceAnalysis?.errors ?? [];
    if (plateErrors.length) errors.push(...plateErrors.map(message => `Dalle / balcon · ${message}`));
    const combinationRows: LoadApplicationReport["combinationRows"] = [];
    for (const combination of enabledCombinations) {
      const gravity = buildGravityMemberLoads(analyticalModel, buildingLoadModel, combination, loadProgram);
      errors.push(...gravity.errors.map(message => `${combination.name} · ${message}`));
      warnings.push(...gravity.warnings.map(message => `${combination.name} · ${message}`));
      combinationRows.push({ id: combination.id, name: combination.name, category: combination.category, formula: combination.formula ?? combination.note, status: combination.status, lineLoadCount: gravity.memberLoads.filter(item => item.elementId && Number.isFinite(item.qyKnM) && Math.abs(item.qyKnM ?? 0) > 1e-9).length });
    }
    if (enabledCombinations.some(item => item.status === "provisional")) warnings.push("Une combinaison active a été modifiée manuellement ou ne provient pas du catalogue NF EN/NA; ses coefficients doivent être vérifiés.");
    const massSourceConfirmed = loadProgram.massSource.status === "ready" || loadProgram.massSource.provenance === "confirmed";
    if (!massSourceConfirmed) warnings.push("La source de masse sismique reste une pré-étude : l’application complète de ψE=φ·ψ2 selon l’EC8 et sa distribution par niveau doivent être vérifiées.");
    const report: LoadApplicationReport = { errors: Array.from(new Set(errors)), warnings: Array.from(new Set(warnings)), surfaceRows, skeletonRows, combinationRows, lineLoadCount: combinationRows.reduce((sum, item) => sum + item.lineLoadCount, 0) };
    setLoadApplicationReport(report);
    setShowLoadDetails(false);
    // Un avertissement non traité reste bloquant : aucun résultat ne doit
    // être présenté tant que la cohérence du transfert n'est pas validée.
    const ready = report.errors.length === 0 && report.warnings.length === 0;
    setLoadCasesPrerequisiteReady(ready);
    if (ready) toast.success(`Charges appliquées et contrôlées · ${surfaceRows.length} surface(s) · ${enabledCombinations.length} combinaison(s) · ${report.lineLoadCount} charge(s) linéaire(s) générée(s) sur les combinaisons actives.`);
    else toast.error(`Application des charges bloquée : ${report.errors[0] ?? report.warnings[0] ?? "contrôle à compléter"}`);
  };
  const focusCalculationDiagnostic = (message: string) => {
    if (/source de masse|masse sismique|ψe|ψ2|ec8|fraction de q|coefficient de masse|accélération de la pesanteur/i.test(message)) {
      setPanel("Calculer la descente");
      setShowCalculationPreflight(false);
      requestAnimationFrame(() => {
        const target = document.getElementById("gcbtp-mass-source-editor");
        target?.setAttribute("open", "");
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      toast.info("Section Source de masse ouverte : renseignez ou vérifiez les facteurs EC8 et la fraction de Q.");
      return;
    }
    const token = message.match(/\b(?:PL|DAL|BAL|ESC|S|P|B)\d+\b/i)?.[0]?.toLowerCase();
    const level = token ? selected?.levels.find(item => item.elements.some(element => element.id.toLowerCase() === token)) : undefined;
    const element = level?.elements.find(item => item.id.toLowerCase() === token);
    if (level && element) {
      setActiveLevelId(level.id);
      setSelected3DElementKey(`${level.id}:${element.id}`);
      setPanel("Éléments du niveau");
      setShowCalculationPreflight(false);
      toast.info(`Élément ${element.id} sélectionné : corrigez le contrôle puis relancez l’application des charges.`);
      return;
    }
    toast.info("Aucun élément unique n’a été identifié dans ce message. Ouvrez les éléments du niveau et corrigez l’hypothèse indiquée.");
  };
  const downloadSurfaceAnalysis = () => {
    if (!surfaceAnalysis) return;
    const blob = new Blob([JSON.stringify({ schemaVersion: SURFACE_ANALYSIS_SCHEMA_VERSION, units: { length: "m", force: "kN", momentPerLength: "kN·m/m" }, combinationId: solverCombinationId, results: surfaceAnalysis }, null, 2)], { type: "application/json" });
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
      const remappedStairGeometry = element.stairGeometry
        ? remapPointFields(element.stairGeometry, oldX, oldY, nextX, nextY) as StairGeometry
        : element.stairGeometry;
      return {
        ...element,
        x: metricToIndex(metric.xM, nextX),
        y: metricToIndex(metric.yM, nextY),
        x2: metric.x2M === undefined ? element.x2 : metricToIndex(metric.x2M, nextX),
        y2: metric.y2M === undefined ? element.y2 : metricToIndex(metric.y2M, nextY),
        xMid: metric.xMidM === undefined ? element.xMid : metricToIndex(metric.xMidM, nextX),
        yMid: metric.yMidM === undefined ? element.yMid : metricToIndex(metric.yMidM, nextY),
        xM: metric.xM, yM: metric.yM, x2M: metric.x2M, y2M: metric.y2M, xMidM: metric.xMidM, yMidM: metric.yMidM,
        stairGeometry: remappedStairGeometry,
        absoluteStairGeometry: element.type === "Escaliers"
          ? (element.absoluteStairGeometry ?? freezeStairGeometry(element.stairGeometry, oldX, oldY))
          : element.absoluteStairGeometry,
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
  const updateGeotechnicalProfile = (patch: Partial<ProjectGeotechnicalProfile>) => {
    if (!selected) return;
    const current = normalizeProjectGeotechnicalProfile(selected.soil);
    const next = normalizeProjectGeotechnicalProfile({ ...current, ...patch, status: "entered", sourceStatus: patch.sourceStatus ?? (current.sourceStatus === "catalog" ? "modified" : current.sourceStatus) });
    updateSelected({ soil: next });
  };
  const applyGeotechnicalCatalog = (profileId: string) => {
    if (!selected) return;
    const next = copyCatalogToProject(getGeotechnicalCatalogProfile(profileId));
    updateSelected({ soil: next });
    toast.success(`Profil « ${next.profileName} » copié dans le projet`);
  };
  const restoreGeotechnicalCatalog = () => {
    if (!selected) return;
    const current = normalizeProjectGeotechnicalProfile(selected.soil);
    applyGeotechnicalCatalog(current.catalogProfileId ?? getGeotechnicalCatalogProfiles(selected.country)[0]?.id ?? DEFAULT_GEOTECHNICAL_CATALOG_ID);
  };
  useEffect(() => {
    if (!selected) return;
    let changed = false;
    const levels = selected.levels.map(level => ({
      ...level,
      elements: level.elements.map(element => {
        if (element.type !== "Escaliers") return element;
        const absolute = element.absoluteStairGeometry;
        const geometry = absolute ?? element.stairGeometry;
        const scale = absolute ? 1 : numericGridDistance(gridDistance, 4);
        const flight = geometry?.flight1;
        if (!flight) return element;
        const edgeWidth = (Math.hypot(flight.lowerA.x - flight.lowerB.x, flight.lowerA.y - flight.lowerB.y) + Math.hypot(flight.upperA.x - flight.upperB.x, flight.upperA.y - flight.upperB.y)) / 2 * scale;
        const centerLower = { x: (flight.lowerA.x + flight.lowerB.x) / 2, y: (flight.lowerA.y + flight.lowerB.y) / 2 };
        const centerUpper = { x: (flight.upperA.x + flight.upperB.x) / 2, y: (flight.upperA.y + flight.upperB.y) / 2 };
        const measuredRun = Math.hypot(centerUpper.x - centerLower.x, centerUpper.y - centerLower.y) * scale;
        if (!(edgeWidth > 0) || !(measuredRun > 0)) return element;
        const config = normalizeFloorConfig({ ...defaultFloorConfig, ...element.floorConfig, type: "Dalle pleine", thickness: element.floorConfig?.thickness ?? "15 cm" });
        const savedDepth = Number(String(config.stairLandingDepthM ?? "").replace(",", "."));
        const savedRun = Number(String(config.stairRun ?? "").replace(",", "."));
        const depthWrong = !Number.isFinite(savedDepth) || savedDepth <= 0;
        const runWrong = !Number.isFinite(savedRun) || savedRun <= 0 || (Math.abs(savedRun - 3.6) <= 0.01 && Math.abs(savedRun - measuredRun) > 0.01);
        const nextConfig: FloorConfig = {
          ...config,
          stairLandingDepthM: depthWrong ? edgeWidth.toFixed(2) : config.stairLandingDepthM,
          stairRun: runWrong ? measuredRun.toFixed(2) : config.stairRun,
          stairLandingFinishLoad: config.stairLandingFinishLoad ?? config.finishLoad ?? "1.00",
          stairLandingImposedLoad: config.stairLandingImposedLoad ?? config.characteristicImposedLoad ?? usageProfile(selected.projectUsage).stairLoad.toFixed(2),
        };
        if (!depthWrong && !runWrong && element.floorConfig?.stairLandingFinishLoad && element.floorConfig?.stairLandingImposedLoad) return element;
        changed = true;
        return { ...element, floorConfig: nextConfig };
      }),
    }));
    if (changed) updateSelected({ levels });
  }, [selected?.id]);
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
      elements: level.elements.map(element => element.id === elementId ? { ...element, type: modelType, section: sectionName, color: existing?.color ?? element.color ?? colorForModel(modelType, sectionName), columnVerificationSnapshot: modelType === "Poteau" && element.section === sectionName ? element.columnVerificationSnapshot : undefined } : element),
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
    const measuredFlight = absoluteStairGeometry?.flight1;
    const measuredStairWidthM = measuredFlight ? (Math.hypot(measuredFlight.lowerA.x - measuredFlight.lowerB.x, measuredFlight.lowerA.y - measuredFlight.lowerB.y) + Math.hypot(measuredFlight.upperA.x - measuredFlight.upperB.x, measuredFlight.upperA.y - measuredFlight.upperB.y)) / 2 : undefined;
    const measuredStairRunM = measuredFlight ? Math.hypot((measuredFlight.upperA.x + measuredFlight.upperB.x - measuredFlight.lowerA.x - measuredFlight.lowerB.x) / 2, (measuredFlight.upperA.y + measuredFlight.upperB.y - measuredFlight.lowerA.y - measuredFlight.lowerB.y) / 2) : undefined;
    const stairFloorConfig = normalizeFloorConfig({
      ...floorConfig,
      ...floorOverride,
      type: "Dalle pleine",
      thickness: floorOverride?.thickness ?? floorConfig.thickness ?? "15 cm",
      characteristicImposedLoad: floorOverride?.characteristicImposedLoad ?? floorConfig.characteristicImposedLoad ?? usageProfile(projectUsage).stairLoad.toFixed(2),
      stairLandingDepthM: floorOverride?.stairLandingDepthM ?? floorConfig.stairLandingDepthM ?? (measuredStairWidthM && measuredStairWidthM > 0 ? measuredStairWidthM.toFixed(2) : "1.00"),
      stairRun: floorOverride?.stairRun ?? (measuredStairRunM && measuredStairRunM > 0 ? measuredStairRunM.toFixed(2) : floorConfig.stairRun ?? "3.60"),
      stairLandingFinishLoad: floorOverride?.stairLandingFinishLoad ?? floorConfig.stairLandingFinishLoad ?? floorConfig.finishLoad ?? "1.00",
      stairLandingImposedLoad: floorOverride?.stairLandingImposedLoad ?? floorConfig.stairLandingImposedLoad ?? floorOverride?.characteristicImposedLoad ?? floorConfig.characteristicImposedLoad ?? usageProfile(projectUsage).stairLoad.toFixed(2),
      stairRiser: floorOverride?.stairRiser ?? floorConfig.stairRiser ?? "0.17",
      stairTread: floorOverride?.stairTread ?? floorConfig.stairTread ?? "0.30",
      stairRise: floorOverride?.stairRise ?? floorConfig.stairRise ?? "2.04",
      stairFinishLoad: floorOverride?.stairFinishLoad ?? floorConfig.stairFinishLoad ?? "0.00",
    });
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
      foundationMode: modelType === "Semelle" ? foundationPlacementMode : undefined,
      foundationDirection: modelType === "Semelle" && foundationPlacementMode === "eccentric" ? foundationPlacementDirection ?? undefined : undefined,
      stairGeometry,
      absoluteStairGeometry,
      floorConfig:
        isSlabElementType(modelType) || modelType === "Escaliers"
          ? (modelType === "Escaliers" ? stairFloorConfig : floorOverride ?? (modelType === "Balcon" ? normalizeFloorConfig({ ...floorConfig, type: "Dalle pleine", thickness: floorConfig.type === "Dalle pleine" ? floorConfig.thickness : "20 cm" }) : floorConfig))
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
    if (modelType === "Aucun") {
      setPlacementStart(null);
      setHoverPoint(null);
      setFloorPreview(null);
      return;
    }
    if (modelType === "Semelle" && foundationPlacementMode === "eccentric" && footingCenterOffset("eccentric", foundationPlacementDirection, 1, 1) === null) {
      toast.info("Choisissez au moins une direction de décalage (X ou Y) avant la pose.");
      return;
    }
    setPanel(null);
    if (modelType === "Escaliers") {
      return handleStairPoint(point);
    }
    const isBeam = modelType === "Poutre" || modelType === "Voile" || modelType === "Longrine de redressement";
    const isTieBeam = modelType === "Longrine de redressement";
    const isSlab = isSlabElementType(modelType);
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
    const expectedDifferentFrom = [2].includes(index) ? stairPointLevels[index - 1] : undefined;
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
    const upperLevelId = nextLevels[2];
    const lowerIndex = selected.levels.findIndex(level => level.id === lowerLevelId);
    const upperIndex = selected.levels.findIndex(level => level.id === upperLevelId);
    if (lowerIndex < 0 || upperIndex < 0 || !(lowerIndex < upperIndex)) {
      toast.info("Un escalier doit relier deux niveaux dans l’ordre : plancher bas puis plancher haut. Le palier intermédiaire est placé à mi-hauteur.");
      setStairConstructionPoints([]);
      setStairPointLevels([]);
      setStairPlacementStage(1);
      return;
    }
    const resolvedLevels = [lowerLevelId, lowerLevelId, upperLevelId, upperLevelId, upperLevelId, upperLevelId, upperLevelId];
    const lowerElevation = floorTopElevation(selected.levels[lowerIndex], lowerIndex);
    const upperElevation = floorTopElevation(selected.levels[upperIndex], upperIndex);
    const totalHeight = Math.max(0.01, upperElevation - lowerElevation);
    const stairConfig = normalizeFloorConfig({ ...floorConfig, type: "Dalle pleine", thickness: "15 cm", characteristicImposedLoad: usageProfile(projectUsage).stairLoad.toFixed(2), stairRiser: "0.17", stairTread: "0.30", stairRise: "2.04", stairRun: "3.60", stairFinishLoad: "0.00", direction: "X" });
    addElement(lowerA1.x, lowerA1.y, upperB2, stairConfig, nextPoints[2], {
      flight1: { lowerA: nextPoints[0], lowerB: nextPoints[1], upperA: nextPoints[2], upperB: nextPoints[3], lowerLevelId: resolvedLevels[0], upperLevelId: resolvedLevels[2] },
      flight2: { lowerA: nextPoints[3], lowerB: nextPoints[4], upperA: nextPoints[5], upperB: nextPoints[6], lowerLevelId: resolvedLevels[3], upperLevelId: resolvedLevels[5] },
      landingZ: totalHeight / 2,
    }, upperLevelId);
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
    if (pointTarget && (modelType === "Poutre" || modelType === "Voile" || modelType === "Longrine de redressement" || isSlabElementType(modelType))) {
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
    if ((isSlabElementType(modelType) || modelType === "Escaliers") && point && placementStart) {
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
    if (!isSlabElementType(modelType) && modelType !== "Escaliers") setFloorPreview(null);
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
  const bulkLevelElements = activeLevel?.elements ?? [];
  const bulkVisibleElements = bulkElementType === "Tous"
    ? bulkLevelElements
    : bulkLevelElements.filter(item => item.type === bulkElementType);
  const toggleBulkElement = (id: string) => {
    setBulkSelectedElementIds(previous => previous.includes(id) ? previous.filter(item => item !== id) : [...previous, id]);
  };
  const selectAllBulkElements = () => {
    setBulkSelectedElementIds(previous => Array.from(new Set([...previous, ...bulkVisibleElements.map(item => item.id)])));
  };
  const clearBulkElements = () => setBulkSelectedElementIds([]);
  const applyBulkSection = (section = bulkSection) => {
    if (!selected || !activeLevel || bulkElementType === "Tous" || !section) return;
    const selectedIds = new Set(bulkSelectedElementIds);
    const matching = activeLevel.elements.filter(item => selectedIds.has(item.id) && item.type === bulkElementType);
    if (!matching.length) return toast.info("Cochez au moins un élément du type choisi.");
    const levels = selected.levels.map(level => level.id !== activeLevel.id ? level : {
      ...level,
      elements: level.elements.map(item => matching.some(entry => entry.id === item.id)
        ? { ...item, section, color: colorForModel(item.type, section), floorConfig: isSlabElementType(item.type) ? floorConfigForSection(section, item.floorConfig ?? floorConfig) : item.floorConfig }
        : item),
    });
    updateSelected({ levels });
    setBulkSection(section);
    setBulkSectionPickerOpen(false);
    toast.success(`${matching.length} élément${matching.length > 1 ? "s" : ""} modifié${matching.length > 1 ? "s" : ""} sans recréation.`);
  };
  const deleteBulkElements = () => {
    if (!selected || !activeLevel || !bulkSelectedElementIds.length) return toast.info("Cochez au moins un élément à supprimer.");
    const ids = new Set(bulkSelectedElementIds);
    updateSelected({ levels: selected.levels.map(level => level.id === activeLevel.id ? { ...level, elements: level.elements.filter(item => !ids.has(item.id)) } : level) });
    setBulkSelectedElementIds([]);
    toast.success(`${ids.size} élément${ids.size > 1 ? "s" : ""} supprimé${ids.size > 1 ? "s" : ""}.`);
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
    if (item.type === "Escaliers") {
      const absolute = item.absoluteStairGeometry;
      const flight = absolute?.flight1 ?? item.stairGeometry?.flight1;
      const scale = absolute?.flight1 ? 1 : numericGridDistance(gridDistance, 4);
      const widthM = flight ? (Math.hypot(flight.lowerA.x - flight.lowerB.x, flight.lowerA.y - flight.lowerB.y) + Math.hypot(flight.upperA.x - flight.upperB.x, flight.upperA.y - flight.upperB.y)) / 2 * scale : 1;
      const runM = flight ? Math.hypot((flight.upperA.x + flight.upperB.x - flight.lowerA.x - flight.lowerB.x) / 2, (flight.upperA.y + flight.upperB.y - flight.lowerA.y - flight.lowerB.y) / 2) * scale : 3.6;
      const config = normalizeFloorConfig({ ...defaultFloorConfig, ...item.floorConfig, type: "Dalle pleine", thickness: item.floorConfig?.thickness ?? "15 cm", characteristicImposedLoad: item.floorConfig?.characteristicImposedLoad ?? usageProfile(projectUsage).stairLoad.toFixed(2) });
      setFloorConfig({ ...config, stairLandingDepthM: config.stairLandingDepthM ?? widthM.toFixed(2), stairRun: config.stairRun ?? runM.toFixed(2), stairLandingFinishLoad: config.stairLandingFinishLoad ?? config.finishLoad ?? "1.00", stairLandingImposedLoad: config.stairLandingImposedLoad ?? config.characteristicImposedLoad });
    } else if (isSlabElementType(item.type))
      setFloorConfig(item.type === "Balcon"
        ? normalizeFloorConfig(item.floorConfig ? { ...item.floorConfig, type: "Dalle pleine" } : defaultBalconyFloorConfig())
        : normalizeFloorConfig(item.floorConfig ?? floorConfigForSection(item.section)));
    setElementSelectionMode(true);
    setPanel("Éditer l’élément");
  };
  const saveElementEdit = () => {
    if (!selected || !editingElement || !editingLevelId) return;
    if (editType === "Semelle" && editingElement.foundationMode === "eccentric" && footingCenterOffset("eccentric", editingElement.foundationDirection, 1, 1) === null)
      return toast.error("Choisissez au moins une direction de décalage (X ou Y) avant d’enregistrer la semelle.");
    const parsedOpenings = isSlabElementType(editType) ? parseSurfaceOpeningLines(editSurfaceOpenings) : { openings: [] as RectangularOpening[], error: null as string | null };
    if (parsedOpenings.error) return toast.error(parsedOpenings.error);
    const updated = {
      ...editingElement,
      type: editType,
      section: editSection,
      columnVerificationSnapshot: editType === "Poteau" && editSection === editingElement.section ? editingElement.columnVerificationSnapshot : undefined,
      color: normalizeModelColor(
        editColor,
        colorForModel(editType, editSection)
      ),
      x: Number(editX) || 0,
      y: Number(editY) || 0,
      foundationMode: editType === "Semelle" ? editingElement.foundationMode ?? "centered" : undefined,
      foundationDirection: editType === "Semelle" && editingElement.foundationMode === "eccentric" ? editingElement.foundationDirection : undefined,
      floorConfig:
        isSlabElementType(editType) || editType === "Escaliers"
          ? editType === "Escaliers" ? normalizeFloorConfig({ ...floorConfig, type: "Dalle pleine" }) : editType === "Balcon" ? normalizeFloorConfig({ ...floorConfig, type: "Dalle pleine" }) : floorConfigForSection(editSection, floorConfig)
          : undefined,
      openings: isSlabElementType(editType) ? parsedOpenings.openings : undefined,
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
  const selectedColumnBeamOrigins = selectedAnalysisRow?.type === "Poteau"
    ? (buildingLoadModel?.columnBeamContributions[selectedAnalysisRow.id] ?? []).map(origin => ({
        ...origin,
        label: buildingLoadModel?.rows.find(row => row.id === origin.beamId)?.label.replace(/^(?:Poutre|Voile)\s+/, "") ?? origin.beamId,
      }))
    : [];
  const selectedOwnWeight = selectedAnalysisRow?.type === "Poteau"
    ? buildingLoadModel?.columnSelfWeights[selectedAnalysisRow.id] ?? 0
    : 0;
  const selectedBeamG = selectedColumnBeamOrigins.reduce((sum, origin) => sum + origin.gk, 0);
  const selectedBeamQ = selectedColumnBeamOrigins.reduce((sum, origin) => sum + origin.qk, 0);
  const selectedColumnOtherOrigins = selectedAnalysisRow?.type === "Poteau"
    ? buildingLoadModel?.columnOtherContributions[selectedAnalysisRow.id] ?? []
    : [];
  const selectedColumnTransferredOrigins = selectedAnalysisRow?.type === "Poteau"
    ? (buildingLoadModel?.columnTransferredContributions[selectedAnalysisRow.id] ?? []).map(origin => {
        const sourceRow = buildingLoadModel?.rows.find(row => row.id === origin.sourceColumnId);
        const sourceLevel = selected?.levels.find(level => level.id === sourceRow?.levelId)?.label;
        return { ...origin, label: sourceRow?.label ?? `Poteau ${origin.sourceColumnId}`, levelLabel: sourceLevel };
      })
    : [];
  const selectedOtherG = selectedColumnOtherOrigins.reduce((sum, origin) => sum + origin.gk, 0);
  const selectedOtherQ = selectedColumnOtherOrigins.reduce((sum, origin) => sum + origin.qk, 0);
  const selectedTransferredG = selectedColumnTransferredOrigins.reduce((sum, origin) => sum + origin.gk, 0);
  const selectedTransferredQ = selectedColumnTransferredOrigins.reduce((sum, origin) => sum + origin.qk, 0);
  const selectedUnexplainedG = selectedAnalysisRow ? selectedAnalysisRow.gk - selectedOwnWeight - selectedBeamG - selectedOtherG - selectedTransferredG : 0;
  const selectedUnexplainedQ = selectedAnalysisRow ? selectedAnalysisRow.qk - selectedBeamQ - selectedOtherQ - selectedTransferredQ : 0;
  const selectedColumnSolvedMoments = selectedAnalysisRow?.type === "Poteau"
    ? rcMemberExtraction.demands.find(demand => demand.id === selectedAnalysisRow.id && demand.type === "column")
    : undefined;
  const selectedColumnVerificationDesign = rcDesignResult?.elements.find(element => element.elementId === selectedAnalysisRow?.id && element.type === "column");
  const baelColumnChecksActive = selectedColumnVerificationDesign?.checks.find(item => item.id === "column-bael-detailing")?.label.includes("BAEL") ?? false;
  const columnVerificationCheckIds = new Set([
    "column-axial", "column-interaction", "column-steel-min", "column-steel-max", "column-bar-spacing", "column-bar-layout-count", "column-tie-spacing",
    ...(baelColumnChecksActive ? ["column-second-order", "column-bael-detailing"] : []),
  ]);
  const columnVerificationCoreChecks = selectedColumnVerificationDesign?.checks.filter(item => [
    ...columnVerificationCheckIds,
  ].includes(item.id)) ?? [];
  const unsupportedColumnBarCheck = selectedColumnVerificationDesign?.checks.find(item => item.id === "column-longitudinal-diameter");
  const baelSecondOrderDomainCheck = selectedColumnVerificationDesign?.checks.find(item => item.id === "column-second-order");
  const requiredColumnVerificationChecks = baelColumnChecksActive ? 9 : 7;
  const columnVerificationFailedChecks = [...columnVerificationCoreChecks.filter(item => item.status === "non satisfaisant"), ...(unsupportedColumnBarCheck ? [unsupportedColumnBarCheck] : [])];
  const columnVerificationState: "idle" | "running" | "stale" | "blocked" | "failed" | "passed" = columnVerificationFeedback
    ? "blocked"
    : !columnVerificationRequested ? "idle"
      : columnVerificationGeometry?.dirty ? "stale"
        : !rcDesignResult ? "running"
          : unsupportedColumnBarCheck ? "failed"
          : !selectedColumnVerificationDesign || columnVerificationCoreChecks.length < requiredColumnVerificationChecks || columnVerificationCoreChecks.some(item => item.status !== "satisfaisant" && item.status !== "non satisfaisant") ? "blocked"
            : columnVerificationFailedChecks.length ? "failed" : "passed";
  const selectableColumnBarDiameters = (rcDesignResult?.materialBasis.availableBarDiametersMm ?? [8, 10, 12, 14, 16, 20, 25, 32, 40]).filter(diameter => diameter >= (baelColumnChecksActive ? 8 : 10));
  const selectableColumnBarCounts = [4, 6, 8, 9, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40].filter(count => columnVerificationGeometry?.shape !== "circular" || count >= 6);
  const updateColumnBarDiameterSelection = (diameter?: number) => {
    setColumnVerificationSelectedBarDiameters(current => diameter === undefined
      ? []
      : current.includes(diameter) ? current.filter(value => value !== diameter) : [...current, diameter].sort((a, b) => a - b));
    setColumnVerificationGeometry(current => current ? { ...current, dirty: true } : current);
  };
  const updateColumnBarCountSelection = (count?: number) => {
    setColumnVerificationSelectedBarCount(count ?? null);
    setColumnVerificationGeometry(current => current ? { ...current, dirty: true } : current);
  };
  const columnVerificationConfigurationKey = JSON.stringify([
    selected?.id, selectedAnalysisRow?.levelId, selectedAnalysisRow?.id,
    columnVerificationGeometry?.shape, columnVerificationGeometry?.widthM, columnVerificationGeometry?.depthM,
    columnVerificationGeometry?.diameterM, columnVerificationGeometry?.heightM,
    columnVerificationGeometry?.selfWeight, columnVerificationLoads, columnVerificationSelectedBarDiameters, columnVerificationSelectedBarCount,
  ]);
  const columnVerificationAlreadySaved = columnVerificationSavedKey === columnVerificationConfigurationKey;
  useEffect(() => {
    if (!columnVerificationRequested || (columnVerificationState !== "passed" && columnVerificationState !== "failed" && columnVerificationState !== "blocked")) return;
    const noticeKey = `${selectedAnalysisRow?.id ?? "none"}:${columnVerificationState}:${unsupportedColumnBarCheck?.id ?? columnVerificationFailedChecks.map(item => item.id).join(",")}`;
    if (lastColumnVerificationNotice.current === noticeKey) return;
    lastColumnVerificationNotice.current = noticeKey;
    if (columnVerificationState === "passed") toast.success(`Section dimensionnée pour ${selectedAnalysisRow?.id ?? "le poteau"}.`);
    else if (columnVerificationState === "failed") toast.error(unsupportedColumnBarCheck ? "Diamètre longitudinal non admis par le moteur pour un poteau." : baelSecondOrderDomainCheck?.status === "non satisfaisant" ? "La stabilité BAEL A.4.4 n’est pas satisfaite : augmentez A/B manuellement ou revoyez f et les appuis." : `Section ou armatures insuffisantes : ${columnVerificationFailedChecks.map(item => item.label).join(", ") || "contrôle non satisfait"}.`);
    else toast.info(columnVerificationFeedback ?? selectedColumnVerificationDesign?.checks.find(item => item.status === "bloqué")?.formula ?? "Vérification bloquée : données ou contrôle normatif manquant.");
  }, [columnVerificationRequested, columnVerificationState, selectedAnalysisRow?.id, unsupportedColumnBarCheck, baelSecondOrderDomainCheck, columnVerificationFailedChecks, columnVerificationFeedback, selectedColumnVerificationDesign]);
  const runColumnVerification = () => {
    setColumnVerificationRequested(true);
    setColumnVerificationSavedKey(null);
    setColumnVerificationFeedback(null);
    setRcDesignResult(null);
    lastColumnVerificationNotice.current = "";
    if (!selectedAnalysisRow || selectedAnalysisRow.type !== "Poteau" || !columnVerificationGeometry) {
      setColumnVerificationFeedback("Sélectionnez un poteau avec sa fiche géométrique renseignée.");
      return;
    }
    if (columnVerificationLoadsDirty) {
      setColumnVerificationFeedback("Les charges ou le poids propre ont changé depuis l’analyse. Relancez d’abord l’analyse structurelle pour actualiser ensemble N, Mx et My.");
      return;
    }
    const solved = rcMemberExtraction.demands.find(demand => demand.id === selectedAnalysisRow.id && demand.type === "column");
    if (!solved || !Number.isFinite(solved.momentXKnM ?? solved.momentKnM) || !Number.isFinite(solved.momentYKnM ?? 0)) {
      setColumnVerificationFeedback("Efforts Mx/My indisponibles pour ce poteau. Lancez une analyse structurale exploitable avant la vérification.");
      return;
    }
    if (!analyticalPrecheck?.ok) {
      setColumnVerificationFeedback("Le modèle analytique comporte des blocages. Corrigez-les avant de vérifier le poteau.");
      return;
    }
    const numericDimension = (value: string) => Number(value.replace(",", "."));
    const widthM = columnVerificationGeometry.shape === "circular" ? numericDimension(columnVerificationGeometry.diameterM) : numericDimension(columnVerificationGeometry.widthM);
    const depthM = columnVerificationGeometry.shape === "circular" ? numericDimension(columnVerificationGeometry.diameterM) : numericDimension(columnVerificationGeometry.depthM);
    const heightM = Number(columnVerificationGeometry.heightM.replace(",", "."));
    if (![widthM, depthM, heightM].every(value => Number.isFinite(value) && value > 0)) {
      setColumnVerificationFeedback(columnVerificationGeometry.shape === "circular" ? "Renseignez un diamètre et une longueur libre strictement positifs." : "Renseignez une largeur, une profondeur et une longueur libre strictement positives.");
      return;
    }
    if (columnVerificationLoads.some(load => !load.axialKn.trim() || !Number.isFinite(Number(load.axialKn.replace(",", "."))))) {
      setColumnVerificationFeedback("Chaque ligne de charge doit contenir un effort axial numérique.");
      return;
    }
    setColumnVerificationGeometry(current => current ? { ...current, dirty: false } : current);
    setReinforcementPlanRequestToken(token => token + 1);
  };
  const saveColumnVerificationResult = () => {
    if (columnVerificationState !== "passed" || !selected || !selectedAnalysisRow || !columnVerificationGeometry) {
      toast.error("Seule une vérification satisfaisante peut être enregistrée.");
      return;
    }
    const numericDimension = (value: string) => Number(value.trim().replace(",", "."));
    const circular = columnVerificationGeometry.shape === "circular";
    const widthM = circular ? numericDimension(columnVerificationGeometry.diameterM) : numericDimension(columnVerificationGeometry.widthM);
    const depthM = circular ? widthM : numericDimension(columnVerificationGeometry.depthM);
    if (![widthM, depthM].every(value => Number.isFinite(value) && value > 0)) {
      toast.error("Dimensions de section invalides : aucune modification n’a été enregistrée.");
      return;
    }
    const levelId = selectedAnalysisRow.levelId;
    const sourceLevel = selected.levels.find(level => level.id === levelId);
    const sourceElement = sourceLevel?.elements.find(element => element.id === selectedAnalysisRow.id && element.type === "Poteau");
    if (!sourceLevel || !sourceElement) {
      toast.error("Le poteau sélectionné n’est plus présent à son niveau d’origine; aucune modification n’a été enregistrée.");
      return;
    }
    const verifiedDesign = selectedColumnVerificationDesign;
    const verifiedDemand = columnVerificationMemberDemands.find(demand => demand.id === selectedAnalysisRow.id && demand.type === "column");
    if (!verifiedDesign || !verifiedDemand) {
      toast.error("Le résultat de calcul ou les efforts du poteau ne sont plus disponibles; aucune modification n’a été enregistrée.");
      return;
    }
    const token = (valueM: number) => {
      const centimeters = valueM * 100;
      return Number.isInteger(centimeters) ? String(centimeters) : centimeters.toFixed(1).replace(".", "p");
    };
    const baseSectionName = circular ? `Pot_D${token(widthM)}` : `Pot_${token(widthM)}x${token(depthM)}`;
    const formatMeters = (valueM: number) => Number(valueM.toFixed(3)).toString();
    const dimensions = circular ? `${formatMeters(widthM)} m` : `${formatMeters(widthM)} × ${formatMeters(depthM)} m`;
    const type = "Poteau";
    const family: ModelSpec["family"] = circular ? "Poteau (Cir)" : "Poteau (Rect)";
    const preservedColor = sourceElement.color ?? colorForModel(type, sourceElement.section);
    const catalogDimensionsMatch = (model: ModelSpec) => {
      const values = model.dimensions.match(/\d+(?:[.,]\d+)?/g)?.map(value => Number(value.replace(",", "."))) ?? [];
      const factor = /mm/i.test(model.dimensions) ? 0.001 : /cm/i.test(model.dimensions) ? 0.01 : 1;
      const expected = circular ? [widthM] : [widthM, depthM];
      return values.length >= expected.length && expected.every((value, index) => Math.abs((values[index] ?? 0) * factor - value) < 0.0005);
    };
    let sectionName = baseSectionName;
    const sameNameSpec = structuralCatalog.find(model => model.type === type && model.name === sectionName);
    if (sameNameSpec && !catalogDimensionsMatch(sameNameSpec)) {
      let suffix = 2;
      while (structuralCatalog.some(model => model.type === type && model.name === `${baseSectionName}_v${suffix}`)) suffix += 1;
      sectionName = `${baseSectionName}_v${suffix}`;
    }
    const catalogEntry = structuralCatalog.find(model => model.type === type && model.name === sectionName);
    if (!catalogEntry) {
      setCustomModels(current => current.some(model => model.type === type && model.name === sectionName)
        ? current
        : [...current, { family, type, name: sectionName, dimensions, color: preservedColor }]);
    }
    const snapshot: ColumnVerificationSnapshot = {
      savedAt: new Date().toISOString(),
      standard: selected.norm,
      sectionName,
      combinationId: verifiedDesign.combinationId,
      combinationName: verifiedDesign.combinationName,
      geometry: {
        shape: columnVerificationGeometry.shape,
        widthMm: widthM * 1000,
        depthMm: depthM * 1000,
        lengthMm: numericDimension(columnVerificationGeometry.heightM) * 1000,
        bucklingLengthMm: numericDimension(columnVerificationGeometry.heightM) * 1000,
      },
      loads: {
        axialKn: verifiedDemand.axialKn,
        momentXKnM: verifiedDemand.momentXKnM ?? verifiedDemand.momentKnM,
        momentYKnM: verifiedDemand.momentYKnM ?? 0,
      },
      reinforcement: verifiedDesign.reinforcement.map(item => ({ label: item.label, diameterMm: item.diameterMm, count: item.count, areaMm2: item.areaMm2, requiredAreaMm2: item.requiredAreaMm2 })),
      checks: verifiedDesign.checks.map(item => ({ id: item.id, label: item.label, status: item.status, demand: item.demand, resistance: item.resistance, utilization: item.utilization, unit: item.unit, formula: item.formula })),
    };
    const levels = selected.levels.map(level => level.id !== levelId ? level : {
      ...level,
      elements: level.elements.map(element => element.id === sourceElement.id
        ? { ...element, section: sectionName, color: preservedColor, columnVerificationSnapshot: snapshot }
        : element),
    });
    updateSelected({ levels });
    setColumnVerificationSavedKey(columnVerificationConfigurationKey);
    toast.success(`${selectedAnalysisRow.id} : section ${dimensions} enregistrée dans le modèle; couleur conservée en 2D et 3D. L’analyse globale des efforts reste à relancer ultérieurement.`);
  };
  const updateColumnLoadCategory = (loadId: string, category: string) => {
    const labels: Record<string, string> = { G: "Charges G", Q: "Exploitation Q", W: "Vent", S: "Neige", E: "Séisme", Autre: "Autre charge" };
    setColumnVerificationLoads(current => current.map(item => item.id === loadId ? { ...item, category, label: labels[category] ?? "Autre charge" } : item));
    setColumnVerificationLoadsDirty(true);
    setColumnVerificationGeometry(current => current ? { ...current, dirty: true } : current);
  };
  const openColumnVerification = () => {
    if (!selectedAnalysisRow || selectedAnalysisRow.type !== "Poteau") return;
    setColumnVerificationRequested(false);
    setColumnVerificationSavedKey(null);
    setColumnVerificationFeedback(null);
    setShowColumnBarCatalog(false);
    setRcDesignResult(null);
    setColumnVerificationLoadsDirty(false);
    setColumnVerificationSelectedBarDiameters([]);
    setColumnVerificationSelectedBarCount(null);
    lastColumnVerificationNotice.current = "";
    const selectedLevel = selected?.levels.find(level => level.id === selectedAnalysisRow.levelId);
    const selectedElement = selectedLevel?.elements.find(element => element.id === selectedAnalysisRow.id);
    const sectionName = selectedElement?.section ?? selectedAnalysisRow.section ?? "Pot_20x30";
    const sectionSpec = modelSpec("Poteau", sectionName);
    const dimensionText = sectionSpec?.dimensions ?? sectionName;
    const rawDimensions = dimensionText.match(/\d+(?:[.,]\d+)?/g)?.map(value => Number(value.replace(",", "."))) ?? [];
    const toMeters = (value: number) => /mm/i.test(dimensionText) ? value / 1000 : /cm/i.test(dimensionText) || value > 2 ? value / 100 : value;
    const circular = sectionSpec?.family === "Poteau (Cir)" || /(?:\bD\d|circul|diam|ø)/i.test(sectionName);
    const storyHeight = Number(String(selectedLevel?.height ?? "").replace(",", "."));
    const selectedMemberLengthM = (rcMemberExtraction.demands.find(demand => demand.id === selectedAnalysisRow.id && demand.type === "column")?.lengthMm ?? 0) / 1000;
    const columnHeightM = storyHeight > 0 ? storyHeight : selectedMemberLengthM > 0 ? selectedMemberLengthM : 0;
    setColumnVerificationGeometry({
      shape: circular ? "circular" : "rectangular",
      widthM: circular ? "" : rawDimensions[0] === undefined ? "0.20" : String(toMeters(rawDimensions[0])),
      depthM: circular ? "" : rawDimensions[1] === undefined ? "0.30" : String(toMeters(rawDimensions[1])),
      diameterM: circular ? String(toMeters(rawDimensions[0] ?? 0.25)) : "",
      heightM: columnHeightM > 0 ? columnHeightM.toFixed(2) : "",
      levelId: selectedLevel?.id ?? selectedAnalysisRow.levelId,
      selfWeight: true,
      dirty: false,
    });
    setColumnVerificationLoads([
      { id: "case-g", category: "G", label: "Charges G", axialKn: selectedAnalysisRow.gk.toFixed(1) },
      { id: "case-q", category: "Q", label: "Exploitation Q", axialKn: selectedAnalysisRow.qk.toFixed(1) },
    ]);
    setColumnVerificationOpen(true);
  };
  const closeColumnVerification = () => {
    setColumnVerificationOpen(false);
    setColumnVerificationRequested(false);
    setColumnVerificationFeedback(null);
    setColumnVerificationLoadsDirty(false);
    setRcDesignResult(null);
  };
  const analysisScaleColors = Object.fromEntries(
    analysisRows
      .filter(row => row.type === "Poteau")
      .map(row => [
        `${row.levelId}:${row.id}`,
        `${row.levelId}:${row.id}` === criticalColumnKey ? "#ff1717" : colorForModel(row.type, row.section ?? ""),
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
      loadVisuals={loadVisuals}
      showAnalysisValues={visualizationOptions.efforts}
      showAnalysisMoments={visualizationOptions.moments}
      showLinearLoads={visualizationOptions.linearLoads}
      showSurfaceLoads={visualizationOptions.surfaceLoads}
      showLoadValues={visualizationOptions.linearLoads || visualizationOptions.surfaceLoads}
      visualizationDraft={visualizationDraft}
      visualizationOptions={visualizationOptions}
      showStructureValuesMenu={showStructureValuesMenu}
      onToggleStructureValuesMenu={() => { setVisualizationDraft(visualizationOptions); setShowStructureValuesMenu(value => !value); }}
      onVisualizationDraftChange={key => setVisualizationDraft(current => ({ ...current, [key]: !current[key] }))}
      onApplyVisualization={() => { setVisualizationOptions(visualizationDraft); setShowStructureValuesMenu(false); }}
      chargesReady={calculationExecuted && analysisRows.length > 0}
      reinforcementReady={Boolean(rcDesignResult?.elements?.length)}
      showAllAnalysisValues={visualizationOptions.efforts || visualizationOptions.moments}
      meshedSurfaceIds={analyticalSurfaceMesh?.surfaces.filter(surface => surface.triangleCount > 0).map(surface => surface.sourceElementId.split(":")[0]) ?? surfaceAnalysis?.rows.filter(row => Boolean(row.analysis.mesh)).map(row => row.elementId) ?? []}
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
      reinforcementDesign={rcDesignResult}
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
                {(isSlabElementType(item.type) || item.type === "Escaliers") && (
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

  if (!authResolved || !projectsHydrated)
    return (
      <div className="grid min-h-[240px] place-items-center rounded-xl bg-white p-6 text-center text-[12px] text-[#647780]">
        Chargement sécurisé des projets de votre compte…
      </div>
    );

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
              <div key={project.id} className="flex items-center rounded-[14px] bg-white shadow-[0_2px_8px_rgba(0,0,0,.05)]">
                <button
                  type="button"
                  onClick={() => setSelectedProject(project)}
                  className="min-w-0 flex-1 rounded-l-[14px] p-4 text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#dff5f4] text-[#049b9b]">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-bold">{project.name}</div>
                        <div className="mt-1 text-[10px] text-[#858585]">
                          Non calculé · {project.levels.length} niveaux · {project.levels.reduce((sum, level) => sum + level.elements.length, 0)} éléments
                        </div>
                      </div>
                    </div>
                    <Badge className="shrink-0 bg-[#fff1e9] text-[#e87538] hover:bg-[#fff1e9]">{project.updatedAt}</Badge>
                  </div>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mr-2 h-9 w-9 shrink-0 text-[#a56a63] hover:bg-[#fff0ed] hover:text-[#c0392b]"
                  aria-label={`Supprimer le projet ${project.name}`}
                  title="Supprimer le projet"
                  onClick={() => setProjectPendingDeletion(project)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
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
          onClick={openProjectDialog}
          className="mt-6 w-full rounded-xl bg-[#6247a8] text-white hover:bg-[#513a91]"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nouveau projet
        </Button>
        {projectPendingDeletion && (
          <AlertDialog open onOpenChange={open => { if (!open && !projectDeletionInProgress) setProjectPendingDeletion(null); }}>
            <AlertDialogContent className="max-w-[400px] rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer ce projet ?</AlertDialogTitle>
                <AlertDialogDescription>
                  « {projectPendingDeletion.name} » et ses versions enregistrées seront retirés de l’historique sur cet appareil{cloudAccountId ? " et du compte synchronisé" : ""}. Cette action ne peut pas être annulée.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={projectDeletionInProgress}>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  disabled={projectDeletionInProgress}
                  className="bg-[#c0392b] text-white hover:bg-[#a93226]"
                  onClick={event => { event.preventDefault(); void deleteProjectFromHistory(projectPendingDeletion); }}
                >
                  {projectDeletionInProgress ? "Suppression…" : "Supprimer le projet"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        {dialogOpen && (
          <div className="fixed inset-0 z-[80] flex items-end justify-center overflow-y-auto bg-black/45 px-3 py-6 pb-24 sm:items-center sm:pb-6">
            <Card className="max-h-[min(88vh,860px)] w-full max-w-[520px] overflow-y-auto rounded-[18px] border-0 bg-white">
              <CardHeader className="sticky top-0 z-10 border-b bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-[18px]">{projectWizardStep === "identity" ? "Nouveau projet" : "Paramètres du projet"}</CardTitle>
                    <p className="mt-1 text-[11px] text-[#858585]">
                      {projectWizardStep === "identity" ? "Définissez le projet avant d’ouvrir son bâtiment." : "Renseignez le site, le référentiel et les matériaux prévus."}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" aria-label="Fermer" onClick={() => setDialogOpen(false)}><X className="h-4 w-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                {projectWizardStep === "identity" ? (
                  <>
                    <div>
                      <Label className="text-[11px]">Nom du projet</Label>
                      <Input
                        autoFocus
                        className="mt-2 h-11"
                        placeholder="Ex : Villa R+2"
                        value={projectName}
                        onChange={event => setProjectName(event.target.value)}
                        onKeyDown={event => event.key === "Enter" && createProject()}
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">Usage principal du projet</Label>
                      <select
                        className="mt-2 h-11 w-full rounded-md border border-[#e2e8eb] bg-white px-3 text-[12px]"
                        value={projectUsage}
                        onChange={event => setProjectUsage(event.target.value as ProjectUsage)}
                      >
                        {PROJECT_USAGE_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label} · Qk {option.load.toFixed(2)} kN/m²</option>)}
                      </select>
                      <p className="mt-2 text-[10px] leading-4 text-[#78888d]">Cette valeur sera utilisée par défaut pour les planchers et les charges d’exploitation. Elle reste modifiable dans la configuration du plancher.</p>
                    </div>
                    <div className="grid gap-2 pt-1 sm:grid-cols-2">
                      <Button type="button" variant="outline" className="h-11" onClick={() => setProjectWizardStep("settings")}>
                        <Settings2 className="mr-2 h-4 w-4" />Paramètres du projet
                      </Button>
                      <Button type="button" onClick={createProject} className="h-11 bg-[#6247a8] text-white">
                        <Building2 className="mr-2 h-4 w-4" />Créer le projet
                      </Button>
                    </div>
                    <Button type="button" variant="ghost" className="w-full text-[11px]" onClick={() => setDialogOpen(false)}>Annuler</Button>
                  </>
                ) : (
                  <>
                    <div>
                      <Label className="text-[11px]">Pays</Label>
                      <select
                        className="mt-1.5 h-10 w-full rounded-md border border-[#e2e8eb] bg-white px-3 text-[12px]"
                        value={projectSettingsDraft.country}
                        onChange={event => {
                          const nextCountry = event.target.value;
                          const nextCity = getCitiesForCountry(nextCountry)[0]?.city ?? "";
                          const nextNorm = getCountryProjectStandard(nextCountry, nextCity);
                          setProjectSettingsDraft(current => ({
                            ...current,
                            country: nextCountry,
                            city: nextCity,
                            norm: nextNorm,
                            regulatoryCatalogId: getProjectStandardId(nextNorm),
                          }));
                        }}
                      >
                        {PROJECT_COUNTRIES.map(item => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label className="text-[11px]">Ville / commune</Label>
                      <Input
                        className="mt-1.5 h-10"
                        list="gcbtp-project-city-options"
                        placeholder="Saisir ou choisir une ville"
                        value={projectSettingsDraft.city}
                        onChange={event => setProjectSettingsDraft(current => ({ ...current, city: event.target.value }))}
                      />
                      <datalist id="gcbtp-project-city-options">
                        {getCitiesForCountry(projectSettingsDraft.country).map(item => <option key={item.city} value={item.city} />)}
                      </datalist>
                    </div>
                    <div>
                      <Label className="text-[11px]">Emplacement / adresse du projet</Label>
                      <Input
                        className="mt-1.5 h-10"
                        placeholder="Quartier, parcelle ou adresse"
                        value={projectSettingsDraft.location}
                        onChange={event => setProjectSettingsDraft(current => ({ ...current, location: event.target.value }))}
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">Référentiel de calcul du projet</Label>
                      <select
                        className="mt-1.5 h-10 w-full rounded-md border border-[#e2e8eb] bg-white px-3 text-[12px]"
                        value={projectSettingsDraft.norm}
                        onChange={event => {
                          const nextNorm = event.target.value as ProjectStandard;
                          setProjectSettingsDraft(current => ({ ...current, norm: nextNorm, regulatoryCatalogId: getProjectStandardId(nextNorm) }));
                        }}
                      >
                        {PROJECT_STANDARD_CATALOG.map(item => <option key={item.id} value={item.norm}>{item.label}</option>)}
                      </select>
                      <div className="mt-2 rounded-lg border border-[#bfe4e2] bg-[#eaf8f7] p-3 text-[10px] leading-4 text-[#245e60]">
                        <b>Défaut logiciel GcBtp (pas une validation nationale) : {getCountryProjectStandard(projectSettingsDraft.country, projectSettingsDraft.city)}</b>
                        <div className="mt-1">Référentiel pays : {projectSetupProfile.rule.label} · statut : {projectSetupProfile.rule.status === "national" ? "national" : projectSetupProfile.rule.status === "adopted" ? "adopté / proposé" : projectSetupProfile.rule.status === "adapted" ? "adapté / à confirmer" : "à confirmer"}.</div>
                        <div className="mt-1">{projectSetupProfile.rule.note}</div>
                        <div className="mt-1">{getFrenchCalculationBasisLabel(projectSettingsDraft.norm)}. Les données de vent, séisme et sol doivent être confirmées selon les règles du pays sélectionné.</div>
                        <div className="mt-1 font-medium">Base de calcul : référentiels français BAEL (défaut) ou Eurocode 2 (sélectionnable), y compris pour les sites africains par choix du projet. Le pays indique le lieu du chantier, pas un code national africain; confirmer l’édition contractuelle et les données locales avant usage réglementaire.</div>
                      </div>
                    </div>
                    <div>
                      <Label className="text-[11px]">Nature de la structure</Label>
                      <select
                        className="mt-1.5 h-10 w-full rounded-md border border-[#e2e8eb] bg-white px-3 text-[12px]"
                        value={projectSettingsDraft.structure}
                        onChange={event => setProjectSettingsDraft(current => ({ ...current, structure: event.target.value }))}
                      >
                        <option>Béton armé</option><option>Acier</option><option>Maçonnerie porteuse</option><option>Mixte</option>
                      </select>
                    </div>
                    <div className="rounded-xl border border-[#e3e9ed] p-3">
                      <div className="mb-3 text-[12px] font-semibold text-[#20323d]">Catalogue matériaux du projet</div>
                      <div className="space-y-3">
                        <div>
                          <Label className="text-[10px]">Béton</Label>
                          <select
                            className="mt-1 w-full rounded-md border border-[#e2e8eb] bg-white px-3 py-2 text-[11px]"
                            value={projectSettingsDraft.materials.concreteClass}
                            onChange={event => setProjectSettingsDraft(current => ({ ...current, materials: { ...current.materials, concreteClass: event.target.value as ProjectMaterialSelection["concreteClass"] } }))}
                          >
                            {CONCRETE_CLASSES.map(item => <option key={item.concreteClass} value={item.concreteClass}>{item.concreteClass} · fck catalogue {item.fck} MPa</option>)}
                          </select>
                          <p className="mt-1 text-[9px] text-[#78888d]">Ecm {Math.round(projectSetupMaterials.concrete.Ecm / 1_000_000)} GPa · masse volumique {projectSetupMaterials.concrete.density} kN/m³ · données réutilisées par le modèle analytique.</p>
                        </div>
                        <div>
                          <Label className="text-[10px]">Acier d’armature</Label>
                          <select
                            className="mt-1 w-full rounded-md border border-[#e2e8eb] bg-white px-3 py-2 text-[11px]"
                            value={projectSettingsDraft.materials.reinforcementSteel}
                            onChange={event => setProjectSettingsDraft(current => ({ ...current, materials: { ...current.materials, reinforcementSteel: event.target.value as ProjectMaterialSelection["reinforcementSteel"] } }))}
                          >
                            {REINFORCEMENT_STEEL_CATALOG.map(item => <option key={item.id} value={item.id}>{item.label} · fyk nominal {item.fykMpa} MPa</option>)}
                          </select>
                          <p className="mt-1 text-[9px] text-[#78888d]">{projectSetupMaterials.rebar.note}</p>
                        </div>
                        <div>
                          <Label className="text-[10px]">Acier de construction</Label>
                          <select
                            className="mt-1 w-full rounded-md border border-[#e2e8eb] bg-white px-3 py-2 text-[11px]"
                            value={projectSettingsDraft.materials.structuralSteel}
                            onChange={event => setProjectSettingsDraft(current => ({ ...current, materials: { ...current.materials, structuralSteel: event.target.value as ProjectMaterialSelection["structuralSteel"] } }))}
                          >
                            {STRUCTURAL_STEEL_CATALOG.map(item => <option key={item.id} value={item.id}>{item.label} · fy nominal {item.fyMpa} MPa</option>)}
                          </select>
                          <p className="mt-1 text-[9px] text-[#78888d]">Valeur catalogue nominale ; les certificats fournisseur, nuances réellement livrées et règles de calcul restent à confirmer.</p>
                        </div>
                      </div>
                      <p className="mt-3 rounded bg-[#fff9ed] p-2 text-[9px] leading-4 text-[#78602c]">Les propriétés catalogue servent de base au modèle et sont conservées avec le projet. Pour la maçonnerie, granulats, ciment et autres produits locaux, saisir/valider les caractéristiques du fournisseur ou du laboratoire ; aucune donnée fabricant non vérifiée n’est préremplie.</p>
                    </div>
                    <div className="grid gap-2 pt-1 sm:grid-cols-2">
                      <Button type="button" variant="outline" className="h-11" onClick={() => setProjectWizardStep("identity")}><ChevronLeft className="mr-2 h-4 w-4" />Retour au projet</Button>
                      <Button type="button" className="h-11 bg-[#6247a8] text-white" onClick={() => setProjectWizardStep("identity")}><Save className="mr-2 h-4 w-4" />Valider les paramètres</Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );

  // Échelle visuelle partagée avec la 3D : 30 unités SVG par mètre (4 m = 120).
  const gridCell = GRID_UNITS_PER_METER * 4;
  const gridOrigin = { x: 54, y: 42 };
  const axisDistance = (values: string[], index: number) =>
    Math.max(Number(values[index] || gridDistance) || 0.01, 0.01);
  const cumulativeAxis = (values: string[], count: number) => {
    const raw = cumulativeGridPositions(
      values.map((_, index) => axisDistance(values, index)),
      count
    );
    return raw.map(value => value * GRID_UNITS_PER_METER);
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
                    (isSlabElementType(modelType) || modelType === "Escaliers")
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
                {(isSlabElementType(item.type) || item.type === "Escaliers") && (
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
                  const footingOffset = footingCenterOffset(item.foundationMode, item.foundationDirection, footingWidthMeters, footingDepthMeters) ?? { xM: 0, yM: 0 };
                  const footingCenter = metricGridPoint({
                    x: (item.xM ?? indexToMetric(item.x, currentXMeters)) + footingOffset.xM,
                    y: (item.yM ?? indexToMetric(item.y, currentYMeters)) + footingOffset.yM,
                  });
                  const xInterval = item.x < xAxes.length - 1 ? item.x : Math.max(item.x - 1, 0);
                  const yInterval = item.y < yAxes.length - 1 ? item.y : Math.max(item.y - 1, 0);
                  const xScale = gridSpanX(xInterval, Math.min(xInterval + 1, xAxes.length - 1)) / Math.max(axisDistance(xDistances, xInterval), 0.01);
                  const yScale = gridSpanY(yInterval, Math.min(yInterval + 1, yAxes.length - 1)) / Math.max(axisDistance(yDistances, yInterval), 0.01);
                  const footingWidthPixels = Math.max(10, footingWidthMeters * xScale);
                  const footingDepthPixels = Math.max(10, footingDepthMeters * yScale);
                  return <g>
                    <rect
                      x={footingCenter.x - footingWidthPixels / 2}
                      y={footingCenter.y - footingDepthPixels / 2}
                      width={footingWidthPixels}
                      height={footingDepthPixels}
                      fill="transparent"
                      stroke={elementColor(item)}
                      strokeWidth="3"
                      rx="1"
                    />
                    <line
                      x1={footingCenter.x - footingWidthPixels / 2}
                      y1={footingCenter.y - footingDepthPixels / 2}
                      x2={footingCenter.x + footingWidthPixels / 2}
                      y2={footingCenter.y + footingDepthPixels / 2}
                      stroke={elementColor(item)}
                      strokeWidth="1.5"
                      opacity=".8"
                    />
                    <line
                      x1={footingCenter.x + footingWidthPixels / 2}
                      y1={footingCenter.y - footingDepthPixels / 2}
                      x2={footingCenter.x - footingWidthPixels / 2}
                      y2={footingCenter.y + footingDepthPixels / 2}
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
                {showLabels && (isSlabElementType(item.type) || item.type === "Escaliers") && (
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
                  !isSlabElementType(item.type) && item.type !== "Escaliers" && (
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
          {floorPreview && isSlabElementType(modelType) && (
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
                {floorConfig.type === "Dalle pleine" ? `${modelType === "Balcon" ? "Balcon plein" : "Dalle pleine"} · deux sens` : `Dalle détectée · portée ${floorPreview.direction}`}
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

  const calculationRecommendations: Array<{ elementId: string; title: string; actions: string[]; category?: "foundation-design" }> = [];
  foundationEvaluation?.rows.forEach(row => {
    row.result?.checks.filter(check => check.status !== "satisfaisant").forEach(check => {
      const actions = check.id === "bearing"
        ? ["Augmenter la longueur et la largeur de la semelle depuis la sélection multiple.", "Vérifier qadm, la profondeur d’assise et le rapport géotechnique réel."]
        : check.id === "contact"
          ? ["Ajouter une longrine de redressement reliant cette semelle à une autre semelle fondée.", "Ou augmenter la section de la semelle et contrôler e ≤ B/6."]
          : check.id === "punching"
            ? ["Augmenter l’épaisseur de la semelle et sa section.", "Renseigner les propriétés béton/armatures et réaliser le détail complet de poinçonnement."]
            : check.id === "settlement"
              ? ["Augmenter la surface de la semelle pour réduire la pression transmise.", "Vérifier le module de sol et le tassement admissible avec l’étude géotechnique."]
              : ["Vérifier les paramètres géotechniques et les efforts horizontaux.", "Ajouter une liaison de redressement ou une solution de fondation adaptée si nécessaire."];
      calculationRecommendations.push({ elementId: row.footingId, title: `${check.label} · ${check.status}`, actions, category: "foundation-design" });
    });
    if (row.error) calculationRecommendations.push({ elementId: row.footingId, title: "Fondation non vérifiée", actions: ["Compléter les paramètres géotechniques et les dimensions de la semelle.", "Relancer le calcul après correction."], category: "foundation-design" });
  });
    rcDesignResult?.elements.forEach(item => {
      if (columnVerificationRequested && selectedAnalysisRow?.type === "Poteau" && item.type === "column" && item.elementId === selectedAnalysisRow.id) return;
      item.checks.filter(check => check.status !== "satisfaisant").forEach(check => {
        const demandValue = check.demand ?? Number.NaN;
        const resistanceValue = check.resistance ?? Number.NaN;
        const finiteDemand = Number.isFinite(demandValue);
        const finiteResistance = Number.isFinite(resistanceValue);
        const metric = check.id === "column-slenderness" && finiteDemand && finiteResistance
          ? `λ ${demandValue.toFixed(2)} / limite ${resistanceValue.toFixed(2)}`
          : check.id === "column-second-order" && check.status === "à vérifier" && finiteDemand
            ? `M₂ indicatif ${demandValue.toFixed(2)} kN·m`
            : check.id === "column-second-order" && finiteDemand && finiteResistance
              ? `amplification ${demandValue.toFixed(2)} / seuil ${resistanceValue.toFixed(2)}`
              : check.id === "column-second-order" && !finiteDemand
                ? "amplification indéfinie (M₀≈0)"
                : finiteDemand && finiteResistance ? `${demandValue.toFixed(2)} / ${resistanceValue.toFixed(2)} ${check.unit}` : "";
        const columnActions = check.id === "column-slenderness"
          ? ["Le test compare λ=L₀/i à la limite configurée (valeur initiale du formulaire : 15). Vérifiez que L₀ est bien la longueur de flambement effective et que la limite correspond au référentiel choisi.", "Ce dépassement du seuil géométrique ne prouve pas à lui seul une insuffisance de résistance axiale; ne modifiez la section qu’après confirmation de ces données."]
          : check.id === "column-second-order" && check.status === "à vérifier"
            ? ["Le moment de premier ordre est nul ou quasi nul : le ratio MEd/M₀ est indéfini, même si le moment M₂ calculé reste fini.", "Ce point n’est pas un échec de section. Vérifiez les Mx/My de la combinaison et faites contrôler l’interaction complète du second ordre."]
            : check.id === "column-second-order"
              ? ["Le moteur compare l’amplification nominale MEd/M₀ à une limite de dépistage interne de 5; ce résultat n’est pas, à lui seul, un verdict normatif de résistance.", "Vérifiez L₀, les moments de la combinaison gouvernante et la méthode complète de second ordre applicable."]
              : check.id === "column-bael-detailing"
                ? ["Contrôle bloqué car les cadres, zones critiques, confinement et recouvrements ne sont pas encore calculés par le moteur.", "Ce blocage logiciel ne se corrige pas en augmentant la section; le détail doit être vérifié séparément selon le référentiel du projet."]
                : undefined;
        const defaultActions = /poin|cisaillement/i.test(check.label)
          ? ["Augmenter la section ou l’épaisseur seulement si la vérification de résistance le justifie.", "Vérifier le ferraillage transversal et les paramètres de calcul."]
          : /flèche|déformation|flexion/i.test(check.label)
            ? ["Examiner la hauteur de section et la portée à partir de la valeur calculée.", "Vérifier les charges et le ferraillage longitudinal."]
            : ["Examiner la formule, la valeur et la limite affichées avant toute modification.", "Aucune augmentation de section n’est déduite automatiquement pour ce contrôle."];
        calculationRecommendations.push({
          elementId: item.elementId,
          title: `${item.type} · ${check.label} · ${check.status}${metric ? ` · ${metric}` : ""}`,
          actions: columnActions ?? defaultActions,
        });
      });
    });
  surfaceAnalysis?.rows.forEach(row => {
    const mechanicalMessages = Array.from(new Set([...row.analysis.errors, ...row.supportErrors]));
    if (!mechanicalMessages.length) return;
    const actions = mechanicalMessages.some(message => /appui|rive|poutre|voile|port[éeé]/i.test(message))
      ? ["Corriger l’appui indiqué dans le message : ajouter ou connecter la poutre/voile continue réellement porteuse.", "Ne pas modifier la surface uniquement pour masquer cette erreur ; relancer le contrôle de transfert après correction."]
      : mechanicalMessages.some(message => /maill|géométr|rectangle|ouverture|dimension/i.test(message))
        ? ["Corriger la géométrie, l’ouverture ou la taille de maille indiquée dans le message.", "Relancer le maillage puis vérifier la conservation Gk/Qk de cet élément."]
        : ["Corriger le message mécanique indiqué ci-dessous sur cet élément.", "Relancer l’analyse de surface et la descente des charges ; aucune augmentation de section n’est proposée sans contrôle de résistance en échec."];
    calculationRecommendations.push({ elementId: row.elementId, title: `${row.elementId} · descente mécanique bloquée`, actions: [...mechanicalMessages, ...actions] });
  });
  loadApplicationReport?.errors.forEach(message => {
    const elementId = message.match(/\b(?:PL|DAL|BAL|ESC|S|P|B)\d+\b/i)?.[0] ?? "Charges";
    const actions = /appui|transfert|porteuse|surface/i.test(message)
      ? ["Corriger l’appui ou le transfert Gk/Qk de l’élément explicitement cité.", "Relancer le maillage et l’application des charges après correction."]
      : /maill|géométr|dimension|invalide/i.test(message)
        ? ["Corriger la géométrie ou le maillage de l’élément explicitement cité.", "Relancer le maillage puis l’application des charges."]
        : ["Corriger exactement l’affectation de charge indiquée dans ce message.", "Relancer l’application des charges et vérifier le résidu Gk/Qk."];
    calculationRecommendations.push({ elementId, title: "Descente des charges bloquée", actions: [message, ...actions] });
  });
  // Le dimensionnement géotechnique des semelles sera traité dans son propre parcours.
  // On masque ses suggestions ici, tout en gardant les erreurs réelles de maillage/transfert/charges.
  const recommendationItems = calculationRecommendations.filter(item => item.category !== "foundation-design").filter((item, index, items) => items.findIndex(candidate => candidate.elementId === item.elementId && candidate.title === item.title) === index);

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
            <p className={`max-w-[160px] truncate text-[9px] ${/échec|conflit|indisponible|migration|non synchronisé/i.test(persistenceStatus) ? "text-[#b45309]" : "text-[#16805b]"}`} aria-live="polite">
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
            style={{ backgroundColor: modelType === "Aucun" ? "#aab3b7" : colorForModel(modelType, modelSection) }}
          />
          Modèle actif : <b className="text-[#27358f]">{modelType === "Aucun" ? "Aucun" : modelSection}</b>
          <span className="text-[#8b9498]">
            ({modelType === "Aucun" ? "aucun placement" : colorForModel(modelType, modelSection)})
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
              setFoundationPlacementMode("centered");
              setFoundationPlacementDirection({ x: "none", y: "none" });
              setElementSelectionMode(false);
              if (isSlabElementType(type))
                setFloorConfig(floorConfigForModel(type, nextSection));
              setPlacementStart(null);
              setHoverPoint(null);
              setStairLandingPoint(null);
              setStairConstructionPoints([]);
              setStairPointLevels([]);
              setStairPlacementStage(1);
            }}
          >
            <option value="Aucun">Aucun</option>
            {modelTypes.map(type => (
              <option key={type}>{type}</option>
            ))}
          </select>
          <select
            className="h-9 rounded-lg border border-[#e2e8eb] bg-white px-2 text-[10px]"
            value={modelSection}
            disabled={modelType === "Aucun"}
            onChange={event => {
              const nextSection = event.target.value;
              setModelSection(nextSection);
              setElementSelectionMode(false);
              if (isSlabElementType(modelType))
                setFloorConfig(floorConfigForModel(modelType, nextSection));
              setPlacementStart(null);
              setHoverPoint(null);
              setStairLandingPoint(null);
              setStairConstructionPoints([]);
              setStairPointLevels([]);
              setStairPlacementStage(1);
            }}
          >
            {modelType === "Aucun" ? <option value="">Aucun modèle</option> : optionsForType(modelType).map(section => (
              <option key={section}>{section}</option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-2 w-full border-[#087f7f] bg-[#f1fbfa] text-[#087f7f]"
          onClick={() => setPanel("Éléments du niveau")}
        >
          <Table2 className="mr-2 h-4 w-4" />
          Gérer les éléments du niveau actif ({activeLevel?.label ?? "—"})
        </Button>
        {modelType === "Semelle" && (
          <div className="mt-2 rounded-md border border-[#e2e8eb] bg-[#f8fafb] p-2">
            <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-[#68767d]">Implantation de la semelle</div>
            <div className="grid grid-cols-2 gap-1" role="group" aria-label="Mode de semelle">
              {([{ value: "centered", label: "Centrée" }, { value: "eccentric", label: "Excentrée" }] as const).map(option => (
                <button key={option.value} type="button" aria-pressed={foundationPlacementMode === option.value} onClick={() => { setFoundationPlacementMode(option.value); if (option.value === "centered") setFoundationPlacementDirection({ x: "none", y: "none" }); }} className={`h-8 rounded border text-[10px] font-semibold ${foundationPlacementMode === option.value ? "border-[#27358f] bg-[#27358f] text-white" : "border-[#d5dfe3] bg-white text-[#52656b]"}`}>{option.label}</button>
              ))}
            </div>
            {foundationPlacementMode === "eccentric" && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="block text-[9px] font-semibold text-[#52656b]">Décalage horizontal
                  <select aria-label="Décalage horizontal de la semelle" className="mt-1 h-8 w-full rounded border border-[#d5dfe3] bg-white px-2 text-[10px]" value={foundationPlacementDirection.x} onChange={event => setFoundationPlacementDirection(current => ({ ...current, x: event.target.value as FootingEccentricAxes["x"] }))}>
                    <option value="none">Aucun</option><option value="left">Gauche</option><option value="right">Droite</option>
                  </select>
                </label>
                <label className="block text-[9px] font-semibold text-[#52656b]">Décalage vertical
                  <select aria-label="Décalage vertical de la semelle" className="mt-1 h-8 w-full rounded border border-[#d5dfe3] bg-white px-2 text-[10px]" value={foundationPlacementDirection.y} onChange={event => setFoundationPlacementDirection(current => ({ ...current, y: event.target.value as FootingEccentricAxes["y"] }))}>
                    <option value="none">Aucun</option><option value="top">Haut</option><option value="bottom">Bas</option>
                  </select>
                </label>
              </div>
            )}
          </div>
        )}
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
                setFoundationPlacementMode("centered");
                setFoundationPlacementDirection({ x: "none", y: "none" });
                if (isSlabElementType(model.type)) setFloorConfig(floorConfigForModel(model.type, model.name));
              }}
            >
              <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: model.color }} />
              <span><b>{model.name}</b><span className="ml-1 text-[#89969c]">· {model.family} · {model.dimensions}</span></span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[9px] text-[#7a898e]">Les sections sont utilisées par le modèle analytique pour déduire les dimensions, aires et inerties. Les propriétés de matériau restent à confirmer selon le béton et la norme du projet.</p>
      </details>
      {isSlabElementType(modelType) && (
        <Button
          variant="outline"
          className="mt-2 w-full border-[#049b9b] text-[#087f7f]"
          onClick={() => setPanel("Configuration du plancher")}
        >
          {modelType === "Balcon" ? "Configurer le balcon" : "Configurer le plancher"} · {floorConfig.type} · {floorConfig.thickness}
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
                fixedType={modelType === "Balcon" ? "Dalle pleine" : undefined}
                panelLabel={modelType === "Balcon" ? "balcon" : "plancher"}
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
                  setFoundationPlacementMode("centered");
                  setFoundationPlacementDirection({ x: "none", y: "none" });
                  setElementSelectionMode(false);
                  if (isSlabElementType(model.type))
                    setFloorConfig(floorConfigForModel(model.type, model.name));
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
                        const nextType = event.target.value;
                        const nextSection = optionsForType(nextType)[0] ?? "";
                        setEditType(nextType);
                        setEditSection(nextSection);
                        if (isSlabElementType(nextType)) setFloorConfig(floorConfigForModel(nextType, nextSection));
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
                  {editType === "Semelle" && (
                    <div className="space-y-2 rounded-lg border border-[#e2e8eb] bg-[#f8fafb] p-2">
                      <Label>Implantation de la semelle</Label>
                      <div className="grid grid-cols-2 gap-1" role="group" aria-label="Mode de semelle existante">
                        {([{ value: "centered", label: "Centrée" }, { value: "eccentric", label: "Excentrée" }] as const).map(option => (
                          <button key={option.value} type="button" aria-pressed={(editingElement?.foundationMode ?? "centered") === option.value} onClick={() => setEditingElement(current => current ? { ...current, foundationMode: option.value, foundationDirection: option.value === "centered" ? undefined : current.foundationDirection ?? { x: "none", y: "none" } } : current)} className={`h-8 rounded border text-[10px] font-semibold ${(editingElement?.foundationMode ?? "centered") === option.value ? "border-[#27358f] bg-[#27358f] text-white" : "border-[#d5dfe3] bg-white text-[#52656b]"}`}>{option.label}</button>
                        ))}
                      </div>
                      {editingElement?.foundationMode === "eccentric" && <div className="grid grid-cols-2 gap-2">
                        <label className="block text-[9px] font-semibold text-[#52656b]">Décalage horizontal
                          <select aria-label="Décalage horizontal de la semelle existante" className="mt-1 h-8 w-full rounded border border-[#d5dfe3] bg-white px-2 text-[10px]" value={normalizeFootingEccentricAxes(editingElement.foundationDirection).x} onChange={event => setEditingElement(current => current ? { ...current, foundationDirection: { ...normalizeFootingEccentricAxes(current.foundationDirection), x: event.target.value as FootingEccentricAxes["x"] } } : current)}>
                            <option value="none">Aucun</option><option value="left">Gauche</option><option value="right">Droite</option>
                          </select>
                        </label>
                        <label className="block text-[9px] font-semibold text-[#52656b]">Décalage vertical
                          <select aria-label="Décalage vertical de la semelle existante" className="mt-1 h-8 w-full rounded border border-[#d5dfe3] bg-white px-2 text-[10px]" value={normalizeFootingEccentricAxes(editingElement.foundationDirection).y} onChange={event => setEditingElement(current => current ? { ...current, foundationDirection: { ...normalizeFootingEccentricAxes(current.foundationDirection), y: event.target.value as FootingEccentricAxes["y"] } } : current)}>
                            <option value="none">Aucun</option><option value="top">Haut</option><option value="bottom">Bas</option>
                          </select>
                        </label>
                      </div>}
                    </div>
                  )}
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
                  {isSlabElementType(editType) && (
                    <div className="space-y-1 rounded-lg border border-[#d7e2ec] bg-[#f6f9fc] p-2">
                      <Label>Trémies rectangulaires (m)</Label>
                      <textarea
                        aria-label="Trémies rectangulaires en mètres"
                        value={editSurfaceOpenings}
                        onChange={event => setEditSurfaceOpenings(event.target.value)}
                        placeholder="x1;y1;x2;y2 — une ouverture par ligne"
                        className="min-h-16 w-full rounded border bg-white p-2 text-[10px]"
                      />
                      <p className="text-[9px] text-[#68767d]">Coordonnées locales depuis le coin inférieur gauche de la surface, en mètres; laisser vide si aucune trémie. Exemple : 1;1;2;2.</p>
                    </div>
                  )}
                  {editType === "Escaliers" && (
                    <div className="space-y-2 rounded-lg border border-[#e7d2a8] bg-[#fffaf0] p-2">
                      <div className="text-[10px] font-bold text-[#8a5a21]">Escalier · dimensions et charges propres · m / kN/m²</div>
                      <div className="grid grid-cols-2 gap-2">
                        <label><span className="text-[9px] font-semibold">Profondeur des paliers</span><Input aria-label="Profondeur des paliers en mètres" inputMode="decimal" value={floorConfig.stairLandingDepthM ?? "1.00"} onChange={event => setFloorConfig(current => ({ ...current, stairLandingDepthM: event.target.value }))} /></label>
                        <label><span className="text-[9px] font-semibold">Course mesurée d’une volée</span><Input aria-label="Course de volée en mètres" inputMode="decimal" value={floorConfig.stairRun ?? "2.00"} onChange={event => setFloorConfig(current => ({ ...current, stairRun: event.target.value }))} /></label>
                        <label><span className="text-[9px] font-semibold">Dénivelé d’une volée</span><Input aria-label="Dénivelé de volée en mètres" inputMode="decimal" value={floorConfig.stairRise ?? "2.04"} onChange={event => setFloorConfig(current => ({ ...current, stairRise: event.target.value }))} /></label>
                        <label><span className="text-[9px] font-semibold">Qk · volée</span><Input aria-label="Charge d’exploitation de la volée" inputMode="decimal" value={floorConfig.characteristicImposedLoad ?? "3.00"} onChange={event => setFloorConfig(current => ({ ...current, characteristicImposedLoad: event.target.value }))} /></label>
                        <label><span className="text-[9px] font-semibold">Finition · volée</span><Input aria-label="Finition de la volée" inputMode="decimal" value={floorConfig.stairFinishLoad ?? "0.00"} onChange={event => setFloorConfig(current => ({ ...current, stairFinishLoad: event.target.value }))} /></label>
                        <label><span className="text-[9px] font-semibold">Finition · paliers</span><Input aria-label="Finition des paliers" inputMode="decimal" value={floorConfig.stairLandingFinishLoad ?? floorConfig.finishLoad ?? "1.00"} onChange={event => setFloorConfig(current => ({ ...current, stairLandingFinishLoad: event.target.value }))} /></label>
                        <label><span className="text-[9px] font-semibold">Qk · paliers</span><Input aria-label="Charge d’exploitation des paliers" inputMode="decimal" value={floorConfig.stairLandingImposedLoad ?? floorConfig.characteristicImposedLoad ?? "3.00"} onChange={event => setFloorConfig(current => ({ ...current, stairLandingImposedLoad: event.target.value }))} /></label>
                        <label><span className="text-[9px] font-semibold">Hauteur de marche</span><Input aria-label="Hauteur de marche en mètres" inputMode="decimal" value={floorConfig.stairRiser ?? "0.17"} onChange={event => setFloorConfig(current => ({ ...current, stairRiser: event.target.value }))} /></label>
                        <label><span className="text-[9px] font-semibold">Giron</span><Input aria-label="Giron de marche en mètres" inputMode="decimal" value={floorConfig.stairTread ?? "0.30"} onChange={event => setFloorConfig(current => ({ ...current, stairTread: event.target.value }))} /></label>
                      </div>
                      <p className="text-[9px] text-[#755d36]">Gk volée : poids propre de paillasse + marches + finition; Gk palier : poids propre de dalle + finition. Les valeurs initialisées depuis la géométrie doivent être confirmées sur le plan d’exécution.</p>
                    </div>
                  )}
                  {editType === "Balcon" && (
                    <div className="space-y-2 rounded-lg border border-[#bfe4e2] bg-[#f0faf9] p-2">
                      <div className="text-[10px] font-bold text-[#087f7f]">Charges caractéristiques du balcon · kN/m²</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label>G permanente</Label><Input inputMode="decimal" aria-label="G permanente balcon" value={floorConfig.characteristicPermanentLoad ?? "6.00"} onChange={event => setFloorConfig(current => ({ ...current, characteristicPermanentLoad: event.target.value }))} /></div>
                        <div><Label>Q exploitation</Label><Input inputMode="decimal" aria-label="Q exploitation balcon" value={floorConfig.characteristicImposedLoad ?? "3.50"} onChange={event => setFloorConfig(current => ({ ...current, characteristicImposedLoad: event.target.value }))} /></div>
                      </div>
                      <div><Label>Bord d’encastrement</Label><select aria-label="Bord d’encastrement balcon" className="h-9 w-full rounded border bg-white px-2 text-[10px]" value={floorConfig.balconySupportEdge ?? "auto"} onChange={event => setFloorConfig(current => ({ ...current, balconySupportEdge: event.target.value as NonNullable<FloorConfig["balconySupportEdge"]> }))}><option value="auto">Auto · détection sur poutre/voile</option><option value="left">Gauche</option><option value="right">Droite</option><option value="bottom">Bas</option><option value="top">Haut</option></select></div>
                      <p className="text-[9px] text-[#476276]">Q par défaut repris du profil Balcon du catalogue des charges. À confirmer selon la norme du projet; garde-corps, rives et charges ponctuelles à ajouter séparément.</p>
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
                  <div className="space-y-2 rounded-lg border border-[#d7e4e7] bg-[#f7fbfb] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <b className="text-[11px] text-[#166b6b]">Sélection multiple — {activeLevel?.label ?? "niveau actif"}</b>
                        <p className="text-[9px] text-[#688084]">Cochez les éléments à modifier ou supprimer sans les recréer.</p>
                      </div>
                      <span className="rounded-full bg-white px-2 py-1 text-[9px] font-semibold text-[#166b6b]">{bulkSelectedElementIds.length} sélectionné{bulkSelectedElementIds.length > 1 ? "s" : ""}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[9px] font-semibold text-[#52656b]">Type à gérer
                      <select className="mt-1 h-8 w-full rounded border bg-white px-2 text-[10px]" value={bulkElementType} onChange={event => { setBulkElementType(event.target.value); setBulkSection(""); setBulkSectionPickerOpen(false); }}>
                          <option value="Tous">Tous les types</option>
                          {modelTypes.map(type => <option key={type} value={type}>{type}</option>)}
                        </select>
                      </label>
                      <div className="flex items-end gap-1">
                        <Button type="button" variant="outline" className="h-8 flex-1 px-2 text-[9px]" onClick={selectAllBulkElements}>Tout cocher</Button>
                        <Button type="button" variant="outline" className="h-8 flex-1 px-2 text-[9px]" onClick={clearBulkElements}>Tout décocher</Button>
                      </div>
                    </div>
                    {bulkElementType !== "Tous" && <div className="space-y-2">
                      <Button type="button" className="h-8 w-full bg-[#27358f] px-3 text-[9px] text-white" onClick={() => setBulkSectionPickerOpen(open => !open)}>
                        {bulkSectionPickerOpen ? "Fermer la liste des sections" : "Modifier la section"}
                      </Button>
                      {bulkSectionPickerOpen && <label className="block text-[9px] font-semibold text-[#52656b]">Nouvelle section — {bulkElementType}
                        <select autoFocus className="mt-1 h-9 w-full rounded border border-[#27358f] bg-white px-2 text-[10px]" value={bulkSection} onChange={event => applyBulkSection(event.target.value)}>
                          <option value="">Choisir une section disponible…</option>
                          {optionsForType(bulkElementType).map(section => <option key={section} value={section}>{section}</option>)}
                        </select>
                        <span className="mt-1 block font-normal text-[#688084]">Le changement est appliqué immédiatement en vue 2D et en vue 3D.</span>
                      </label>}
                    </div>}
                    <div className="max-h-56 space-y-1 overflow-y-auto rounded border bg-white p-2">
                      {bulkVisibleElements.length ? bulkVisibleElements.map(item => <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[10px] hover:bg-[#eef7f7]">
                        <input type="checkbox" checked={bulkSelectedElementIds.includes(item.id)} onChange={() => toggleBulkElement(item.id)} />
                        <span className="font-semibold">{item.id}</span><span className="text-[#68767d]">{item.type} · {item.section}</span>
                      </label>) : <p className="text-[10px] text-[#7b878b]">Aucun élément de ce type sur ce niveau.</p>}
                    </div>
                    <Button type="button" variant="outline" className="h-8 w-full border-[#d65d4d] px-3 text-[9px] text-[#b8493e]" onClick={deleteBulkElements}><Trash2 className="mr-1 h-3 w-3" />Supprimer les éléments cochés</Button>
                  </div>
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
                          {isSlabElementType(item.type) && item.floorConfig && (
                            <>
                              <br />
                              <span className="text-[#087f7f]">
                                {item.floorConfig.type} ·{" "}
                                {item.floorConfig.thickness} · portée{" "}
                                {item.floorConfig.span} m
                              </span>
                            </>
                          )}
                          {item.type === "Escaliers" && item.floorConfig && <><br /><span className="text-[#087f7f]">Palier {item.floorConfig.stairLandingDepthM ?? "à renseigner"} m · course volée {item.floorConfig.stairRun ?? "—"} m · Qk palier {item.floorConfig.stairLandingImposedLoad ?? item.floorConfig.characteristicImposedLoad ?? "—"} kN/m²</span></>}
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
                    {["Semelle", "Semelle excentrée", "Longrine de redressement", "Voile", "Poteau", "Poutre", "Dalle", "Balcon", "Escaliers"].map(type => {
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
                        const nextNorm = getCountryProjectStandard(nextCountry, nextCity);
                        setCountry(nextCountry);
                        setCity(nextCity);
                        setNorm(nextNorm);
                        setLoadProgram(current => normalizeLoadProgram(current, nextNorm, projectUsage));
                        updateSelected({
                          country: nextCountry,
                          city: nextCity,
                          norm: nextNorm,
                          regulatoryCatalogId: getProjectStandardId(nextNorm),
                        });
                        toast.success(
                          `Localisation ${nextCountry} mise à jour — référentiel français appliqué`
                        );
                      }}
                    >
                      {PROJECT_COUNTRIES.map(item => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Ville / commune</Label>
                    <Input
                      className="mt-1 h-10 w-full rounded border bg-white px-2 text-[11px]"
                      list="gcbtp-existing-project-city-options"
                      value={city}
                      onChange={event => {
                        const nextCity = event.target.value;
                        setCity(nextCity);
                        updateSelected({ city: nextCity });
                      }}
                      placeholder="Saisir ou choisir une ville"
                    />
                    <datalist id="gcbtp-existing-project-city-options">
                      {getCitiesForCountry(country).map(item => <option key={item.city} value={item.city} />)}
                    </datalist>
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
                    <Label>Référentiel de calcul</Label>
                    <select
                      className="h-10 w-full rounded border bg-white px-2 text-[11px]"
                      value={norm}
                      onChange={event => {
                        const nextNorm = event.target.value as ProjectStandard;
                        setNorm(nextNorm);
                        setLoadProgram(current => normalizeLoadProgram(current, nextNorm, projectUsage));
                        updateSelected({ norm: nextNorm, regulatoryCatalogId: getProjectStandardId(nextNorm) });
                      }}
                    >
                      {PROJECT_STANDARD_CATALOG.map(item => (
                        <option key={item.id} value={item.norm}>{item.label}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-[9px] leading-4 text-[#77888d]">{getFrenchCalculationBasisLabel(norm)}. Les données de vent, séisme et sol restent propres à la ville et à l’emplacement du projet; les résultats ne sont pas déclarés conformes si une donnée ou un contrôle manque.</p>
                  </div>
                  <div>
                    <Label>Classe de béton du catalogue</Label>
                    <select
                      className="h-10 w-full rounded border bg-white px-2 text-[11px]"
                      value={selectedProjectMaterials.concrete.concreteClass}
                      onChange={event => updateSelected({ materials: { ...normalizeProjectMaterials(selected.materials), concreteClass: event.target.value as ProjectMaterialSelection["concreteClass"] } })}
                    >
                      {CONCRETE_CLASSES.map(item => <option key={item.concreteClass} value={item.concreteClass}>{item.concreteClass} · fck {item.fck} MPa</option>)}
                    </select>
                    <p className="mt-1 text-[9px] text-[#77888d]">Cette classe alimente aussi les propriétés de béton du modèle analytique.</p>
                  </div>
                  <div>
                    <Label>Acier d’armature</Label>
                    <select
                      className="h-10 w-full rounded border bg-white px-2 text-[11px]"
                      value={normalizeProjectMaterials(selected.materials).reinforcementSteel}
                      onChange={event => updateSelected({ materials: { ...normalizeProjectMaterials(selected.materials), reinforcementSteel: event.target.value as ProjectMaterialSelection["reinforcementSteel"] } })}
                    >
                      {REINFORCEMENT_STEEL_CATALOG.map(item => <option key={item.id} value={item.id}>{item.label} · fyk {item.fykMpa} MPa nominal</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Acier de construction</Label>
                    <select
                      className="h-10 w-full rounded border bg-white px-2 text-[11px]"
                      value={normalizeProjectMaterials(selected.materials).structuralSteel}
                      onChange={event => updateSelected({ materials: { ...normalizeProjectMaterials(selected.materials), structuralSteel: event.target.value as ProjectMaterialSelection["structuralSteel"] } })}
                    >
                      {STRUCTURAL_STEEL_CATALOG.map(item => <option key={item.id} value={item.id}>{item.label} · fy {item.fyMpa} MPa nominal</option>)}
                    </select>
                  </div>
                  <section className="space-y-2 rounded-lg border border-[#e4d6b5] bg-[#fffaf0] p-3">
                    <div>
                      <b className="text-[11px] text-[#6d5426]">Catalogue géotechnique du projet</b>
                      <p className="mt-1 text-[9px] leading-4 text-[#786a51]">Les valeurs du catalogue sont des hypothèses indicatives de pré-dimensionnement. Elles sont copiées dans le projet et ne modifient jamais le catalogue original. Remplacez-les par les valeurs de l’étude géotechnique dès qu’elles sont disponibles.</p>
                      <p className="mt-1 text-[9px] leading-4 text-[#786a51]">Références de recherche : <a className="underline" href="https://www.sgns.gouv.sn/centre-de-documentation.html" target="_blank" rel="noreferrer">Centre de documentation du SGNS</a> et <a className="underline" href="https://www.geosenegal.gouv.sn/" target="_blank" rel="noreferrer">portail officiel Géo Sénégal</a>. Ces portails orientent vers les données et documents; ils ne remplacent pas le rapport géotechnique du projet.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 rounded bg-white p-2">
                      <label className="text-[9px]">Pays
                        <select className="mt-1 h-8 w-full rounded border bg-white px-2 text-[10px]" value={selected.country} onChange={event => { const next = getGeotechnicalCatalogProfiles(event.target.value)[0]; if (next) { updateSelected({ country: next.country, city: next.city, soil: copyCatalogToProject(next) }); setCountry(next.country); setCity(next.city); } }}>
                          {GEOTECHNICAL_CATALOG_COUNTRIES.map(item => <option key={item} value={item}>{item}</option>)}
                        </select>
                      </label>
                      <label className="text-[9px]">Région / ville
                        <select className="mt-1 h-8 w-full rounded border bg-white px-2 text-[10px]" value={projectGeotechnicalCatalogProfile.id} onChange={event => { const next = getGeotechnicalCatalogProfile(event.target.value); updateSelected({ country: next.country, city: next.city, soil: copyCatalogToProject(next) }); setCountry(next.country); setCity(next.city); }}>
                          {projectGeotechnicalCatalogProfiles.map(item => <option key={item.id} value={item.id}>{item.region} · {item.city}</option>)}
                        </select>
                      </label>
                      <label className="col-span-2 text-[9px]">Profil de sol
                        <select className="mt-1 h-8 w-full rounded border bg-white px-2 text-[10px]" value={projectGeotechnicalCatalogProfile.id} onChange={event => applyGeotechnicalCatalog(event.target.value)}>
                          {projectGeotechnicalCatalogProfiles.map(item => <option key={item.id} value={item.id}>{item.profileName} · {item.soilType}</option>)}
                        </select>
                      </label>
                      <div className="col-span-2 text-[9px] text-[#786a51]">Zone : <b>{projectGeotechnicalCatalogProfile.geologicalZone}</b> · Source : <b>{projectGeotechnicalCatalogProfile.source}</b> · Confiance : <b>{projectGeotechnicalCatalogProfile.confidence}</b></div>
                      <div className="col-span-2 flex flex-wrap gap-2">
                        <Button type="button" className="h-8 bg-[#087f7f] px-3 text-[10px] text-white" onClick={() => applyGeotechnicalCatalog(projectGeotechnicalCatalogProfile.id)}>Charger le catalogue</Button>
                        <Button type="button" variant="outline" className="h-8 px-3 text-[10px]" onClick={restoreGeotechnicalCatalog}>Restaurer le catalogue</Button>
                        <Button type="button" variant="outline" className="h-8 px-3 text-[10px]" onClick={saveProject}><Save className="mr-1 h-3 w-3" />Enregistrer le projet</Button>
                      </div>
                    </div>
                    <div className="rounded bg-[#fff4d8] p-2 text-[9px] text-[#786a51]">Statut : <b>{projectGeotechnical.sourceStatus === "catalog" ? "valeurs du catalogue" : projectGeotechnical.sourceStatus === "study" ? "étude géotechnique" : "valeurs modifiées par l’utilisateur"}</b>. Le moteur utilise toujours la copie enregistrée dans ce projet.</div>
                    <div>
                      <b className="text-[11px] text-[#6d5426]">Valeurs géotechniques du projet</b>
                      <p className="mt-1 text-[9px] leading-4 text-[#786a51]">Vous pouvez modifier chaque valeur puis cliquer sur « Enregistrer le projet ». Les valeurs modifiées restent propres à ce projet.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[9px]">Description / couche d’assise
                        <Input className="mt-1 h-8 bg-white text-[10px]" value={projectGeotechnical.soilDescription} onChange={event => updateGeotechnicalProfile({ soilDescription: event.target.value })} placeholder="Selon stratigraphie" />
                      </label>
                      <label className="text-[9px]">Classe de sol sismique · EC8
                        <Input className="mt-1 h-8 bg-white text-[10px]" value={projectGeotechnical.seismicSoilClass} onChange={event => updateGeotechnicalProfile({ seismicSoilClass: event.target.value })} placeholder="Selon rapport (A, B, C, D, E, S1, S2)" />
                      </label>
                      <label className="text-[9px]">qadm déclaré · kPa
                        <Input className="mt-1 h-8 bg-white text-[10px]" type="number" min="0" step="any" value={projectGeotechnical.bearingCapacityAdmissibleKPa ?? ""} onChange={event => updateGeotechnicalProfile({ bearingCapacityAdmissibleKPa: optionalGeotechnicalNumber(event.target.value) })} placeholder="Valeur du rapport" />
                      </label>
                      <label className="text-[9px]">qult · kPa
                        <Input className="mt-1 h-8 bg-white text-[10px]" type="number" min="0" step="any" value={projectGeotechnical.qUltimateKPa ?? ""} onChange={event => updateGeotechnicalProfile({ qUltimateKPa: optionalGeotechnicalNumber(event.target.value) })} placeholder="Catalogue / étude" />
                      </label>
                      <label className="text-[9px]">qnet · kPa
                        <Input className="mt-1 h-8 bg-white text-[10px]" type="number" min="0" step="any" value={projectGeotechnical.qNetKPa ?? ""} onChange={event => updateGeotechnicalProfile({ qNetKPa: optionalGeotechnicalNumber(event.target.value) })} placeholder="Catalogue / étude" />
                      </label>
                      <label className="text-[9px]">Angle φ · degrés
                        <Input className="mt-1 h-8 bg-white text-[10px]" type="number" min="0" max="59.99" step="any" value={projectGeotechnical.frictionAngleDeg ?? ""} onChange={event => updateGeotechnicalProfile({ frictionAngleDeg: optionalGeotechnicalNumber(event.target.value) })} placeholder="Selon étude" />
                      </label>
                      <label className="text-[9px]">Cohésion c′ · kPa
                        <Input className="mt-1 h-8 bg-white text-[10px]" type="number" min="0" step="any" value={projectGeotechnical.cohesionKPa ?? ""} onChange={event => updateGeotechnicalProfile({ cohesionKPa: optionalGeotechnicalNumber(event.target.value) })} placeholder="Selon étude" />
                      </label>
                      <label className="text-[9px]">Poids volumique γ · kN/m³
                        <Input className="mt-1 h-8 bg-white text-[10px]" type="number" min="0" step="any" value={projectGeotechnical.unitWeightKnM3 ?? ""} onChange={event => updateGeotechnicalProfile({ unitWeightKnM3: optionalGeotechnicalNumber(event.target.value) })} placeholder="Selon étude" />
                      </label>
                      <label className="text-[9px]">Poids saturé γsat · kN/m³
                        <Input className="mt-1 h-8 bg-white text-[10px]" type="number" min="0" step="any" value={projectGeotechnical.gammaSatKnM3 ?? ""} onChange={event => updateGeotechnicalProfile({ gammaSatKnM3: optionalGeotechnicalNumber(event.target.value) })} placeholder="Catalogue / étude" />
                      </label>
                      <label className="text-[9px]">Module du sol E · kPa
                        <Input className="mt-1 h-8 bg-white text-[10px]" type="number" min="0" step="any" value={projectGeotechnical.youngModulusKPa ?? ""} onChange={event => updateGeotechnicalProfile({ youngModulusKPa: optionalGeotechnicalNumber(event.target.value) })} placeholder="Selon étude" />
                      </label>
                      <label className="text-[9px]">Module œdométrique Eoed · kPa
                        <Input className="mt-1 h-8 bg-white text-[10px]" type="number" min="0" step="any" value={projectGeotechnical.oedometricModulusKPa ?? ""} onChange={event => updateGeotechnicalProfile({ oedometricModulusKPa: optionalGeotechnicalNumber(event.target.value) })} placeholder="Catalogue / étude" />
                      </label>
                      <label className="text-[9px]">Coefficient de Poisson ν
                        <Input className="mt-1 h-8 bg-white text-[10px]" type="number" min="0" max="0.49" step="any" value={projectGeotechnical.poissonRatio ?? ""} onChange={event => updateGeotechnicalProfile({ poissonRatio: optionalGeotechnicalNumber(event.target.value) })} placeholder="Selon étude" />
                      </label>
                      <label className="text-[9px]">Module de réaction k · kN/m³
                        <Input className="mt-1 h-8 bg-white text-[10px]" type="number" min="0" step="any" value={projectGeotechnical.subgradeModulusKnM3 ?? ""} onChange={event => updateGeotechnicalProfile({ subgradeModulusKnM3: optionalGeotechnicalNumber(event.target.value) })} placeholder="Selon étude" />
                      </label>
                      <label className="text-[9px]">Profondeur de base de semelle · m
                        <Input className="mt-1 h-8 bg-white text-[10px]" type="number" min="0" step="any" value={projectGeotechnical.foundationDepthM ?? ""} onChange={event => updateGeotechnicalProfile({ foundationDepthM: optionalGeotechnicalNumber(event.target.value) })} placeholder="Selon étude" />
                      </label>
                      <label className="text-[9px]">Profondeur de nappe · m
                        <Input className="mt-1 h-8 bg-white text-[10px]" type="number" min="0" step="any" value={projectGeotechnical.groundwaterDepthM ?? ""} onChange={event => updateGeotechnicalProfile({ groundwaterDepthM: optionalGeotechnicalNumber(event.target.value) })} placeholder="Selon étude" />
                      </label>
                      <label className="text-[9px]">Tassement admissible · mm
                        <Input className="mt-1 h-8 bg-white text-[10px]" type="number" min="0" step="any" value={projectGeotechnical.allowableSettlementMm ?? ""} onChange={event => updateGeotechnicalProfile({ allowableSettlementMm: optionalGeotechnicalNumber(event.target.value) })} placeholder="Selon étude" />
                      </label>
                      <label className="text-[9px]">Référence / source de l’étude
                        <Input className="mt-1 h-8 bg-white text-[10px]" value={projectGeotechnical.source} onChange={event => updateGeotechnicalProfile({ source: event.target.value })} placeholder="N° du rapport, bureau" />
                      </label>
                      <label className="text-[9px]">Date du rapport
                        <Input className="mt-1 h-8 bg-white text-[10px]" type="date" value={projectGeotechnical.reportDate} onChange={event => updateGeotechnicalProfile({ reportDate: event.target.value })} />
                      </label>
                      <label className="col-span-2 text-[9px]">Page / référence précise
                        <Input className="mt-1 h-8 bg-white text-[10px]" value={projectGeotechnical.reportPage} onChange={event => updateGeotechnicalProfile({ reportPage: event.target.value })} placeholder="Page, tableau ou sondage" />
                      </label>
                    </div>
                    <div className="rounded bg-white p-2 text-[9px] text-[#786a51]">État géotechnique : <b>{projectSoilStatus}</b>. Les champs laissés vides demeurent non vérifiés; la portance saisie est comparée directement comme screening, sans coefficient caché.</div>
                    <div className="rounded bg-[#f8f4ea] p-2 text-[9px] leading-4 text-[#786a51]"><b>Semelle excentrée et longrine de redressement :</b> l’excentricité est contrôlée par <i>e = M/N</i>, avec contact intégral si e ≤ B/6 et signalement du décollement partiel au-delà. Une longrine de redressement relie deux semelles distinctes pour reprendre le moment de redressement et limiter la rotation de la semelle excentrée; elle doit être dimensionnée comme élément en béton armé et ses deux appuis doivent exister dans le modèle.</div>
                  </section>
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
                    Défaut logiciel proposé (à confirmer avec les règles nationales) : {getCountryProjectStandard(country, city)}
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
                    <b>Paramètres géotechniques du projet :</b> {projectSoilName}{" "}
                    · qadm {Number.isFinite(projectBearingKPa) ? `${projectBearingKPa} kPa` : "à renseigner"} · {soilProposal.groundwater}.
                    <br />
                    <span className="opacity-80">
                      Statut {projectSoilStatus} — {projectSoilSource}. La localisation seule ne permet pas de déduire la portance.
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
                  {false ? (
                    <div className="space-y-2 rounded-lg border border-[#bfe4e2] bg-white p-3 text-[10px] text-[#245e60]">
                      <div className="flex items-center justify-between gap-2 border-b border-[#dce9e9] pb-2"><b className="text-[12px] text-[#087f7f]">Éléments et charges calculés</b><span className="text-[9px] text-[#68767d]">Calcul terminé</span></div>
                      <div className="grid grid-cols-[1.35fr_.7fr_.7fr_.8fr_.8fr] gap-1 rounded bg-[#eef8f7] px-2 py-1.5 text-[9px] font-bold"><span>Élément</span><span>G (kN)</span><span>Q (kN)</span><span>Nu (kN)</span><span>Nser (kN)</span></div>
                      <div className="rounded bg-[#f8fbfb] px-2 py-1 text-[9px] text-[#68767d]"><b>G</b> = charge permanente · <b>Q</b> = charge d’exploitation · <b>Nu</b> = effort normal ELU · <b>Nser</b> = effort normal ELS</div>
                      {analysisGroups.length === 0 ? <div className="rounded border border-dashed border-[#cbd9dc] p-3 text-center text-[10px] text-[#74858c]">Aucun élément calculé à afficher.</div> : analysisGroups.map(group => (
                        <div key={group.key} className="overflow-hidden rounded-lg border border-[#dfe8e8]"><div className="bg-[#f2f7f7] px-2 py-1.5 text-[9px] font-bold text-[#245e60]">{group.label}</div>{group.rows.map(row => (
                          <button type="button" key={`${row.levelId}:${row.id}`} onClick={() => setSelectedAnalysisRow(row)} className="grid w-full grid-cols-[1.35fr_.7fr_.7fr_.8fr_.8fr] gap-1 border-t border-[#edf1f1] px-2 py-2 text-left text-[9px] text-[#4c5e61] hover:bg-[#f8fbfb]"><span className="font-semibold">{row.label}<small className="ml-1 block font-normal text-[#8a9799]">{selected?.levels.find(level => level.id === row.levelId)?.label ?? row.levelId}{row.section ? ` · ${row.section}` : ""}</small></span><span>{row.gk.toFixed(1)}</span><span>{row.qk.toFixed(1)}</span><span className="font-bold text-[#087f7f]">{row.nu.toFixed(1)}</span><span>{row.nser.toFixed(1)}</span></button>
                        ))}</div>
                      ))}
                    </div>
                  ) : (
                    <>
                  {!calculationExecuted && analyticalPrecheck && analyticalModel && (
                    <div className={`space-y-2 rounded-lg border p-3 text-[10px] ${analyticalPrecheck.ok ? "border-[#bfe4e2] bg-[#eaf8f7] text-[#245e60]" : "border-[#efc4b9] bg-[#fff1ed] text-[#914d3d]"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <b>{analyticalPrecheck.ok ? "Pré-contrôle géométrique réussi" : "Pré-contrôle géométrique échoué — calcul bloqué"}</b>
                        <span>Schéma v{analyticalModel.schemaVersion}</span>
                      </div>
                      <div>{analyticalPrecheck.checkedNodeCount} nœud(s) · {analyticalPrecheck.checkedFrameCount} barre(s) · {analyticalPrecheck.checkedSurfaceCount} surface(s) · tolérance {analyticalModel.nodeMergeToleranceM.toFixed(3)} m</div>
                      <AnalyticalPlanPreview model={analyticalModel} />
                      <Button type="button" variant="outline" className="h-8 bg-white text-[10px]" onClick={downloadAnalyticalJson}>Exporter le modèle analytique JSON</Button>
                      {analyticalPrecheck.errors.map((item,index) => <details key={`${item.code}-${index}`} className="cursor-pointer rounded bg-white/80 p-2" onClick={() => focusCalculationDiagnostic(item.message)}><summary className="font-semibold">Erreur · {item.message}</summary><p className="mt-1 pl-4">Ce contrôle bloque le calcul. Cliquez pour ouvrir la correction de l’élément ou de sa connexion indiquée.</p></details>)}
                      {analyticalPrecheck.warnings.map((item,index) => <details key={`${item.code}-${index}`} className="cursor-pointer rounded bg-white/70 p-2" onClick={() => focusCalculationDiagnostic(item.message)}><summary className="font-semibold">Avertissement · {item.message}</summary><p className="mt-1 pl-4">Cliquez pour ouvrir la correction de l’élément ou de la donnée concernée, puis relancez le maillage et les charges.</p></details>)}
                    </div>
                  )}
                  {!calculationExecuted && structuralValidation && (
                    <div className={`space-y-2 rounded-lg border p-3 text-[10px] ${structuralValidation.status === "conforme" ? "border-[#bfe4e2] bg-[#eaf8f7] text-[#245e60]" : structuralValidation.status === "a_verifier" ? "border-[#efd49d] bg-[#fffaf0] text-[#765f36]" : "border-[#efc4b9] bg-[#fff1ed] text-[#914d3d]"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <b>Vérification du modèle · {structuralValidation.status === "conforme" ? "🟢 CONFORME" : structuralValidation.status === "a_verifier" ? "🟠 À VÉRIFIER" : "🔴 NON CONFORME"}</b>
                        <span>{structuralValidation.checkedLevels} niveau(x) · {structuralValidation.checkedElements} élément(s)</span>
                      </div>
                      <div>qadm du rapport : <b>{projectBearingKPa === null ? "non renseigné" : `${projectBearingKPa} kPa`}</b> · aucun qadm par défaut; le contrôle du sol reste non vérifié tant que la donnée réelle manque.</div>
                      {structuralValidation.issues.map((issue, index) => <details key={`${issue.code}-${index}`} className="cursor-pointer rounded bg-white/80 p-2" onClick={() => focusCalculationDiagnostic(issue.message)}><summary className="font-semibold">{issue.severity === "error" ? "Erreur" : "Avertissement"} · {issue.message}</summary><p className="mt-1 pl-4">Cliquez pour ouvrir l’élément ou la donnée à corriger avant de poursuivre.</p></details>)}
                      {!structuralValidation.issues.length && <div className="rounded bg-white/80 p-2">Aucune discontinuité verticale, semelle orpheline ou duplication détectée dans le contrôle automatique.</div>}
                    </div>
                  )}
                  {!calculationExecuted && <p className="text-[11px] text-[#68767d]">
                    Pré-étude : le calcul tributaire n’est autorisé qu’après le pré-contrôle de connectivité. Il ne remplace pas une analyse structurale par rigidité.
                  </p>}
                  {!calculationExecuted && <LoadProgramEditor
                    program={loadProgram}
                    onChange={setLoadProgram}
                    patternValues={loadProgramPatternValues}
                    evaluation={loadProgramEvaluation}
                    diagnostics={loadProgramDiagnostics}
                    projectNorm={selected?.norm ?? norm}
                  />}
                  {showCalculationPreflight && calculationExecuted && analyticalModel && analyticalPrecheck?.ok && buildingLoadModel && planeAnalysis && (
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
                  {showCalculationPreflight && !calculationExecuted && analyticalModel && analyticalPrecheck?.ok && (
                    <div className="space-y-2 rounded-lg border border-[#bddbd6] bg-[#eef9f6] p-3 text-[10px] text-[#285a52]">
                      <b>Surfaces — maillage triangulaire et plaque</b>
                      <div className="grid grid-cols-[1fr_auto] gap-2">
                        <label className="flex items-center gap-2">Taille cible de maille (m)
                          <Input aria-label="Taille de maille des surfaces en mètres" inputMode="decimal" value={surfaceMeshSizeM} onChange={event => { setSurfaceMeshSizeM(event.target.value); setMeshPrerequisiteReady(false); setLoadCasesPrerequisiteReady(false); }} className="h-8 w-24 bg-white text-[10px]" />
                        </label>
                        <Button type="button" className="h-8 bg-[#087f7f] px-3 text-[9px] text-white disabled:opacity-50" disabled={meshPrerequisiteReady} onClick={runAllSurfaceMeshing}>{meshPrerequisiteReady ? "Maillage validé" : "Mailler toutes les surfaces"}</Button>
                      </div>
                      <div className="rounded bg-white p-2 text-[9px] text-[#647087]">Le maillage triangulaire est commun aux surfaces. Les dalles pleines sont résolues sur quatre appuis simples, les corps creux par une plaque orthotrope portée dans le sens des nervures, et les balcons par un encastrement idéal sur la rive choisie/détectée avec trois rives libres. Les trémies, diaphragmes et couplage avec les poutres réelles ne sont pas encore modélisés par le solveur de plaque.</div>
                      {surfaceAnalysis && (
                        <div className="space-y-2">
                          <Button type="button" variant="outline" className="h-8 bg-white text-[9px]" onClick={() => setShowMeshDetails(value => !value)}>{showMeshDetails ? "Masquer les détails" : "Voir les détails du maillage"}</Button>
                          {showMeshDetails && <>
                            {surfaceAnalysis.errors.length === 0 && <div className="rounded bg-white p-2">Toutes les surfaces traitées sans erreur de maillage ni d’équilibre global.</div>}
                            {surfaceAnalysis.rows.map(row => (
                            <div key={row.elementId} className="space-y-2 rounded border border-[#d8e8e4] bg-white p-2">
                              <div className="font-semibold">{row.elementId} · {row.levelLabel} · aire nette {row.areaM2.toFixed(2)} m² · {row.openingCount} trémie(s)</div>
                              <SurfaceMeshPreview analysis={row.analysis} />
                              {row.analysis.mesh && <div>{row.analysis.mesh.nodes.length} nœuds · {row.analysis.mesh.triangles.length} triangles · aspect max {row.analysis.mesh.maximumAspectRatio.toFixed(2)} · charge nette {row.analysis.mesh.totalUniformLoadKn.toFixed(2)} kN</div>}
                              {row.analysis.plate && <>
                                <div className="font-semibold">{row.analysis.plate.boundary === "cantilever-fixed-edge" ? "Balcon en porte-à-faux" : row.analysis.plate.boundary === "one-way-simply-supported" ? "Plancher orthotrope à portée unidirectionnelle" : "Dalle pleine · quatre bords simplement appuyés"} · rives de réaction : {row.analysis.plate.edgeReactions.filter(edge => edge.totalKn > 0).map(edge => edge.edge).join(", ")}</div>
                                <div className="grid grid-cols-2 gap-1 rounded bg-[#eef9f6] p-2 font-semibold">
                                  <span>Flèche max {(row.analysis.plate.maximumDeflectionM * 1000).toFixed(2)} mm</span>
                                  <span>Max |Mx| {row.analysis.plate.maximumMxKnMPerM.toFixed(2)} kN·m/m</span>
                                  <span>Max |My| {row.analysis.plate.maximumMyKnMPerM.toFixed(2)} kN·m/m</span>
                                  <span>Charge/équilibre {row.analysis.plate.totalLoadKn.toFixed(2)} / résidu {row.analysis.plate.equilibriumResidualKn.toExponential(1)} kN</span>
                                </div>
                                <div className="grid grid-cols-2 gap-1">{row.analysis.plate.edgeReactions.map(edge => <span key={edge.edge}>{edge.edge} : {edge.totalKn.toFixed(2)} kN · {edge.lineLoadKnM.toFixed(2)} kN/m</span>)}</div>
                                {row.analysis.plate.notes?.map((note, index) => <div key={`${row.elementId}-note-${index}`} className="rounded bg-[#eef5ff] p-2 text-[#315b87]">Hypothèse de calcul · {note}</div>)}
                              </>}
                              {row.analysis.errors.map((message, index) => <div key={`${row.elementId}-error-${index}`} className="rounded bg-[#fff1ed] p-2 text-[#914d3d]">Non calculé · {message}</div>)}
                              {row.analysis.warnings.map((message, index) => <div key={`${row.elementId}-warning-${index}`} className="rounded bg-[#eef5ff] p-2 text-[#315b87]">Information de méthode · {message}</div>)}
                            </div>
                            ))}
                            {surfaceAnalysis.rows.length === 0 && surfaceAnalysis.errors.map((message, index) => <div key={`surface-error-${index}`} className="rounded bg-[#fff1ed] p-2 text-[#914d3d]">Erreur · {message}</div>)}
                            <Button type="button" variant="outline" className="h-8 bg-white text-[9px]" onClick={downloadSurfaceAnalysis}>Exporter résultats de surfaces JSON</Button>
                          </>}
                        </div>
                      )}
                    </div>
                  )}
                  {calculationExecuted && selected && selectedAnalysisRow && buildingCalculation && analyticalPrecheck?.ok && (
                    <div id="reinforcement-plan-section">
                    <ReinforcedConcretePanel
                      projectId={selected.id}
                      projectNorm={selected.norm ?? norm}
                      projectConcreteFckMpa={selectedProjectMaterials.concrete.fck}
                      projectRebarFykMpa={selectedProjectMaterials.rebar.fykMpa}
                      runRequestToken={reinforcementPlanRequestToken}
                      runRequestElementId={columnVerificationRequested && selectedAnalysisRow?.type === "Poteau" ? selectedAnalysisRow.id : null}
                      runRequestBarDiametersMm={columnVerificationSelectedBarDiameters}
                      runRequestBarCount={columnVerificationSelectedBarCount}
                      members={columnVerificationMemberDemands}
                      slabs={rcSlabDemands}
                      foundations={rcFoundationDemands}
                      walls={rcWallDemands}
                      stairs={rcStairDemands}
                      sourceWarnings={rcSourceWarnings}
                      onResultChange={setRcDesignResult}
                      onApplySection={applyOptimizedSection}
                      optimizedElementIds={optimizationLockedElementIds}
                    />
                    </div>
                  )}
                  {calculationExecuted && selected && buildingCalculation && analyticalPrecheck?.ok && (
                    <div className="hidden" aria-hidden="true">
                      <FoundationReactionPanel
                        key={`${selected.id}:${selected.levels.length}`}
                        model={analyticalModel}
                        result={planeAnalysis?.result ?? null}
                        gravityResult={automaticFoundationResult}
                        plane={analysisPlane}
                        soilProfile={projectGeotechnical}
                        onResultChange={setFoundationEvaluation}
                      />
                    </div>
                  )}
                  {calculationExecuted && buildingCalculation && recommendationItems.length > 0 && <div className="space-y-2 rounded-xl border border-[#efd49d] bg-[#fffaf0] p-3 text-[10px] text-[#765f36]">
                    <b className="text-[12px] text-[#8a5a21]">Contrôles à examiner après le calcul</b>
                    <p>« Non satisfaisant » indique un dépassement chiffré; « à vérifier » est indicatif; « bloqué » signifie que le contrôle n’est pas implémenté. Ces deux derniers statuts ne signifient pas que la section est insuffisante.</p>
                    {recommendationItems.slice(0, 20).map(item => <details key={`result-${item.elementId}:${item.title}`} className="rounded border border-[#f0dfb7] bg-white p-2">
                      <summary className="cursor-pointer font-semibold text-[#914d3d]">{item.elementId} · {item.title}</summary>
                      <ul className="mt-1 list-disc pl-4">{item.actions.map(action => <li key={action}>{action}</li>)}</ul>
                    </details>)}
                  </div>}
                  {calculationExecuted && buildingCalculation && (
                    <div className="space-y-2 rounded-lg border border-[#bfe4e2] bg-[#eaf8f7] p-3 text-[10px] text-[#245e60]">
                      <div className="flex items-center justify-between gap-2"><div className="font-bold text-[#087f7f]">Calcul terminé sur la structure modélisée</div><Button type="button" className="h-8 bg-[#1667c7] px-3 text-[10px] text-white hover:bg-[#1256a7]" onClick={downloadElementsPdf}><Download className="mr-1.5 h-3.5 w-3.5" />PDF</Button></div>
                      <div className="grid grid-cols-2 gap-1">
                        <span>Surfaces (dalles, balcons, escaliers) : {buildingCalculation.floorCount}</span>
                        <span>Balcons : {selected?.levels.flatMap(level => level.elements).filter(item => item.type === "Balcon").length ?? 0}</span>
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
                        <div className="rounded bg-white/70 px-2 py-1 text-[9px] font-semibold">Libellés : <b>G</b> = charge permanente · <b>Q</b> = charge d’exploitation · <b>Nu</b> = effort normal de calcul ELU · <b>Nser</b> = effort normal de service ELS</div>
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
                      <Dialog open={Boolean(selectedAnalysisRow) && !columnVerificationOpen} onOpenChange={open => { if (!open && !columnVerificationOpen) setSelectedAnalysisRow(null); }}>
                        <DialogContent className="fixed inset-x-0 bottom-0 top-auto left-0 z-[90] flex max-h-[86dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-t-[24px] border-0 bg-[#faf7fb] p-0 shadow-2xl sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border">
                          {selectedAnalysisRow && <>
                            <div className="mx-auto mt-2.5 h-1 w-12 shrink-0 rounded-full bg-[#c9c5cb] sm:hidden" />
                            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-4 sm:px-6">
                              <DialogHeader className="mb-3 gap-1 text-left">
                                <DialogTitle className="text-[16px] font-bold leading-5 tracking-tight text-[#28262b]">Origine des charges — {selectedAnalysisRow.label}</DialogTitle>
                                <DialogDescription className="text-[12px] leading-4 text-[#747078]">Charges caractéristiques (non pondérées) · Norme : BAEL 91 mod. 99.</DialogDescription>
                              </DialogHeader>
                              <div className="rounded-xl border border-[#e8e5ea] bg-white px-4 py-2.5 text-[12px] text-[#2f2c31]">
                                <div className="flex justify-between py-1 font-semibold"><span>G cumulé</span><span>{selectedAnalysisRow.gk.toFixed(1)} kN</span></div>
                                <div className="flex justify-between py-1 font-semibold"><span>Q cumulé</span><span>{selectedAnalysisRow.qk.toFixed(1)} kN</span></div>
                                <div className="my-1.5 border-t border-[#dedbe0]" />
                                <div className="flex justify-between py-1 font-bold"><span>Nu (ELU)</span><span>{selectedAnalysisRow.nu.toFixed(1)} kN</span></div>
                                <div className="flex justify-between py-1 font-bold"><span>Nser (ELS)</span><span>{selectedAnalysisRow.nser.toFixed(1)} kN</span></div>
                              </div>
                              <h3 className="mb-1 mt-4 text-[12px] font-bold text-[#79757d]">Contributions</h3>
                              <div className="divide-y divide-[#e9e5eb]">
                                {selectedAnalysisRow.type === "Poteau" ? <>
                                  {selectedColumnBeamOrigins.map(origin => <div key={origin.beamId} className="flex gap-3 px-1 py-1.5 text-[11px]">
                                    <span className="pt-0.5 text-base text-[#8c8790]" aria-hidden="true">↳</span><div className="min-w-0"><div className="font-semibold text-[#29262c]">Poutre portée — {origin.label}</div><div className="mt-0.5 text-[#66616b]">G {origin.gk.toFixed(1)} kN&nbsp;&nbsp; Q {origin.qk.toFixed(1)} kN</div></div>
                                  </div>)}
                                  <div className="flex gap-3 px-1 py-1.5 text-[11px]"><span className="pt-0.5 text-sm text-[#8c8790]" aria-hidden="true">↳</span><div><div className="font-semibold text-[#29262c]">Poids propre — {selectedAnalysisRow.id}</div><div className="mt-0.5 text-[#66616b]">G {selectedOwnWeight.toFixed(1)} kN&nbsp;&nbsp; Q 0.0 kN</div></div></div>
                                  {selectedColumnOtherOrigins.map((origin, index) => <div key={`other-${index}-${origin.source}`} className="flex gap-3 px-1 py-2 text-[12px]"><span className="pt-0.5 text-base text-[#8c8790]" aria-hidden="true">↳</span><div><div className="font-semibold text-[#29262c]">{origin.source}</div><div className="mt-0.5 text-[#66616b]">G {origin.gk.toFixed(1)} kN&nbsp;&nbsp; Q {origin.qk.toFixed(1)} kN</div></div></div>)}
                                  {selectedColumnTransferredOrigins.map((origin, index) => <div key={`transfer-${index}-${origin.sourceColumnId}`} className="flex gap-3 px-1 py-2 text-[12px]"><span className="pt-0.5 text-base text-[#8c8790]" aria-hidden="true">↳</span><div><div className="font-semibold text-[#29262c]">Charge transmise — {origin.label}{origin.levelLabel ? ` · ${origin.levelLabel}` : ""}</div><div className="mt-0.5 text-[#66616b]">G {origin.gk.toFixed(1)} kN&nbsp;&nbsp; Q {origin.qk.toFixed(1)} kN</div></div></div>)}
                                  {(Math.abs(selectedUnexplainedG) > 0.05 || Math.abs(selectedUnexplainedQ) > 0.05) && <div className="flex gap-3 px-1 py-2 text-[11px] text-[#8a5a21]"><span className="pt-0.5 text-base" aria-hidden="true">↳</span><div><div className="font-semibold">Écart de ventilation à vérifier</div><div className="mt-0.5">G {selectedUnexplainedG.toFixed(1)} kN&nbsp;&nbsp; Q {selectedUnexplainedQ.toFixed(1)} kN</div></div></div>}
                                  {selectedColumnBeamOrigins.length === 0 && <p className="rounded-lg bg-white p-3 text-[12px] text-[#77727a]">Aucune poutre connectée détectée pour ce poteau dans le modèle de calcul.</p>}
                                </> : selectedAnalysisRow.sources.length ? selectedAnalysisRow.sources.map((source, index) => <div key={`${index}-${source}`} className="flex gap-3 px-1 py-2 text-[11px]"><span className="pt-0.5 text-base text-[#8c8790]" aria-hidden="true">↳</span><div className="font-medium text-[#343138]">{source}</div></div>) : <p className="rounded-lg bg-white p-3 text-[12px] text-[#77727a]">Aucune contribution détaillée disponible pour cet élément.</p>}
                              </div>
                              <p className="mt-3 text-[9px] leading-3.5 text-[#89848d]">Nu = 1,35 G + 1,50 Q · Nser = G + Q. Résultat indicatif à vérifier par un ingénieur.</p>
                            </div>
                            {selectedAnalysisRow.type === "Poteau" && <div className="shrink-0 border-t border-[#e6e1e9] bg-[#faf7fb] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
                              <button type="button" onClick={openColumnVerification} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#7650b5] px-4 text-[13px] font-semibold text-white" aria-label="Ouvrir la fiche de ferraillage du poteau">
                                <PersonStanding className="h-5 w-5" />Ferraillage
                              </button>
                            </div>}
                          </>}
                        </DialogContent>
                      </Dialog>
                      <Dialog open={columnVerificationOpen && Boolean(selectedAnalysisRow)} onOpenChange={open => { if (!open) closeColumnVerification(); }}>
                        <DialogContent showCloseButton={false} className="fixed inset-0 z-[100] flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-[#f6f6f6] p-0 shadow-none sm:left-1/2 sm:top-1/2 sm:h-[92dvh] sm:max-h-[92dvh] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:shadow-2xl">
                          {selectedAnalysisRow && columnVerificationGeometry && <>
                            <header className="flex h-14 shrink-0 items-center gap-4 border-b border-[#e4e4e4] bg-white px-4">
                              <button type="button" onClick={closeColumnVerification} aria-label="Retour à l’origine des charges" className="grid h-10 w-10 place-items-center rounded-full text-[#173b73] hover:bg-[#f1f3f7]"><ArrowLeft className="h-6 w-6" /></button>
                              <DialogHeader className="min-w-0 flex-1 gap-0 text-left"><DialogTitle className="text-[16px] font-bold text-[#173b73]">Poteau {selectedAnalysisRow.id} · {selected?.norm || norm || "Norme du projet"}</DialogTitle><DialogDescription className="text-[10px]">Vérification du poteau sélectionné</DialogDescription></DialogHeader>
                            </header>
                            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
                              <section className="rounded-xl border border-[#e1e5eb] bg-white p-3">
                                <h3 className="mb-2.5 border-b border-[#e5e7eb] pb-2 text-[13px] font-semibold text-[#174b86]">Géométrie du poteau</h3>
                                <div className="mb-3 grid grid-cols-2 rounded-xl bg-[#eee] p-0.5 text-[12px] font-bold">
                                  {(["rectangular", "circular"] as const).map(shape => <button key={shape} type="button" onClick={() => setColumnVerificationGeometry(current => current ? { ...current, shape, dirty: true } : current)} className={`min-h-10 rounded-lg ${columnVerificationGeometry.shape === shape ? "bg-[#174e9e] text-white shadow-sm" : "text-[#454545]"}`}>{shape === "rectangular" ? "RECTANGULAIRE" : "CIRCULAIRE"}</button>)}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  {columnVerificationGeometry.shape === "rectangular" ? <>
                                    <label className="grid gap-1 text-[11px] text-[#666]">Dimension A (m)<Input aria-label="Dimension A du poteau en mètres" type="number" min="0.01" step="0.001" value={columnVerificationGeometry.widthM} onChange={event => setColumnVerificationGeometry(current => current ? { ...current, widthM: event.target.value, dirty: true } : current)} className="h-11 bg-white text-[14px] text-[#222]" /></label>
                                    <label className="grid gap-1 text-[11px] text-[#666]">Dimension B (m)<Input aria-label="Dimension B du poteau en mètres" type="number" min="0.01" step="0.001" value={columnVerificationGeometry.depthM} onChange={event => setColumnVerificationGeometry(current => current ? { ...current, depthM: event.target.value, dirty: true } : current)} className="h-11 bg-white text-[14px] text-[#222]" /></label>
                                  </> : <label className="col-span-2 grid gap-1 text-[11px] text-[#666]">Diamètre D (m)<Input aria-label="Diamètre du poteau en mètres" type="number" min="0.01" step="0.01" value={columnVerificationGeometry.diameterM} onChange={event => setColumnVerificationGeometry(current => current ? { ...current, diameterM: event.target.value, dirty: true } : current)} className="h-11 bg-white text-[14px] text-[#222]" /></label>}
                                  <label className="grid gap-1 text-[11px] text-[#666]">Longueur libre L (m)<Input aria-label="Longueur libre de la pièce en mètres" type="number" min="0.1" step="0.01" value={columnVerificationGeometry.heightM} onChange={event => setColumnVerificationGeometry(current => current ? { ...current, heightM: event.target.value, dirty: true } : current)} className="h-11 bg-white text-[14px] text-[#222]" /></label>
                                  <label className="grid gap-1 text-[11px] text-[#666]">Niveau détecté<select aria-label="Niveau détecté du poteau sélectionné" value={columnVerificationGeometry.levelId} disabled className="h-11 rounded-md border border-input bg-[#f4f5f7] px-3 text-[14px] text-[#555] disabled:cursor-not-allowed">{(selected?.levels ?? []).map(level => <option key={level.id} value={level.id}>{level.label}</option>)}</select></label>
                                </div>
                                <p className="mt-1 text-[9px] leading-4 text-[#777]">L est préremplie depuis la hauteur du niveau, sans les prolongements de raccordement du modèle analytique. Hypothèse utilisée ici : f = L; les liaisons réelles ne sont pas encore évaluées automatiquement.</p>
                                <div className="mt-4 flex items-center justify-between gap-4">
                                  <div><div className="text-[13px] font-semibold text-[#333]">Inclure le poids propre (Auto)</div><p className="mt-0.5 text-[11px] leading-4 text-[#777]">G = 25 kN/m³ × section</p></div>
                                  <input type="checkbox" checked={columnVerificationGeometry.selfWeight} onChange={event => setColumnVerificationGeometry(current => current ? { ...current, selfWeight: event.target.checked, dirty: true } : current)} aria-label="Inclure le poids propre du poteau" className="h-4 w-4 shrink-0 accent-[#174e9e]" />
                                </div>
                              </section>
                              <section className="rounded-xl border border-[#e1e5eb] bg-white p-3">
                                <h3 className="mb-2.5 border-b border-[#e5e7eb] pb-2 text-[13px] font-semibold text-[#174b86]">Descente de charges &amp; moments</h3>
                                <div className="space-y-3">
                                  {columnVerificationLoads.map((load, index) => <div key={load.id} className="rounded-lg border border-[#e6e8ec] bg-white p-2.5">
                                    <div className="grid grid-cols-[70px_1fr_34px] items-end gap-2 border-b border-[#ddd] pb-2">
                                      <label className="grid gap-1 text-[10px] text-[#666]">Type<select aria-label={`Type de charge ${index + 1}`} value={load.category} onChange={event => updateColumnLoadCategory(load.id, event.target.value)} className="h-9 rounded-md border-0 border-b border-[#bbb] bg-white px-1 text-[13px] font-bold text-[#333]"><option value="G">G</option><option value="Q">Q</option><option value="W">W</option><option value="S">S</option><option value="E">E</option><option value="Autre">Autre</option></select></label>
                                      <label className="grid gap-1 text-[10px] text-[#666]">Libellé<Input aria-label={`Libellé de charge ${index + 1}`} value={load.label} onChange={event => { setColumnVerificationLoads(current => current.map(item => item.id === load.id ? { ...item, label: event.target.value } : item)); setColumnVerificationLoadsDirty(true); setColumnVerificationGeometry(current => current ? { ...current, dirty: true } : current); }} className="h-9 border-0 border-b border-[#bbb] bg-white px-1 text-[13px]" /></label>
                                      <button type="button" onClick={() => { setColumnVerificationLoads(current => current.filter(item => item.id !== load.id)); setColumnVerificationLoadsDirty(true); setColumnVerificationGeometry(current => current ? { ...current, dirty: true } : current); }} aria-label={`Supprimer la charge ${load.label}`} className="mb-1 grid h-8 w-8 place-items-center text-red-500"><Trash2 className="h-5 w-5" /></button>
                                    </div>
                                    <div className="mt-2 grid grid-cols-[1fr_2fr] items-end gap-2">
                                      <label className="grid min-w-0 gap-1 text-[10px] text-[#666]">N (kN)<input aria-label={`N (kN) — ${load.label}`} type="number" step="any" value={load.axialKn} onChange={event => { setColumnVerificationLoads(current => current.map(item => item.id === load.id ? { ...item, axialKn: event.target.value } : item)); setColumnVerificationLoadsDirty(true); setColumnVerificationGeometry(current => current ? { ...current, dirty: true } : current); }} className="h-8 min-w-0 border-0 border-b border-[#999] bg-transparent px-0.5 text-[13px] text-[#222] outline-none focus:border-[#7250b3]" /></label>
                                    </div>
                                  </div>)}
                                </div>
                                <div className="mt-2 flex justify-end">
                                  <button type="button" onClick={() => { setColumnVerificationLoads(current => [...current, { id: `load-${Date.now()}`, category: "Q", label: "Nouvelle charge Q", axialKn: "0" }]); setColumnVerificationLoadsDirty(true); setColumnVerificationGeometry(current => current ? { ...current, dirty: true } : current); }} className="flex items-center gap-2 px-2 py-2 text-[12px] font-semibold text-[#6550a1]"><Plus className="h-4 w-4" />AJOUTER UNE LIGNE</button>
                                </div>
                                <div className="mt-3 rounded-lg border border-[#e1e6ed] bg-[#f7f9fc] p-3">
                                  <div className="mb-2 text-[11px] font-semibold text-[#455568]">Moments calculés · {selectedColumnSolvedMoments?.combinationName ?? "combinaison active"}</div>
                                  <div className="grid grid-cols-2 gap-3">
                                    <label className="grid gap-1 text-[10px] text-[#666]">Mx (kN·m)<Input aria-label="Moment calculé Mx en kilonewton-mètres" readOnly value={selectedColumnSolvedMoments ? (selectedColumnSolvedMoments.momentXKnM ?? selectedColumnSolvedMoments.momentKnM).toFixed(2) : ""} placeholder="—" className="h-9 bg-white text-[12px] text-[#222]" /></label>
                                    <label className="grid gap-1 text-[10px] text-[#666]">My (kN·m)<Input aria-label="Moment calculé My en kilonewton-mètres" readOnly value={selectedColumnSolvedMoments?.momentYKnM?.toFixed(2) ?? ""} placeholder="—" className="h-9 bg-white text-[12px] text-[#222]" /></label>
                                  </div>
                                  <p className="mt-1.5 text-[10px] leading-4 text-[#718093]">Une seule paire pour la combinaison G + Q calculée.</p>
                                </div>
                                <div className="mt-2 rounded-lg border border-[#dbe5ef] bg-[#f7f9fc] p-2.5 text-[9px] leading-4 text-[#58677a]">
                                  <b className="text-[#344054]">Origine des charges axiales</b>
                                  {!columnVerificationLoadsDirty
                                    ? <p>Poutres connectées G/Q : {selectedBeamG.toFixed(1)} / {selectedBeamQ.toFixed(1)} kN · poteaux supérieurs : {selectedTransferredG.toFixed(1)} / {selectedTransferredQ.toFixed(1)} kN · autres sources : {selectedOtherG.toFixed(1)} / {selectedOtherQ.toFixed(1)} kN · non ventilé : {selectedUnexplainedG.toFixed(1)} / {selectedUnexplainedQ.toFixed(1)} kN · poids propre initial : {selectedOwnWeight.toFixed(1)} kN.</p>
                                    : <p>Les lignes G/Q ont été modifiées manuellement : les valeurs saisies prévalent sur la ventilation issue du modèle.</p>}
                                  <p>Le poids propre Auto remplace l’ancienne valeur par 25 kN/m³ × section vérifiée × L; le transfert des poutres reste inclus.</p>
                                </div>
                              </section>
                              <section className="overflow-hidden rounded-xl border border-[#e1e5eb] bg-white">
                                <button type="button" aria-expanded={showColumnBarCatalog} onClick={() => setShowColumnBarCatalog(value => !value)} className="flex min-h-10 w-full items-center justify-between px-3 text-left text-[11px] font-semibold text-[#6550a1]"><span className="flex items-center gap-2"><BookOpen className="h-4 w-4" />CATALOGUE D’ARMATURES HA</span><span>{showColumnBarCatalog ? "−" : "+"}</span></button>
                                {showColumnBarCatalog && <div className="border-t border-[#edf0f4] px-3 py-2.5">
                                  <p className="mb-2 text-[10px] leading-4 text-[#667085]">Choisissez AUTO pour tout le catalogue, ou cochez un ou plusieurs diamètres. Un seul HA sélectionné impose ce diamètre à toutes les barres; plusieurs HA autorisent une disposition mixte symétrique.</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    <button type="button" aria-pressed={columnVerificationSelectedBarDiameters.length === 0} onClick={() => updateColumnBarDiameterSelection()} className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${columnVerificationSelectedBarDiameters.length === 0 ? "border-[#6550a1] bg-[#6550a1] text-white" : "border-[#ded8ea] bg-[#f8f6fb] text-[#5f4691]"}`}>AUTO · TOUTES</button>
                                    {selectableColumnBarDiameters.map(diameter => { const active = columnVerificationSelectedBarDiameters.includes(diameter); return <button key={diameter} type="button" aria-pressed={active} onClick={() => updateColumnBarDiameterSelection(diameter)} className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${active ? "border-[#6550a1] bg-[#6550a1] text-white" : "border-[#ded8ea] bg-[#f8f6fb] text-[#5f4691]"}`}>HA {diameter} · {formatHACatalogArea(1, diameter)} cm²</button>; })}
                                  </div>
                                  <div className="mt-3 border-t border-[#edf0f4] pt-2">
                                    <p className="mb-1.5 text-[10px] font-semibold text-[#344054]">NOMBRE TOTAL DE BARRES LONGITUDINALES</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      <button type="button" aria-pressed={columnVerificationSelectedBarCount === null} onClick={() => updateColumnBarCountSelection()} className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${columnVerificationSelectedBarCount === null ? "border-[#6550a1] bg-[#6550a1] text-white" : "border-[#ded8ea] bg-[#f8f6fb] text-[#5f4691]"}`}>AUTO</button>
                                      {selectableColumnBarCounts.map(count => <button key={count} type="button" aria-pressed={columnVerificationSelectedBarCount === count} onClick={() => updateColumnBarCountSelection(count)} className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${columnVerificationSelectedBarCount === count ? "border-[#6550a1] bg-[#6550a1] text-white" : "border-[#ded8ea] bg-[#f8f6fb] text-[#5f4691]"}`}>{count} barres</button>)}
                                    </div>
                                    <p className="mt-1 text-[9px] text-[#667085]">Le nombre sélectionné est imposé et contrôlé avec la section, les charges et les diamètres cochés.</p>
                                    {columnVerificationSelectedBarCount === 9 && columnVerificationGeometry?.shape !== "circular" ? <p className="mt-1 text-[9px] text-[#667085]">Pour 9 barres rectangulaires : 8 en périphérie et 1 au centre, tenue par les épingles transversales.</p> : null}
                                  </div>
                                  <p className="mt-1 text-[9px] text-[#667085]">Aire tabulée par barre; HA 5–6 restent visibles dans le tableau mais ne sont pas admis ici comme armatures longitudinales.</p>
                                  <a href="/assets/ha-bar-area-table.jpg" target="_blank" rel="noreferrer" className="mt-2 block rounded border border-[#e1e5eb] bg-white p-1" title="Ouvrir le tableau des aires HA en taille réelle"><img src="/assets/ha-bar-area-table.jpg" alt="Tableau fourni des aires HA en cm², par diamètre et nombre de barres" loading="lazy" className="mx-auto max-h-64 w-full object-contain" /></a>
                                  {selectedColumnVerificationDesign?.reinforcement.filter(item => item.id.startsWith(`${selectedAnalysisRow?.id}:longitudinal`)).length ? <p className="mt-2 text-[10px] font-semibold text-[#344054]">Dernière disposition : {selectedColumnVerificationDesign.reinforcement.filter(item => item.id.startsWith(`${selectedAnalysisRow?.id}:longitudinal`)).map(item => `${item.count} HA${item.diameterMm} (${formatHACatalogArea(item.count, item.diameterMm)} cm²)`).join(" + ")}</p> : null}
                                </div>}
                              </section>
                              <section aria-live="polite" className={`rounded-xl border p-3 ${columnVerificationState === "passed" ? "border-emerald-700 bg-[#27883d] text-white" : columnVerificationState === "failed" ? "border-red-700 bg-[#c73535] text-white" : "border-orange-400 bg-[#ed7900] text-white"}`}>
                                <div className="flex items-start justify-between gap-3"><div><h3 className="text-[13px] font-bold">{columnVerificationState === "passed" ? "DIMENSIONNEMENT DE SECTION SATISFAISANT" : columnVerificationState === "failed" ? unsupportedColumnBarCheck ? "DIAMÈTRE HA NON ADMIS" : "SECTION INSUFFISANTE" : columnVerificationState === "running" ? "VÉRIFICATION EN COURS" : columnVerificationState === "stale" ? "SECTION MODIFIÉE · À REVÉRIFIER" : columnVerificationState === "blocked" ? "VÉRIFICATION BLOQUÉE" : "VÉRIFICATION À LANCER"}</h3><p className="mt-1 text-[10px] leading-4 text-white/90">{columnVerificationFeedback ?? (columnVerificationState === "passed" ? "La section et les armatures sont dimensionnées." : columnVerificationState === "failed" ? "Au moins un contrôle de résistance ou de disposition n’est pas satisfait. Consultez les contrôles ci-dessous." : columnVerificationState === "running" ? "Le moteur recherche une disposition dans le catalogue HA sélectionné…" : columnVerificationState === "stale" ? "La géométrie, les diamètres HA ou leur nombre ont changé. Relancez la vérification pour évaluer cette variante." : columnVerificationState === "blocked" ? (selectedColumnVerificationDesign?.checks.find(item => item.status === "bloqué")?.formula ?? rcDesignResult?.errors[0] ?? "Les efforts, le catalogue ou les paramètres nécessaires ne permettent pas de conclure.") : "Lancez le calcul pour comparer les charges et les moments à la section du poteau.")}</p></div><span className="rounded-full bg-white/20 px-2 py-1 text-[9px] font-bold">{columnVerificationState === "passed" ? "OK · PRÉ-ÉTUDE" : columnVerificationState === "failed" ? "NON SATISFAIT" : columnVerificationState === "running" ? "CALCUL" : "EN ATTENTE"}</span></div>
                                {columnVerificationState === "blocked" && selectedColumnVerificationDesign && <div className="mt-2.5 space-y-1.5 border-t border-white/25 pt-2.5 text-[10px]">{columnVerificationCoreChecks.filter(item => item.status === "bloqué").map(item => <div key={item.id} className="rounded-md bg-black/10 px-2 py-1"><b>{item.label}</b><small className="mt-0.5 block">{item.formula}</small></div>)}</div>}
                              {(columnVerificationState === "passed" || columnVerificationState === "failed") && selectedColumnVerificationDesign && <div className="mt-2.5 space-y-1.5 border-t border-white/25 pt-2.5 text-[11px]"><div className="flex justify-between gap-2"><span>Effort axial de calcul</span><b>{(columnVerificationMemberDemands.find(demand => demand.id === selectedAnalysisRow.id)?.axialKn ?? 0).toFixed(1)} kN</b></div><div className="flex justify-between gap-2"><span>Mx / My utilisés</span><b>{(selectedColumnSolvedMoments?.momentXKnM ?? selectedColumnSolvedMoments?.momentKnM ?? 0).toFixed(2)} / {(selectedColumnSolvedMoments?.momentYKnM ?? 0).toFixed(2)} kN·m</b></div>{selectedColumnVerificationDesign.reinforcement.filter(item => item.id.startsWith(`${selectedAnalysisRow?.id}:longitudinal`) || item.id.endsWith(":ties") || item.id.endsWith(":cross-ties")).map(item => { const isLongitudinal = item.id.startsWith(`${selectedAnalysisRow?.id}:longitudinal`); return <div key={item.id} className="flex justify-between gap-2"><span>{isLongitudinal ? "Armatures longitudinales" : item.id.endsWith(":cross-ties") ? "Épingles de maintien" : "Cadres transversaux"}</span><b className="text-right">{isLongitudinal ? `${item.count} HA ${item.diameterMm} · ${formatHACatalogArea(item.count, item.diameterMm)} cm²` : item.label.replace(/^Cadres[^·]*· /, "")}</b></div>; })}{selectedColumnVerificationDesign.columnReport?.baelCompression && <p className="rounded-md bg-black/10 px-2 py-1 text-[9px] leading-4">BAEL : Imin={selectedColumnVerificationDesign.columnReport.baelCompression.minimumInertiaMm4.toExponential(2)} mm⁴ · i={selectedColumnVerificationDesign.columnReport.baelCompression.radiusGyrationMm.toFixed(1)} mm · Lf={selectedColumnVerificationDesign.columnReport.bucklingLengthMm.toFixed(0)} mm · λ={selectedColumnVerificationDesign.columnReport.baelCompression.slenderness.toFixed(1)} · α={selectedColumnVerificationDesign.columnReport.baelCompression.alpha.toFixed(3)} · Br={selectedColumnVerificationDesign.columnReport.baelCompression.reducedConcreteAreaMm2.toFixed(0)} mm² · As th/min/req={selectedColumnVerificationDesign.columnReport.AsTheoreticalMm2.toFixed(0)}/{selectedColumnVerificationDesign.columnReport.AsMinimumMm2.toFixed(0)}/{selectedColumnVerificationDesign.columnReport.AsRequiredMm2.toFixed(0)} mm²</p>}{selectedColumnVerificationDesign.columnReport?.optimizationTrace.map((reason, index) => <p key={`candidate-${index}`} className="rounded-md bg-black/10 px-2 py-1 text-[9px] leading-4">{reason}</p>)}{baelSecondOrderDomainCheck && baelColumnChecksActive && <p className="rounded-md bg-black/10 px-2 py-1 text-[9px] leading-4">{baelSecondOrderDomainCheck.formula}</p>}{selectedColumnVerificationDesign.checks.filter(item => item.id === "column-bael-detailing").map(item => <div key={item.id} className="rounded-md bg-black/10 px-2 py-1"><b>{item.label} · {item.status}</b><small className="mt-0.5 block">{item.status === "satisfaisant" ? "A.8.1 calculé : taux minimal/maximal, répartition périphérique et espacement des cadres." : item.status === "non satisfaisant" ? "Au moins une disposition BAEL calculée (acier, pas ou espacement) est dépassée." : "Aucune conclusion avec les données disponibles."}</small></div>)}{columnVerificationFailedChecks.map(item => <div key={item.id} className="rounded-md bg-black/10 px-2 py-1"><b>À corriger · {item.label}{item.utilization !== null ? ` (${(item.utilization * 100).toFixed(0)} %)` : ""}</b><small className="mt-0.5 block">{item.id === "column-axial" ? "Augmenter les dimensions A/B, améliorer la classe du béton après validation, ou réduire l’effort transmis." : item.id === "column-interaction" ? "Augmenter A et/ou B, choisir un diamètre HA supérieur ou revoir l’agencement des barres." : item.id === "column-bar-spacing" ? "La disposition est trop serrée : augmenter la face de la section ou choisir moins de barres plus grosses." : item.id === "column-steel-max" ? "Le taux d’acier dépasse la limite déclarée : augmenter la section béton et recalculer." : item.id === "column-steel-min" ? "Augmenter les armatures longitudinales au minimum requis." : item.id === "column-second-order" ? (item.label.includes("A.4.4") ? `${item.formula} Augmenter A/B ou revoir la longueur efficace f et les appuis.` : "Vérifier le domaine de validité BAEL A.4.3,5 et les hypothèses du poteau.") : item.id === "column-bael-detailing" ? "Revoir la section, le diamètre HA, la répartition des barres ou le diamètre/pas des cadres selon A.8.1." : item.id === "column-tie-spacing" ? "Réduire le pas des cadres conformément à la limite calculée BAEL." : item.id === "column-bar-layout-count" ? "Ajouter des barres et les répartir régulièrement sur les faces/contour." : "Choisir un diamètre longitudinal admis par le catalogue du référentiel sélectionné."}</small></div>)}</div>}
                              </section>
                              {selectedColumnVerificationDesign && <>
                                <section aria-live="polite" className="rounded-xl border border-[#e1e5eb] bg-white p-3">
                                  <h3 className="mb-2 text-[12px] font-semibold text-[#174b86]">Avertissements de ce poteau</h3>
                                  <div className="space-y-1.5">
                                    {selectedColumnVerificationDesign.checks.filter(item => item.status !== "satisfaisant").map(item => <div key={item.id} className="rounded-md bg-[#fff5e8] px-2 py-1.5 text-[10px] text-[#744b14]"><b>{item.label} · {item.status}</b><small className="mt-0.5 block leading-4">{item.formula}</small></div>)}
                                    {selectedColumnVerificationDesign.limitations.map((item, index) => <div key={`limitation-${index}`} className="rounded-md bg-[#f3f5f8] px-2 py-1.5 text-[10px] leading-4 text-[#576273]">{item}</div>)}
                                    {rcDesignResult?.errors.map((item, index) => <div key={`design-error-${index}`} className="rounded-md bg-red-50 px-2 py-1.5 text-[10px] leading-4 text-red-800">{item}</div>)}
                                    {rcDesignResult?.warnings.map((item, index) => <div key={`design-warning-${index}`} className="rounded-md bg-amber-50 px-2 py-1.5 text-[10px] leading-4 text-amber-800">{item}</div>)}
                                  </div>
                                </section>
                              </>}
                              <button type="button" disabled={columnVerificationState === "running"} onClick={runColumnVerification} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#174e9e] px-4 text-[13px] font-semibold text-white disabled:opacity-60"><Calculator className="h-4 w-4" />{columnVerificationState === "running" ? "Calcul en cours…" : "Lancer la vérification"}</button>
                              {columnVerificationState === "passed" && <div className="space-y-1.5"><button type="button" disabled={columnVerificationAlreadySaved} onClick={saveColumnVerificationResult} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#27883d] px-4 text-[13px] font-semibold text-white hover:bg-[#217735] disabled:cursor-default disabled:bg-[#e7f4e9] disabled:text-[#27883d]">{columnVerificationAlreadySaved ? "Calculs enregistrés dans le modèle" : "Enregistrer les calculs"}</button><p className="text-center text-[9px] leading-4 text-[#667085]">La section vérifiée sera appliquée au poteau en 2D et 3D, avec sa couleur actuelle. Les efforts restent ceux de l’analyse actuelle; relancez l’analyse globale après changement de section avant validation finale.</p></div>}
                              <div className="grid grid-cols-2 gap-3">
                                <button type="button" disabled className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#dedede] px-2 text-[12px] font-semibold text-[#999] disabled:cursor-not-allowed"><Download className="h-4 w-4" />Note de calcul</button>
                                <button type="button" disabled className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#dedede] px-2 text-[12px] font-semibold text-[#999] disabled:cursor-not-allowed"><PersonStanding className="h-4 w-4" />Plan d’exécution</button>
                              </div>
                              <div className="flex items-center gap-3 text-[10px] font-semibold text-[#999]"><span className="h-px flex-1 bg-[#ccc]" />Exports BIM &amp; CAD<span className="h-px flex-1 bg-[#ccc]" /></div>
                              <button type="button" disabled className="min-h-12 w-full rounded-2xl bg-[#dedede] px-4 text-[13px] font-semibold text-[#999] disabled:cursor-not-allowed">Format DXF (AutoCAD)<span className="block text-[10px] font-normal">Plans 2D &amp; modèle 3D</span></button>
                            </div>
                          </>}
                        </DialogContent>
                      </Dialog>
                      {buildingCalculation.warnings.length > 0 && (
                        <div className="rounded bg-[#fff5e8] p-2 text-[#8a5a21]">
                          {buildingCalculation.warnings
                            .slice(0, 4)
                            .map(warning => (
                              <details key={warning} className="cursor-pointer" onClick={() => focusCalculationDiagnostic(warning)}><summary>⚠ {warning}</summary><p className="mt-1 pl-4">Cliquez pour ouvrir l’élément ou la donnée concernée et vérifier ses charges, ses appuis et la cohérence de son transfert.</p></details>
                            ))}
                        </div>
                      )}
                    </div>
                  )}

                  </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
      {showCalculationPreflight && createPortal((
        <div className="fixed inset-0 z-[80] grid place-items-center bg-[#102f45]/45 p-4" role="dialog" aria-modal="true" aria-labelledby="calculation-preflight-title">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl border border-[#cbdde1] bg-[#f8fbfc] p-4 shadow-2xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div><h2 id="calculation-preflight-title" className="text-base font-bold text-[#173b50]">Préparer le calcul structurel</h2><p className="mt-1 text-[11px] text-[#63777f]">Le solveur reste verrouillé jusqu’à la validation du maillage et de l’application des charges.</p></div>
              <button type="button" className="grid h-8 w-8 place-items-center rounded-full bg-white text-[#718083]" onClick={() => setShowCalculationPreflight(false)} aria-label="Fermer"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className={`rounded-xl border p-3 ${meshPrerequisiteReady ? "border-[#bfe4e2] bg-[#eaf8f7]" : "border-[#dce7eb] bg-white"}`}>
                <div className="flex items-center justify-between"><b className="text-[12px] text-[#245e60]">1. Faire le maillage</b><span className="text-[10px] font-bold">{meshPrerequisiteReady ? "VALIDÉ" : "À FAIRE"}</span></div>
                <p className="mt-1 text-[10px] text-[#68767d]">Maillage triangulaire de toutes les surfaces analytiques du modèle (dalles, balcons, voiles, escaliers et semelles). Ce maillage géométrique n’implique pas à lui seul la rigidité de coque ni le couplage coque/barres dans le solveur.</p>
                <div className="mt-2 grid grid-cols-[1fr_auto] gap-2"><label className="flex items-center gap-2 text-[9px]">Taille cible (m)<Input aria-label="Taille de maille des surfaces en mètres" inputMode="decimal" value={surfaceMeshSizeM} onChange={event => { setSurfaceMeshSizeM(event.target.value); setMeshPrerequisiteReady(false); setLoadCasesPrerequisiteReady(false); }} className="h-8 w-24 bg-white text-[10px]" /></label><Button type="button" className="h-8 bg-[#087f7f] px-3 text-[9px] text-white disabled:opacity-50" disabled={meshPrerequisiteReady} onClick={runAllSurfaceMeshing}>{meshPrerequisiteReady ? "Maillage validé" : "Faire le maillage"}</Button></div>
                {analyticalSurfaceMesh && <><Button type="button" variant="outline" className="mt-2 h-8 bg-white text-[9px]" onClick={() => setShowMeshDetails(value => !value)}>{showMeshDetails ? "Masquer les détails" : "Voir les détails du maillage"}</Button><div className={`mt-2 space-y-1 text-[9px] text-[#536b70] ${showMeshDetails ? "" : "hidden"}`}><div className="rounded bg-white p-2">{analyticalSurfaceMesh.surfaces.length} surface(s) · {analyticalSurfaceMesh.nodes.length} nœud(s) partagés · {analyticalSurfaceMesh.triangles.length} triangle(s) · {analyticalSurfaceMesh.errors.length} erreur(s)</div>{analyticalSurfaceMesh.surfaces.map(surface => <div key={surface.surfaceId} className="rounded bg-white px-2 py-1">{surface.sourceElementId} · {surface.kind} · {surface.nodeCount} nœuds / {surface.triangleCount} triangles · {surface.areaM2.toFixed(2)} m²{surface.errors.length ? ` · ${surface.errors.join("; ")}` : ""}</div>)}{analyticalSurfaceMesh.errors.map((message,index)=><div key={`mesh-error-${index}`} className="rounded bg-[#fff1ed] p-2 text-[#914d3d]">Erreur · {message}</div>)}{analyticalSurfaceMesh.warnings.map((message,index)=><div key={`mesh-warning-${index}`} className="rounded bg-[#fff5e8] p-2 text-[#8a5a21]">Limite · {message}</div>)}</div></>}
                {surfaceAnalysis?.errors.map((message,index)=><div key={`plate-mesh-error-${index}`} className="mt-1 rounded bg-[#fff1ed] p-2 text-[9px] text-[#914d3d]">Contrôle plaque · {message}</div>)}
              </div>
              <div className={`rounded-xl border p-3 ${loadCasesPrerequisiteReady ? "border-[#bfe4e2] bg-[#eaf8f7]" : loadApplicationReport && (loadApplicationReport.errors.length || loadApplicationReport.warnings.length) ? "border-[#efc4b9] bg-[#fff1ed]" : "border-[#dce7eb] bg-white"}`}>
                <div className="flex items-center justify-between"><b className="text-[12px] text-[#245e60]">2. Appliquer les charges</b><span className="text-[10px] font-bold">{loadCasesPrerequisiteReady ? "VALIDÉ" : loadApplicationReport && (loadApplicationReport.errors.length || loadApplicationReport.warnings.length) ? "BLOQUÉ" : "À FAIRE"}</span></div>
                <p className="mt-1 text-[10px] text-[#68767d]">Chaque dalle, volée et palier reçoit une ligne Gk/Qk nommée selon son type; les éléments du squelette (poutres, voiles, poteaux) gardent leurs propres poids et sources. Le contrôle vérifie aussi le transfert aux appuis et les combinaisons ELU/ELS.</p>
                <div className="mt-2 rounded bg-white p-2 text-[9px]">Gk : <b>{buildingCalculation?.totalGk.toFixed(2) ?? "0.00"} kN</b> · Qk : <b>{buildingCalculation?.totalQk.toFixed(2) ?? "0.00"} kN</b> · combinaisons actives : <b>{loadProgram.combinations.filter(item=>item.enabled).length}</b></div>
                <Button type="button" className="mt-2 h-9 w-full bg-[#087f7f] text-[10px] text-white disabled:opacity-40" disabled={!meshPrerequisiteReady || loadCasesPrerequisiteReady} onClick={applyBuildingLoads}>{loadCasesPrerequisiteReady ? "Charges validées" : "Appliquer les charges"}</Button>
                  {loadApplicationReport && <><Button type="button" variant="outline" className="mt-2 h-8 w-full bg-white text-[9px]" onClick={() => setShowLoadDetails(value => !value)}>{showLoadDetails ? "Masquer les détails" : "Voir les détails des charges"}</Button><div className={`mt-2 space-y-1 text-[9px] ${showLoadDetails ? "" : "hidden"}`}>
                  <div className="rounded bg-[#eef6f7] px-2 py-1 text-[9px] font-bold text-[#245e60]">LIBELLÉS DES CHARGES — G = permanente · Q = exploitation · Nu = ELU · Nser = ELS</div>
                  <div className="rounded bg-[#eef6f7] px-2 py-1 font-bold text-[#245e60]">SURFACES — affectation individuelle</div>
                  {loadApplicationReport.surfaceRows.map(row=><div key={row.id} className="rounded bg-white p-1.5"><b>{row.loadName}</b> · {row.areaM2.toFixed(2)} m² · Gk {row.gkKnM2.toFixed(2)} / Qk {row.qkKnM2.toFixed(2)} kN/m² → {row.gk.toFixed(2)} / {row.qk.toFixed(2)} kN · transfert vers appui {row.transferred ? "contrôlé" : "absent"}</div>)}
                  <div className="mt-2 rounded bg-[#eef6f7] px-2 py-1 font-bold text-[#245e60]">SQUELETTE — poids propres et charges propagées</div>
                  {loadApplicationReport.skeletonRows.map(row=><div key={row.id} className="rounded bg-white p-1.5"><b>{row.loadName}</b> · Gk {row.gk.toFixed(2)} / Qk {row.qk.toFixed(2)} kN{row.sources.length ? <div className="mt-0.5 text-[#6f7f83]">Sources : {row.sources.slice(0,4).join("; ")}{row.sources.length > 4 ? `; … ${row.sources.length-4} autre(s)` : ""}</div> : null}</div>)}
                  {loadApplicationReport.combinationRows.map(row=><div key={row.id} className="rounded bg-white p-1.5"><b>{row.name}</b> · {row.category} · {row.formula} · {row.status} · {row.lineLoadCount} charge(s) linéaire(s)</div>)}
                </div></>}
                  {loadApplicationReport && (loadApplicationReport.errors.length > 0 || loadApplicationReport.warnings.length > 0) && <div className="mt-2 space-y-1 rounded-lg border border-[#efc4b9] bg-[#fffaf6] p-2 text-[9px]"><div className="font-bold text-[#914d3d]">Contrôles à corriger avant de lancer le calcul</div>{loadApplicationReport.errors.map((message,index)=><details key={`visible-load-error-${index}`} className="rounded bg-[#fff1ed] p-2 text-[#914d3d]" onClick={() => focusCalculationDiagnostic(message)}><summary className="cursor-pointer font-semibold">Erreur · {message}</summary><p className="mt-1 pl-4">Cliquez pour ouvrir la zone de correction correspondante.</p></details>)}{loadApplicationReport.warnings.slice(0,12).map((message,index)=><details key={`visible-load-warning-${index}`} className="rounded bg-[#fff5e8] p-2 text-[#8a5a21]" onClick={() => focusCalculationDiagnostic(message)}><summary className="cursor-pointer font-semibold">Avertissement · {message}</summary><p className="mt-1 pl-4">Cliquez pour ouvrir la zone de donnée ou l’élément à corriger.</p></details>)}{loadApplicationReport.warnings.length > 12 && <div className="text-[#8a5a21]">… {loadApplicationReport.warnings.length - 12} autre(s) avertissement(s)</div>}</div>}
                {recommendationItems.length > 0 && <div className="mt-2 space-y-2 rounded-lg border border-[#efd49d] bg-[#fffaf0] p-2 text-[9px] text-[#765f36]">
                  <div className="font-bold text-[11px] text-[#8a5a21]">Contrôles à examiner</div>
                  <p>Les valeurs « à vérifier » sont indicatives et les contrôles « bloqués » ne sont pas calculés; seuls les dépassements chiffrés justifient une correction de résistance. Après modification, relancez le maillage et l’application des charges.</p>
                  {recommendationItems.slice(0, 20).map(item => <div key={`${item.elementId}:${item.title}`} className="rounded border border-[#f0dfb7] bg-white p-2">
                    <div className="font-bold text-[#914d3d]">{item.elementId} · {item.title}</div>
                    <ul className="mt-1 list-disc pl-4">{item.actions.map(action => <li key={action}>{action}</li>)}</ul>
                  </div>)}
                  {recommendationItems.length > 20 && <div>… {recommendationItems.length - 20} autre(s) recommandation(s)</div>}
                </div>}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#dce7eb] bg-white p-3"><span className="text-[10px] text-[#68767d]">{loadCasesPrerequisiteReady ? "Maillage et charges catalogués selon les références françaises validés. Les résultats restent une pré-étude non certifiée; les données du site, du sol et le modèle doivent être vérifiés par un ingénieur." : "Terminez les deux étapes et corrigez les erreurs affichées pour déverrouiller le calcul."}</span><Button type="button" className="h-9 bg-[#102f45] px-4 text-[10px] text-white" disabled={!analyticalPrecheck?.ok || !meshPrerequisiteReady || !loadCasesPrerequisiteReady || Boolean(structuralValidation?.issues.some(item => item.severity === "error"))} onClick={executeBuildingCalculation}>Lancer les calculs</Button></div>
          </div>
        </div>
      ), document.body)}
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
    massSource: { ...program.massSource, patternFactors: { ...program.massSource.patternFactors, [patternId]: value }, status: "provisional", provenance: "manual" },
  });
  const confirmMassSource = () => onChange({
    ...program,
    massSource: {
      ...program.massSource,
      patternFactors: { ...program.massSource.patternFactors, Q: 0.30 },
      status: "ready",
      provenance: "confirmed",
      note: "ψ2(Q)=0,30 confirmé pour la catégorie habitation; validation utilisateur de la source de masse EC8 enregistrée.",
    },
  });
  const warnings = diagnostics.filter(item=>item.severity === "warning");
  const massSourceConfirmed = program.massSource.status === "ready" || program.massSource.provenance === "confirmed";
  return <details id="gcbtp-mass-source-editor" className="rounded-lg border border-[#dce7eb] bg-white p-3 text-[10px] text-[#3d4b50]">
    <summary className="cursor-pointer font-bold text-[#27358f]">Cas de charges, combinaisons et source de masse — {program.cases.length} cas / {program.combinations.filter(item=>item.enabled).length} combinaisons actives</summary>
    <div className="mt-2 space-y-2">
      <div className="rounded bg-[#fff5e8] p-2 text-[#8a5a21]">
        <b>{massSourceConfirmed ? "Source de masse validée par l’utilisateur." : "Source de masse sismique à confirmer."}</b> Référentiel déclaré : {projectNorm || program.selectedStandard}. Les combinaisons automatiques utilisent le catalogue français d’actions et de coefficients (γ/ψ); sous BAEL, cette base est validée pour le projet. La base française peut être retenue pour les sites africains par choix du projet; confirmer l’édition/annexe et les paramètres locaux. Les actions climatiques et les données du site restent à déterminer; {massSourceConfirmed ? "la source de masse EC8 est marquée comme validée dans ce projet." : "la source de masse sismique requiert les facteurs EC8 par niveau."} G/Q proviennent de la descente tributaire; les autres valeurs globales ne sont pas encore distribuées spatialement et ne constituent pas des cas dimensionnants.
      </div>
      <div className="space-y-1">
        <div className="font-semibold">Actions / patterns</div>
        {program.patterns.filter(pattern => pattern.enabled).map(pattern => {
          const value = patternValues[pattern.id] ?? pattern.value;
          return <div key={pattern.id} className="grid grid-cols-[1fr_90px] items-center gap-2 rounded border border-[#edf1f1] p-2">
            <div><b>{pattern.name}</b><div className="text-[9px] text-[#74858c]">{pattern.source} · {loadProgramStatusLabel(pattern.status)}{pattern.selfWeightMultiplier ? ` · poids propre × ${pattern.selfWeightMultiplier}` : ""}</div></div>
            <div className="text-right font-semibold">{value.toFixed(2)} kN</div>
          </div>;
        })}
      </div>
      <div className="grid gap-1 rounded border border-[#edf1f1] p-2">
        <div className="font-semibold">Source de masse : {evaluation.massTonnes.toFixed(3)} t équivalentes</div>
        <div className="text-[9px] text-[#74858c]">Σ poids des actions × fractions de masse ÷ g ; statut {loadProgramStatusLabel(program.massSource.status)}. ψ2(Q) vient du catalogue d’usage; {massSourceConfirmed ? "la validation utilisateur EC8 est enregistrée par niveau." : "le calcul EC8 complet utilise ψE=φ·ψ2 par niveau."}</div>
        <label className="flex items-center gap-2">Fraction de Q incluse dans la masse
          <input className="h-7 w-20 rounded border px-1" type="number" min="0" max="1" step="0.05" value={program.massSource.patternFactors.Q ?? 0} onChange={event=>updateMassFactor("Q",Number(event.target.value))} />
        </label>
        <Button type="button" className="h-8 bg-[#087f7f] text-[9px] text-white" onClick={confirmMassSource}>Confirmer 0,30 pour habitation</Button>
      </div>
      <div className="space-y-1">
        <div className="font-semibold">Combinaisons — facteurs catalogués, résultantes globales de pré-étude</div>
        {evaluation.combinations.filter(item=>item.enabled).map(result=>{
          const combination=program.combinations.find(item=>item.id===result.id)!;
          return <details key={result.id} className="rounded border border-[#edf1f1] p-2">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2"><span><b>{result.name}</b> · {loadProgramStatusLabel(combination.status)}</span><span className="font-bold">{result.value.toFixed(2)} kN</span></summary>
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
