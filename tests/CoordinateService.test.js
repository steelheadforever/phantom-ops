import test from 'node:test';
import assert from 'node:assert/strict';
import mgrs from 'mgrs';
import { CoordinateService } from '../src/services/CoordinateService.js';

const statusBarStub = {
  setCoordinate() {},
  onCoordinateClick() {},
};

test('MGRS outputs 10-digit precision (1m)', () => {
  const svc = new CoordinateService({ statusBar: statusBarStub, mgrsLib: mgrs });
  const out = svc.formatCoordinate(38.8977, -77.0365, 'MGRS');

  const parts = out.split(' ');
  const grid = parts[2];
  assert.equal(grid.length, 10);
});

test('DMM outputs 4 decimal places for minutes with hemisphere notation', () => {
  const svc = new CoordinateService({ statusBar: statusBarStub, mgrsLib: mgrs });
  const out = svc.formatCoordinate(38.8977, -77.0365, 'DMM');

  assert.match(out, /\d+° \d+\.\d{4}' [NS] \d+° \d+\.\d{4}' [EW]/);
});

test('DMS outputs 2 decimal places for seconds with hemisphere notation', () => {
  const svc = new CoordinateService({ statusBar: statusBarStub, mgrsLib: mgrs });
  const out = svc.formatCoordinate(38.8977, -77.0365, 'DMS');

  assert.match(out, /\d+° \d+' \d+\.\d{2}" [NS] \d+° \d+' \d+\.\d{2}" [EW]/);
});
