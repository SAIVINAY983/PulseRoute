/**
 * PulseRoute Advanced Deterministic Priority Engine
 * 
 * Transparent, explainable rule-based scoring algorithm.
 * Not a black-box AI model or machine-learning neural net.
 * All computations are mathematically deterministic and auditable.
 */

export const DEFAULT_WEIGHTS = {
  severityMax: 40,
  etaMax: 25,
  distanceMax: 15,
  waitingMax: 10,
  readinessMax: 10,
  maxConflictPenalty: 16
};

const SEVERITY_SCORES = {
  Critical: 40,
  High: 28,
  Medium: 18,
  Moderate: 18,
  Low: 8
};

const SEVERITY_RANKS = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Moderate: 2,
  Low: 1
};

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function parseMinutes(eta) {
  const match = String(eta ?? '').match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 8;
}

export function parseKilometers(distance) {
  const match = String(distance ?? '').match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 4;
}

export function distanceBetween(a, b) {
  return Math.hypot((a.x ?? 50) - (b.x ?? 50), (a.y ?? 50) - (b.y ?? 50));
}

export function findNearestSignal(ambulance, signals = []) {
  if (!signals || signals.length === 0) return null;
  return [...signals].sort((a, b) => distanceBetween(ambulance, a) - distanceBetween(ambulance, b))[0] ?? null;
}

/**
 * Computes an objective 100-point priority score with factor explanations.
 */
export function scoreAmbulance(ambulance, allAmbulances = [], signals = [], customWeights = {}) {
  const weights = { ...DEFAULT_WEIGHTS, ...customWeights };

  // 1. Severity points (Max 40)
  const severityPoints = SEVERITY_SCORES[ambulance.severity] ?? 14;

  // 2. ETA points (Max 25): Shorter response time = higher urgency
  const etaMinutes = parseMinutes(ambulance.eta);
  const etaPoints = clamp(Math.round(weights.etaMax - etaMinutes * 2.2), 2, weights.etaMax);

  // 3. Distance points (Max 15): Proximity to intersection / incident
  const km = parseKilometers(ambulance.distance);
  const distancePoints = clamp(Math.round(weights.distanceMax - km * 1.6), 1, weights.distanceMax);

  // 4. Waiting time points (Max 10): Queue duration priority boost
  const waitMins = Number(ambulance.waitingTime) || (['Assigned', 'Awaiting priority'].includes(ambulance.status) ? 5 : 2);
  const waitingPoints = clamp(Math.round(waitMins * 1.5), 0, weights.waitingMax);

  // 5. Signal readiness points (Max 10): Safe corridor clearance transition
  const targetSignal = findNearestSignal(ambulance, signals);
  let readinessPoints = 7;
  let readinessReason = 'Signal in standard operational cycle';
  if (targetSignal) {
    if (targetSignal.state === 'Priority green') {
      readinessPoints = 10;
      readinessReason = 'Corridor priority phase already open';
    } else if (targetSignal.state === 'Recovery phase') {
      readinessPoints = 4;
      readinessReason = 'Intersection currently in clearance phase';
    } else if (targetSignal.light === 'green') {
      readinessPoints = 9;
      readinessReason = 'Green phase alignment facilitates preemption';
    } else {
      readinessPoints = 6;
      readinessReason = 'Red phase hold requires standard preemption cycle';
    }
  }

  // 6. Corridor conflict penalty (Up to -16 pts)
  const competing = targetSignal
    ? allAmbulances.filter(other =>
        other.id !== ambulance.id &&
        !['Completed', 'Available'].includes(other.status) &&
        findNearestSignal(other, signals)?.id === targetSignal.id &&
        distanceBetween(other, ambulance) < 26
      )
    : [];

  const conflictPenalty = Math.min(weights.maxConflictPenalty, competing.length * 8);

  // Total deterministic calculation
  const totalRaw = severityPoints + etaPoints + distancePoints + waitingPoints + readinessPoints - conflictPenalty;
  const score = clamp(Math.round(totalRaw), 0, 100);

  const hasConflict = competing.length > 0;
  const conflictWarning = hasConflict
    ? `Corridor conflict detected: ${competing.map(c => c.id).join(', ')} approaching ${targetSignal?.name || 'same intersection'}`
    : null;

  return {
    ...ambulance,
    score,
    targetSignalId: targetSignal?.id ?? null,
    targetSignalName: targetSignal?.name ?? 'Nearest Intersection',
    competingCount: competing.length,
    competingUnits: competing.map(c => c.id),
    hasConflict,
    conflictWarning,
    scoreBreakdown: {
      severity: {
        points: severityPoints,
        max: weights.severityMax,
        label: 'Clinical Severity',
        desc: `${ambulance.severity} priority weight`
      },
      eta: {
        points: etaPoints,
        max: weights.etaMax,
        label: 'ETA Urgency',
        desc: `${etaMinutes} min to destination corridor`
      },
      distance: {
        points: distancePoints,
        max: weights.distanceMax,
        label: 'Proximity Distance',
        desc: `${km.toFixed(1)} km road distance`
      },
      waiting: {
        points: waitingPoints,
        max: weights.waitingMax,
        label: 'Queue Waiting Time',
        desc: `${waitMins} min pending in dispatch queue`
      },
      readiness: {
        points: readinessPoints,
        max: weights.readinessMax,
        label: 'Signal Readiness',
        desc: readinessReason
      },
      conflictPenalty: {
        points: -conflictPenalty,
        max: 0,
        label: 'Route Conflict Penalty',
        desc: competing.length ? `${competing.length} competing vehicle(s) in proximity` : 'Clear corridor with no competing units'
      }
    }
  };
}

/**
 * Deterministic tie-breaking comparator:
 * 1. Score descending
 * 2. Clinical Severity rank descending
 * 3. ETA minutes ascending
 * 4. Distance km ascending
 * 5. Unit ID alphabetically
 */
export function rankAmbulances(ambulances = [], signals = [], customWeights = {}) {
  return ambulances
    .filter(a => a.status !== 'Completed')
    .map(a => scoreAmbulance(a, ambulances, signals, customWeights))
    .sort((a, b) => {
      // 1. Total score
      if (b.score !== a.score) return b.score - a.score;
      // 2. Severity rank
      const sevA = SEVERITY_RANKS[a.severity] || 0;
      const sevB = SEVERITY_RANKS[b.severity] || 0;
      if (sevB !== sevA) return sevB - sevA;
      // 3. ETA ascending
      const etaA = parseMinutes(a.eta);
      const etaB = parseMinutes(b.eta);
      if (etaA !== etaB) return etaA - etaB;
      // 4. Distance ascending
      const distA = parseKilometers(a.distance);
      const distB = parseKilometers(b.distance);
      if (distA !== distB) return distA - distB;
      // 5. Alphabetical tie-break
      return a.id.localeCompare(b.id);
    });
}

/**
 * Detects all active route and corridor conflicts across the network.
 */
export function getRouteConflicts(ambulances = [], signals = []) {
  const scored = ambulances
    .filter(a => a.status !== 'Completed' && a.status !== 'Available')
    .map(a => scoreAmbulance(a, ambulances, signals));

  const conflicts = [];
  const activeCorridorUnits = scored.filter(a => a.status === 'Priority granted');

  for (const unit of scored) {
    if (unit.hasConflict) {
      conflicts.push({
        ambulanceId: unit.id,
        ambulanceName: unit.name,
        severity: unit.severity,
        score: unit.score,
        targetSignalId: unit.targetSignalId,
        targetSignalName: unit.targetSignalName,
        competingIds: unit.competingUnits,
        hazardLevel: unit.severity === 'Critical' ? 'High' : 'Moderate',
        description: `Shares ${unit.targetSignalName || unit.targetSignalId} with ${unit.competingUnits.join(', ')}`
      });
    } else if (activeCorridorUnits.some(act => act.id !== unit.id && act.targetSignalId === unit.targetSignalId)) {
      conflicts.push({
        ambulanceId: unit.id,
        ambulanceName: unit.name,
        severity: unit.severity,
        score: unit.score,
        targetSignalId: unit.targetSignalId,
        targetSignalName: unit.targetSignalName,
        competingIds: activeCorridorUnits.filter(act => act.targetSignalId === unit.targetSignalId).map(act => act.id),
        hazardLevel: 'Critical',
        description: `Approaching signal ${unit.targetSignalId} where emergency priority corridor is already active`
      });
    }
  }

  return conflicts;
}

/**
 * Recommends the optimal next ambulance to receive priority green corridor.
 */
export function recommendPriority(ambulances = [], signals = []) {
  const ranked = rankAmbulances(ambulances, signals);
  return ranked.find(a => !['Completed', 'Available', 'Priority granted'].includes(a.status)) ?? null;
}
