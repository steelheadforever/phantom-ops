import { MapCore } from './map/MapCore.js';
import { OverlayService } from './ui/OverlayService.js';
import { CoordinateService } from './services/CoordinateService.js';

const mapCore = new MapCore();
const map = mapCore.init();
mapCore.setupDimmer();

const overlayService = new OverlayService(document.body);
overlayService.createCenterCrosshair();
const statusBar = overlayService.createStatusBar();

const coordinateService = new CoordinateService({ statusBar });
coordinateService.attachToMap(map);
