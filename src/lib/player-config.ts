/** Start with one second, then build a larger cushion once frames are playing. */
export const STARTUP_STREAMING = {
  bufferingGoal: 12,
  rebufferingGoal: 1,
  bufferBehind: 20,
  segmentPrefetchLimit: 1,
  lowLatencyMode: false,
  inaccurateManifestTolerance: 2,
  stallEnabled: true,
  stallThreshold: 1,
  stallSkip: 0.1,
  retryParameters: {
    maxAttempts: 4,
    baseDelay: 250,
    backoffFactor: 1.5,
    timeout: 10000,
    stallTimeout: 5000,
  },
};

export const STEADY_STREAMING = {
  bufferingGoal: 20,
  rebufferingGoal: 4,
  segmentPrefetchLimit: 2,
};

/** Seconds behind the live edge to start playback at — close to live, but with a small safety cushion. */
export const LIVE_EDGE_OFFSET = 4;

/** If playback falls more than this many seconds behind the live edge while playing, snap back to live. */
export const RESYNC_BEHIND_SECONDS = 30;

export const STARTUP_ABR = {
  enabled: true,
  defaultBandwidthEstimate: 750_000,
  switchInterval: 4,
  bandwidthDowngradeTarget: 0.9,
  bandwidthUpgradeTarget: 0.8,
  restrictToElementSize: true,
};