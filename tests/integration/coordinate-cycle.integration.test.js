import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import mgrs from 'mgrs';
import { StatusBar } from '../../src/ui/StatusBar.js';
import { CoordinateService } from '../../src/services/CoordinateService.js';

test('Coordinate click cycles deterministically MGRS -> DMS -> DMM -> MGRS', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  global.document = dom.window.document;

  const statusBar = new StatusBar(document.body).render('--');
  const svc = new CoordinateService({ statusBar, mgrsLib: mgrs });
  svc.currentLatLng = { lat: 38.8977, lng: -77.0365 };

  assert.equal(svc.getCurrentFormat(), 'MGRS');

  svc.attachToMap({ on() {} });

  statusBar.coordinateEl.click();
  assert.equal(svc.getCurrentFormat(), 'DMS');

  statusBar.coordinateEl.click();
  assert.equal(svc.getCurrentFormat(), 'DMM');

  statusBar.coordinateEl.click();
  assert.equal(svc.getCurrentFormat(), 'MGRS');

  delete global.document;
});
