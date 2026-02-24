import { MapCore, AIRSPACE_LAYER_DEFS, CGRS_LAYER_DEF, NAVAID_LAYER_DEF, FIX_HIGH_LAYER_DEF, FIX_LOW_LAYER_DEF } from './map/MapCore.js';
import { OverlayService } from './ui/OverlayService.js';
import { CoordinateService } from './services/CoordinateService.js';
import { TopBar } from './ui/TopBar.js';
import { SideMenu } from './ui/SideMenu.js';
import { BottomBar } from './ui/BottomBar.js';
import { BaseLayerMenu } from './ui/BaseLayerMenu.js';
import { AirspaceMenu } from './ui/AirspaceMenu.js';
import { BrightnessSlider } from './ui/BrightnessSlider.js';
import { StudyPanel } from './ui/study/StudyPanel.js';
import { BoldfacePanel } from './ui/study/BoldfacePanel.js';

const mapCore = new MapCore();
const map = mapCore.init();

// Study sub-panels (constructed before SideMenu so late bindings can be set)
const studyPanel = new StudyPanel();
const boldfacePanel = new BoldfacePanel();

// Top chrome
const sideMenu = new SideMenu({ studyPanel }).mount(document.body);
new TopBar({ onHamburger: () => sideMenu.toggle() }).mount(document.body);

// Late-bind sideMenu references into panels
studyPanel._sideMenu = sideMenu;
studyPanel._boldfacePanel = boldfacePanel;
boldfacePanel._sideMenu = sideMenu;

// Bottom chrome
const bottomBar = new BottomBar().mount(document.body);
new BaseLayerMenu({ mapCore, bottomBar }).mount();
new AirspaceMenu({ layerManager: mapCore.layerManager, airspaceLayerDefs: [CGRS_LAYER_DEF, NAVAID_LAYER_DEF, FIX_HIGH_LAYER_DEF, FIX_LOW_LAYER_DEF, ...AIRSPACE_LAYER_DEFS], bottomBar }).mount();
new BrightnessSlider({ layerManager: mapCore.layerManager, bottomBar }).mount();

// Center crosshair & coordinate display
const overlayService = new OverlayService(document.body);
overlayService.createCenterCrosshair();
const coordinateService = new CoordinateService({ statusBar: bottomBar });
coordinateService.attachToMap(map);

// Airspace data
mapCore.loadAirspaceData().catch((error) => {
  console.warn('SUA airspace layer failed to load:', error);
});

mapCore.loadClassAirspaceData().catch((error) => {
  console.warn('Class B/C/D airspace failed to load:', error);
});
