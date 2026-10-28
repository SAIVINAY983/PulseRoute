import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scoreAmbulance,
  rankAmbulances,
  recommendPriority,
  getRouteConflicts,
  clamp,
  parseMinutes,
  parseKilometers,
  DEFAULT_WEIGHTS
} from '../src/priorityEngine.js';

test('Priority Engine - Deterministic Scoring Consistency', () => {
  const sampleAmbulance = {
    id: 'AMB-TEST-1',
    name: 'Unit T1',
    severity: 'Critical',
    patient: 'Severe cardiac arrest',
    eta: '04 min',
    distance: '2.1 km',
    speed: '45 km/h',
    route: 'Avenue A → Hospital 1',
    destination: 'Hospital 1',
    status: 'En Route',
    waitingTime: 3,
    x: 25,
    y: 50
  };

  const signals = [
    { id: 'SIG-01', name: 'Main & 1st', state: 'Priority green', light: 'green', x: 28, y: 52 }
  ];

  // Run calculation multiple times
  const result1 = scoreAmbulance(sampleAmbulance, [sampleAmbulance], signals);
  const result2 = scoreAmbulance(sampleAmbulance, [sampleAmbulance], signals);
  const result3 = scoreAmbulance(sampleAmbulance, [sampleAmbulance], signals);

  // Assert exact mathematical determinism
  assert.equal(result1.score, result2.score, 'Scoring must be strictly deterministic across iterations');
  assert.equal(result2.score, result3.score, 'Scoring must not vary with call order or environment time');
  assert.deepEqual(result1.scoreBreakdown, result2.scoreBreakdown, 'Breakdown points must match identically');
  assert.ok(result1.score >= 0 && result1.score <= 100, 'Score must fall within [0, 100]');
});

test('Priority Engine - Clinical Severity Point Weightings', () => {
  const base = {
    id: 'AMB-X',
    eta: '10 min',
    distance: '5 km',
    status: 'Assigned',
    waitingTime: 0,
    x: 50,
    y: 50
  };

  const critical = scoreAmbulance({ ...base, severity: 'Critical' }, [], []);
  const high = scoreAmbulance({ ...base, severity: 'High' }, [], []);
  const medium = scoreAmbulance({ ...base, severity: 'Medium' }, [], []);
  const low = scoreAmbulance({ ...base, severity: 'Low' }, [], []);

  assert.equal(critical.scoreBreakdown.severity.points, 40, 'Critical severity must award 40 points');
  assert.equal(high.scoreBreakdown.severity.points, 28, 'High severity must award 28 points');
  assert.equal(medium.scoreBreakdown.severity.points, 18, 'Medium severity must award 18 points');
  assert.equal(low.scoreBreakdown.severity.points, 8, 'Low severity must award 8 points');

  assert.ok(critical.score > high.score, 'Critical score must exceed High score given identical metrics');
  assert.ok(high.score > medium.score, 'High score must exceed Medium score given identical metrics');
  assert.ok(medium.score > low.score, 'Medium score must exceed Low score given identical metrics');
});

test('Priority Engine - 5-Tier Tie-Breaking Rules', () => {
  // Case 1: Identical score, different severity rank
  const unitA = { id: 'AMB-A', severity: 'Critical', eta: '10 min', distance: '6.0 km', waitingTime: 0, status: 'Assigned', x: 50, y: 50 };
  const unitB = { id: 'AMB-B', severity: 'High', eta: '02 min', distance: '1.0 km', waitingTime: 5, status: 'Assigned', x: 50, y: 50 };
  
  // Custom weights crafted to produce matching scores if needed, or testing rank order
  const ranked = rankAmbulances([unitB, unitA], []);
  assert.ok(ranked.length === 2, 'Must rank both active units');

  // Case 2: Identical scores & severity, different ETA
  const unit1 = { id: 'AMB-01', severity: 'High', eta: '08 min', distance: '4 km', waitingTime: 2, status: 'En Route', x: 10, y: 10 };
  const unit2 = { id: 'AMB-02', severity: 'High', eta: '04 min', distance: '4 km', waitingTime: 2, status: 'En Route', x: 10, y: 10 };
  const rankedEta = rankAmbulances([unit1, unit2], []);
  assert.equal(rankedEta[0].id, 'AMB-02', 'Shorter ETA unit must rank higher when severity is identical');

  // Case 3: Identical score, severity, and ETA, different distance
  const unit3 = { id: 'AMB-03', severity: 'Medium', eta: '05 min', distance: '5.0 km', waitingTime: 1, status: 'En Route', x: 20, y: 20 };
  const unit4 = { id: 'AMB-04', severity: 'Medium', eta: '05 min', distance: '2.0 km', waitingTime: 1, status: 'En Route', x: 20, y: 20 };
  const rankedDist = rankAmbulances([unit3, unit4], []);
  assert.equal(rankedDist[0].id, 'AMB-04', 'Closer distance unit must rank higher when ETA and severity are identical');

  // Case 4: Identical in all metrics, alphabetical fallback tie-breaker
  const unitAlpha = { id: 'AMB-100', severity: 'Low', eta: '10 min', distance: '5 km', waitingTime: 0, status: 'Assigned', x: 30, y: 30 };
  const unitBeta = { id: 'AMB-200', severity: 'Low', eta: '10 min', distance: '5 km', waitingTime: 0, status: 'Assigned', x: 30, y: 30 };
  const rankedAlpha = rankAmbulances([unitBeta, unitAlpha], []);
  assert.equal(rankedAlpha[0].id, 'AMB-100', 'Alphabetical ID tie-breaker must resolve identical scores deterministically');
});

test('Priority Engine - Corridor Proximity & Conflict Penalty', () => {
  const signal = { id: 'SIG-INT-1', name: 'Central Junction', state: 'Normal cycle', light: 'green', x: 50, y: 50 };
  const unitNear1 = { id: 'AMB-C1', severity: 'High', eta: '03 min', distance: '1.2 km', status: 'En Route', waitingTime: 2, x: 48, y: 51 };
  const unitNear2 = { id: 'AMB-C2', severity: 'High', eta: '03 min', distance: '1.4 km', status: 'En Route', waitingTime: 2, x: 52, y: 49 };

  const scored1 = scoreAmbulance(unitNear1, [unitNear1, unitNear2], [signal]);
  assert.equal(scored1.competingCount, 1, 'Should detect 1 competing unit in proximity');
  assert.ok(scored1.hasConflict, 'Conflict flag must be true');
  assert.ok(scored1.scoreBreakdown.conflictPenalty.points < 0, 'Conflict penalty must deduct points');

  const conflicts = getRouteConflicts([unitNear1, unitNear2], [signal]);
  assert.ok(conflicts.length >= 1, 'Conflict detector must record competing corridor hazard');
});

test('Priority Engine - Priority Recommendation Filtering', () => {
  const units = [
    { id: 'AMB-COMP', severity: 'Critical', status: 'Completed', eta: '00 min', distance: '0 km', x: 10, y: 10 },
    { id: 'AMB-AVAIL', severity: 'Critical', status: 'Available', eta: '10 min', distance: '5 km', x: 10, y: 10 },
    { id: 'AMB-ACTIVE', severity: 'High', status: 'Assigned', eta: '05 min', distance: '2 km', waitingTime: 3, x: 20, y: 20 },
    { id: 'AMB-LOWER', severity: 'Low', status: 'En Route', eta: '12 min', distance: '6 km', waitingTime: 0, x: 30, y: 30 }
  ];

  const rec = recommendPriority(units, []);
  assert.ok(rec !== null, 'Should return a recommended unit');
  assert.equal(rec.id, 'AMB-ACTIVE', 'Completed and Available units must be excluded from priority recommendation');
});

test('Priority Engine - Utility Parsers and Clamping', () => {
  assert.equal(clamp(-10, 0, 100), 0);
  assert.equal(clamp(150, 0, 100), 100);
  assert.equal(clamp(45, 0, 100), 45);

  assert.equal(parseMinutes('04 min'), 4);
  assert.equal(parseMinutes('12.5 minutes'), 12.5);
  assert.equal(parseMinutes(null), 8);

  assert.equal(parseKilometers('3.8 km'), 3.8);
  assert.equal(parseKilometers('10.2 kilometers'), 10.2);
  assert.equal(parseKilometers(undefined), 4);
});
