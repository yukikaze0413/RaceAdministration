"use strict";
// Add a rule only after its HTTP/runtime/UI acceptance is verified.
const versions = new Set([
  "single-cut-v2",
  "gsl-classic-v1",
  "de-standard-v1",
  "de-lower-entry-v1",
  "swiss-fixed-v1",
  "swiss-threshold-v1",
  "major-cologne-2026-v1",
  "round-robin-v2",
  "double-round-robin-v2",
]);
const runtimeSupported = (version) => versions.has(version);
module.exports = { runtimeSupported };
