// ONE place for every weight and threshold of the rule-based engine.
// Change a number here, redeploy the two functions, and the whole agent follows.

export const PRIORITY_CONFIG = {
  // The score is capped at this value.
  maxScore: 100,

  // Points added when a factor fires.
  points: {
    missedConnection: 40, // new arrival is after the connection departs
    bufferUnder60: 30, // buffer shorter than thresholds.bufferTightMinutes
    buffer60to120: 15, // buffer between the two buffer thresholds (inclusive)
    connectionType: { flight: 20, train: 15, bus: 8 } as Record<string, number>,
    cancelled: 20, // the flight is cancelled
    delayOver180: 15, // delay longer than thresholds.delayLongMinutes
    delay60to180: 10, // delay from thresholds.delayMediumMinutes up to delayLongMinutes
    latestArrivalBreach: 15, // new arrival is after the passenger's latest acceptable arrival
  },

  thresholds: {
    bufferTightMinutes: 60,
    bufferModerateMinutes: 120,
    delayLongMinutes: 180,
    delayMediumMinutes: 60,
  },

  // Level cut-offs: High >= high, Medium >= medium, otherwise Low.
  levels: { high: 70, medium: 40 },
}

export const RANKING_CONFIG = {
  // How many options are shown to the passenger.
  topN: 3,

  // Weights of the ranking score (they are normalised, so they need not sum to 1).
  weights: {
    arrival: 0.5, // earlier arrival is better
    price: 0.3, // cheaper is better
    preferredMode: 0.2, // mode is one the passenger prefers
  },

  // "Only N seats left" tag threshold (display only).
  lowSeatsThreshold: 5,

  // Minutes needed after landing to reach the hub of the next service.
  landingBufferMinutes: { flight: 30, other: 60 },
}