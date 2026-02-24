import { MapCore, AIRSPACE_LAYER_DEFS, CGRS_LAYER_DEF, NAVAID_LAYER_DEF, FIX_HIGH_LAYER_DEF, FIX_LOW_LAYER_DEF } from './map/MapCore.js';
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
import { ShapePopup } from './ui/plan/ShapePopup.js';
import { DrawShapesPanel } from './ui/plan/DrawShapesPanel.js';
import { PlanPanel } from './ui/plan/PlanPanel.js';

const mapCore = new MapCore();
const map = mapCore.init();

// ── Drawing layer ──────────────────────────────────────────────
const shapeManager = new ShapeManager();
shapeManager.restore(map);

// ── Coordinate services ────────────────────────────────────────
const bottomBar = new BottomBar().mount(document.body);
const coordinateService = new CoordinateService({ statusBar: bottomBar });
const coordinateParser = new CoordinateParser();

// ── Plan UI (built before SideMenu so it can be passed in) ────
// ShapePopup and CircleDrawTool depend on each other; use late-binding
const shapePopup = new ShapePopup({ shapeManager, coordinateService, coordinateParser, circleTool: null, map });
shapePopup.mount(document.body);

const circleTool = new CircleDrawTool({ map, shapeManager, shapePopup });
// Wire the popup ↔ tool reference
shapePopup._circleTool = circleTool;

const drawShapesPanel = new DrawShapesPanel({ sideMenu: null, shapeManager, coordinateService, circleTool, shapePopup });
const planPanel = new PlanPanel({ sideMenu: null, drawShapesPanel });

// ── Top chrome ─────────────────────────────────────────────────
const sideMenu = new SideMenu({ planPanel }).mount(document.body);

// Patch panels with sideMenu reference now that it exists
drawShapesPanel._sideMenu = sideMenu;
planPanel._sideMenu = sideMenu;

new TopBar({ onHamburger: () => sideMenu.toggle() }).mount(document.body);

// ── Bottom chrome ──────────────────────────────────────────────
new BaseLayerMenu({ mapCore, bottomBar }).mount();
new AirspaceMenu({ layerManager: mapCore.layerManager, airspaceLayerDefs: [CGRS_LAYER_DEF, NAVAID_LAYER_DEF, FIX_HIGH_LAYER_DEF, FIX_LOW_LAYER_DEF, ...AIRSPACE_LAYER_DEFS], bottomBar }).mount();
new BrightnessSlider({ layerManager: mapCore.layerManager, bottomBar }).mount();

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
