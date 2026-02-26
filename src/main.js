import { MapCore } from './map/MapCore.js';
import { OverlayService } from './ui/OverlayService.js';
import { CoordinateService } from './services/CoordinateService.js';
import { CoordinateParser } from './services/CoordinateParser.js';
import { TopBar } from './ui/TopBar.js';
import { SideMenu } from './ui/SideMenu.js';
import { BottomBar } from './ui/BottomBar.js';
import { BaseLayerMenu } from './ui/BaseLayerMenu.js';
import { AirspaceMenu } from './ui/AirspaceMenu.js';
import { BrightnessSlider } from './ui/BrightnessSlider.js';
import { ShapeManager } from './services/drawing/ShapeManager.js';
import { CircleDrawTool } from './services/drawing/CircleDrawTool.js';
import { PolygonDrawTool } from './services/drawing/PolygonDrawTool.js';
import { LineDrawTool } from './services/drawing/LineDrawTool.js';
import { PointDrawTool } from './services/drawing/PointDrawTool.js';
import { ShapePopup } from './ui/plan/ShapePopup.js';
import { PolygonPopup } from './ui/plan/PolygonPopup.js';
import { LinePopup } from './ui/plan/LinePopup.js';
import { PointPopup } from './ui/plan/PointPopup.js';
import { MeasureTool } from './ui/MeasureTool.js';
import { PointSearchTool } from './ui/PointSearchTool.js';
import { ScratchPad } from './ui/ScratchPad.js';
import { ContextMenu } from './ui/ContextMenu.js';
import { DrawShapesPanel } from './ui/plan/DrawShapesPanel.js';
import { PlanPanel } from './ui/plan/PlanPanel.js';
import { StudyPanel } from './ui/study/StudyPanel.js';
import { BoldfacePanel } from './ui/study/BoldfacePanel.js';
import { OpsLimitsPanel } from './ui/study/OpsLimitsPanel.js';

// ── Touch detection ────────────────────────────────────────────
const isTouch = navigator.maxTouchPoints > 0;
if (isTouch) document.body.classList.add('is-touch');

const mapCore = new MapCore();
const map = mapCore.init();

// ── Drawing layer ──────────────────────────────────────────────
const shapeManager = new ShapeManager();
shapeManager.restore(map);

// ── Coordinate services ────────────────────────────────────────
const bottomBar = new BottomBar().mount(document.body);
const coordinateService = new CoordinateService({ statusBar: bottomBar });
const coordinateParser = new CoordinateParser();

// ── Plan UI ────────────────────────────────────────────────────
// Popups and tools depend on each other — use late-binding for circular refs.

const shapePopup = new ShapePopup({ shapeManager, coordinateService, coordinateParser, circleTool: null, map });
shapePopup.mount(document.body);

const polygonPopup = new PolygonPopup({ shapeManager, coordinateService, coordinateParser, polygonTool: null, map });
polygonPopup.mount(document.body);

const circleTool = new CircleDrawTool({ map, shapeManager, shapePopup });
shapePopup._circleTool = circleTool;

const polygonTool = new PolygonDrawTool({ map, shapeManager, polygonPopup });
polygonPopup._polygonTool = polygonTool;

const linePopup = new LinePopup({ shapeManager, coordinateService, coordinateParser, lineTool: null, map });
linePopup.mount(document.body);

const lineTool = new LineDrawTool({ map, shapeManager, linePopup });
linePopup._lineTool = lineTool;

const pointPopup = new PointPopup({ shapeManager, coordinateService, coordinateParser, pointTool: null, map });
pointPopup.mount(document.body);

const pointTool = new PointDrawTool({ map, shapeManager, pointPopup });
pointPopup._pointTool = pointTool;

const drawShapesPanel = new DrawShapesPanel({
  sideMenu: null, shapeManager, coordinateService,
  circleTool, shapePopup,
  polygonTool, polygonPopup,
  lineTool, linePopup,
  pointTool, pointPopup,
});
const planPanel = new PlanPanel({ sideMenu: null, drawShapesPanel });

// ── Study UI ───────────────────────────────────────────────────
const studyPanel = new StudyPanel();
const boldfacePanel = new BoldfacePanel();
const opsLimitsPanel = new OpsLimitsPanel();

// ── Top chrome ─────────────────────────────────────────────────
const sideMenu = new SideMenu({ planPanel, studyPanel }).mount(document.body);

drawShapesPanel._sideMenu = sideMenu;
planPanel._sideMenu = sideMenu;
studyPanel._sideMenu = sideMenu;
studyPanel._boldfacePanel = boldfacePanel;
studyPanel._opsLimitsPanel = opsLimitsPanel;
boldfacePanel._sideMenu = sideMenu;
opsLimitsPanel._sideMenu = sideMenu;

let contextMenu;
new TopBar({
  onHamburger: () => sideMenu.toggle(),
  onInfoMode: () => {
    map.once('click', (e) => {
      contextMenu?.show(e.latlng, e.originalEvent);
    });
  },
}).mount(document.body);

// ── Bottom chrome ──────────────────────────────────────────────
new ScratchPad({ bottomBar });
new PointSearchTool({ map, bottomBar });
const measureTool = new MeasureTool({ map, bottomBar });
contextMenu = new ContextMenu({
  map,
  coordinateService,
  airspaceLayers: mapCore.airspaceLayers,
  measureTool,
  layerManager: mapCore.layerManager,
  pointLayers: [
    { layerId: 'navaids',        layer: mapCore.navaidLayer },
    { layerId: 'ifr-fixes-high', layer: mapCore.fixHighLayer },
    { layerId: 'ifr-fixes-low',  layer: mapCore.fixLowLayer },
  ],
});
new BaseLayerMenu({ mapCore, bottomBar }).mount();
const AIRSPACE_CATEGORIES = [
  {
    label: 'Terminal Area',
    layers: [
      { id: 'airspace-class-b', label: 'Class B' },
      { id: 'airspace-class-c', label: 'Class C' },
      { id: 'airspace-class-d', label: 'Class D' },
      { id: 'airfields',        label: 'Airfields', defaultOn: false },
    ],
  },
  {
    label: 'Working Area',
    layers: [
      { id: 'airspace-moa',        label: 'MOAs' },
      { id: 'airspace-alert',      label: 'Alert Areas' },
      { id: 'airspace-restricted', label: 'Restricted Areas' },
      { id: 'cgrs-grid',           label: 'Kill Box' },
    ],
  },
  {
    label: 'Navigation',
    layers: [
      { id: 'navaids',        label: 'Navaids' },
      { id: 'ifr-fixes-high', label: 'IFR High' },
      { id: 'ifr-fixes-low',  label: 'IFR Low',  defaultOn: false },
    ],
  },
  {
    label: 'Simulated',
    layers: [],
  },
];
new AirspaceMenu({ layerManager: mapCore.layerManager, categories: AIRSPACE_CATEGORIES, bottomBar }).mount();
new BrightnessSlider({ layerManager: mapCore.layerManager, bottomBar }).mount();

// ── Source status indicator ─────────────────────────────────────
const sourceStatusEl = document.createElement('span');
sourceStatusEl.className = 'bottom-bar__source-status';
sourceStatusEl.textContent = 'SOURCES: OK';
bottomBar.addRow2Indicator(sourceStatusEl);

mapCore.onStatusUpdate(({ level, degradedLines }) => {
  sourceStatusEl.className = `bottom-bar__source-status${level !== 'ok' ? ` bottom-bar__source-status--${level}` : ''}`;
  sourceStatusEl.textContent = `SOURCES: ${level.toUpperCase()}`;
  sourceStatusEl.title = degradedLines.length > 0 ? degradedLines.join('\n') : '';
});

// ── Map overlays ───────────────────────────────────────────────
const overlayService = new OverlayService(document.body);
overlayService.createCenterCrosshair();
coordinateService.attachToMap(map);

// ── Airspace data ──────────────────────────────────────────────
mapCore.loadAirspaceData().catch((error) => {
  console.warn('SUA airspace layer failed to load:', error);
});

mapCore.loadClassAirspaceData().catch((error) => {
  console.warn('Class B/C/D airspace failed to load:', error);
});

