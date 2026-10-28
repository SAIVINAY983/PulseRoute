/**
 * PulseRoute transparent priority-scoring demo.
 * This is a deterministic, rule-based simulation, not a trained AI model.
 * Never connect this demo logic directly to real traffic-signal infrastructure.
 */
const SEVERITY_POINTS = { Critical: 40, High: 28, Moderate: 16 };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function minutesFromEta(eta) {
  const match = String(eta ?? '').match(/[\d.]+/);
  return match ? Number(match[0]) : 10;
}
function kmFromDistance(distance) {
  const match = String(distance ?? '').match(/[\d.]+/);
  return match ? Number(match[0]) : 5;
}
function distanceBetween(a, b) {
  return Math.hypot((a.x ?? 50) - (b.x ?? 50), (a.y ?? 50) - (b.y ?? 50));
}
function nearestSignal(ambulance, signals) {
  return [...signals].sort((a, b) => distanceBetween(ambulance, a) - distanceBetween(ambulance, b))[0] ?? null;
}

export function scoreAmbulance(ambulance, ambulances, signals) {
  const severityPoints = SEVERITY_POINTS[ambulance.severity] ?? 8;
  const etaPoints = clamp(Math.round(25 - minutesFromEta(ambulance.eta) * 2.5), 0, 25);
  const distancePoints = clamp(Math.round(15 - kmFromDistance(ambulance.distance) * 2), 0, 15);
  const waitingPoints = ['Awaiting priority', 'En route', 'Approaching'].includes(ambulance.status) ? 10 : 0;
  const targetSignal = nearestSignal(ambulance, signals);
  const competing = targetSignal
    ? ambulances.filter(other => other.id !== ambulance.id &&
      nearestSignal(other, signals)?.id === targetSignal.id &&
      distanceBetween(other, ambulance) < 24 &&
      !['Completed', 'Priority granted'].includes(other.status))
    : [];
  const conflictPenalty = Math.min(15, competing.length * 7);
  const readinessPoints = targetSignal && targetSignal.state !== 'Recovery phase' ? 10 : 4;
  const rawScore = severityPoints + etaPoints + distancePoints + waitingPoints + readinessPoints - conflictPenalty;
  const score = clamp(Math.round(rawScore), 0, 100);
  return {
    ...ambulance,
    score,
    targetSignalId: targetSignal?.id ?? null,
    conflictCount: competing.length,
    conflictPenalty,
    scoreBreakdown: {
      severity: severityPoints,
      eta: etaPoints,
      distance: distancePoints,
      waiting: waitingPoints,
      signalReadiness: readinessPoints,
      conflictPenalty,
    },
  };
}

export function rankAmbulances(ambulances, signals) {
  return ambulances
    .filter(a => a.status !== 'Completed')
    .map(a => scoreAmbulance(a, ambulances, signals))
    .sort((a, b) => b.score - a.score || minutesFromEta(a.eta) - minutesFromEta(b.eta));
}

export function getRouteConflicts(ambulances, signals) {
  const ranked = rankAmbulances(ambulances, signals);
  const active = ranked.filter(a => a.status === 'Priority granted');
  return ranked.filter(a => a.conflictCount > 0 || active.some(current =>
    current.id !== a.id && current.targetSignalId === a.targetSignalId && distanceBetween(current, a) < 24));
}

export function recommendPriority(ambulances, signals) {
  return rankAmbulances(ambulances, signals)
    .find(a => !['Completed', 'Priority granted'].includes(a.status)) ?? null;
}
