import test from 'node:test';
import assert from 'node:assert/strict';

// Helper replicate functions based on server/index.js logic to test workflow integrity rules in isolation
function checkCompletedProtection(existingStatus, newStatus) {
  if (existingStatus === 'Completed' && ['Assigned', 'En Route', 'Priority granted'].includes(newStatus)) {
    return 'Ambulance trip is Completed. Reset to Available before reassigning to a new dispatch.';
  }
  return null;
}

function checkClearanceEnforcement(existingSignal, nextState, nextStage) {
  if (existingSignal.state === 'Priority green' && nextState === 'Normal cycle' && nextStage !== 'idle' && existingSignal.recoveryStage !== 'clearance') {
    return 'Traffic recovery cannot bypass Stage 1 clearance check. Initiate clearance check before restoring normal adaptive timing.';
  }
  return null;
}

function isDuplicateEvent(existingEvents, message, type, windowMs = 6000) {
  const now = Date.now();
  return existingEvents.some(e => e.message === message && e.type === type && (now - new Date(e.createdAt).getTime()) < windowMs);
}

function calculateFleetAnalytics(ambulances = [], signals = [], events = []) {
  const totalAmbulances = ambulances.length;
  const activeAmbulances = ambulances.filter(a => ['Assigned', 'En Route', 'En route', 'At Scene', 'At scene', 'Priority granted'].includes(a.status));
  const completedAmbulances = ambulances.filter(a => a.status === 'Completed');
  const availableAmbulances = ambulances.filter(a => a.status === 'Available');

  const validEtas = ambulances.map(a => {
    const m = String(a.eta || '').match(/[\d.]+/);
    return m ? parseFloat(m[0]) : null;
  }).filter(n => n !== null);

  const avgResponseTime = validEtas.length ? (validEtas.reduce((acc, v) => acc + v, 0) / validEtas.length).toFixed(1) : '7.4';
  const utilizationRate = totalAmbulances > 0 ? Math.round((activeAmbulances.length / totalAmbulances) * 100) : 0;

  return {
    totalAmbulances,
    activeCount: activeAmbulances.length,
    availableCount: availableAmbulances.length,
    completedCount: completedAmbulances.length,
    utilizationRate,
    avgResponseTimeMinutes: parseFloat(avgResponseTime),
    totalSignals: signals.length,
    totalEvents: events.length
  };
}

test('Workflow Integrity - Completed Trip Protection', () => {
  // A completed trip must not be re-assigned directly
  const err1 = checkCompletedProtection('Completed', 'Assigned');
  assert.ok(err1 !== null, 'Reassigning a Completed trip directly to Assigned must be rejected');

  const err2 = checkCompletedProtection('Completed', 'En Route');
  assert.ok(err2 !== null, 'Reassigning a Completed trip directly to En Route must be rejected');

  // Must allow resetting to Available
  const validReset = checkCompletedProtection('Completed', 'Available');
  assert.equal(validReset, null, 'Resetting a Completed trip to Available is permitted');

  // Normal progression from Available to Assigned
  const normalTransition = checkCompletedProtection('Available', 'Assigned');
  assert.equal(normalTransition, null, 'Transition from Available to Assigned is permitted');
});

test('Workflow Integrity - Two-Stage Traffic Clearance Confirmation', () => {
  const prioritySignal = {
    id: 'SIG-01',
    state: 'Priority green',
    recoveryStage: 'idle'
  };

  // Attempting to jump directly from 'Priority green' to 'Normal cycle' without clearance check
  const bypassAttempt = checkClearanceEnforcement(prioritySignal, 'Normal cycle', 'active');
  assert.ok(bypassAttempt !== null, 'Direct jump to Normal cycle without clearance check must be blocked');

  // Correct Stage 1: transition to Recovery phase with recoveryStage = 'clearance'
  const stage1Permitted = checkClearanceEnforcement(prioritySignal, 'Recovery phase', 'clearance');
  assert.equal(stage1Permitted, null, 'Transitioning to Recovery phase for clearance check must be permitted');

  // Correct Stage 2: once signal is in clearance phase, restoring to Normal cycle is permitted
  const clearingSignal = { id: 'SIG-01', state: 'Recovery phase', recoveryStage: 'clearance' };
  const restorePermitted = checkClearanceEnforcement(clearingSignal, 'Normal cycle', 'idle');
  assert.equal(restorePermitted, null, 'Restoring normal cycle after clearance check confirmation must be permitted');
});

test('Workflow Integrity - Idempotent Event Deduplication', () => {
  const now = new Date();
  const pastEvents = [
    { id: 1, message: 'Priority corridor activated for AMB-104', type: 'priority', createdAt: new Date(now.getTime() - 2000) },
    { id: 2, message: 'Initial fleet loaded', type: 'system', createdAt: new Date(now.getTime() - 15000) }
  ];

  // Identical message within 2 seconds (< 6000ms window)
  const isDup = isDuplicateEvent(pastEvents, 'Priority corridor activated for AMB-104', 'priority');
  assert.equal(isDup, true, 'Event within 6000ms window must be flagged as duplicate to prevent log spamming');

  // Different message within window
  const isDifferent = isDuplicateEvent(pastEvents, 'AMB-104 arrived at scene', 'status');
  assert.equal(isDifferent, false, 'New distinct event message must not be flagged as duplicate');

  // Identical message older than 6000ms window (e.g. 15s ago)
  const isOldMessage = isDuplicateEvent(pastEvents, 'Initial fleet loaded', 'system');
  assert.equal(isOldMessage, false, 'Event outside sliding window must be allowed');
});

test('Workflow Integrity - Stored Data Analytics Accuracy', () => {
  const fleet = [
    { id: 'U1', status: 'Assigned', eta: '05 min' },
    { id: 'U2', status: 'En Route', eta: '10 min' },
    { id: 'U3', status: 'Available', eta: '15 min' },
    { id: 'U4', status: 'Completed', eta: '00 min' }
  ];
  const signals = [{ id: 'S1' }, { id: 'S2' }];
  const events = [{ id: 1 }, { id: 2 }, { id: 3 }];

  const analytics = calculateFleetAnalytics(fleet, signals, events);

  assert.equal(analytics.totalAmbulances, 4);
  assert.equal(analytics.activeCount, 2, 'Active count must be precisely 2 (Assigned + En Route)');
  assert.equal(analytics.availableCount, 1);
  assert.equal(analytics.completedCount, 1);
  assert.equal(analytics.utilizationRate, 50, '2 out of 4 units active = 50% utilization rate');
  assert.equal(analytics.avgResponseTimeMinutes, 7.5, '(5 + 10 + 15 + 0) / 4 = 7.5 min average');
  assert.equal(analytics.totalSignals, 2);
  assert.equal(analytics.totalEvents, 3);
});
