"use strict";
function part(value) {
  return encodeURIComponent(JSON.stringify(String(value))).slice(3, -3);
}
function belongsToGroup(key, configurationId, groupId) {
  return (
    typeof key === "string" &&
    key.startsWith(
      "plan-v2/" + part(configurationId) + "/" + part(groupId) + "/",
    )
  );
}
function inputKey(unit, channel) {
  return unit.unitKey + "/input/" + channel;
}
function outputKey(unit, output) {
  return unit.unitKey + "/output/" + output.channel + "/" + output.index;
}
function graphNodeIds(configuration, runtime) {
  const ids = new Set(
    [
      ...configuration.stages,
      ...configuration.stages.flatMap((s) => s.groups),
      ...configuration.pools,
    ].map((n) => n.id),
  );
  if (configuration.structureVersion !== "structure-v2") return ids;
  const {
    id,
    tournamentId,
    version,
    state,
    snapshot,
    upgradeOrigin,
    ...structure
  } = configuration;
  let plan = snapshot?.plan;
  if (!plan) {
    const { validateStructure } = require("./validation"),
      { compile } = require("./formats/compile"),
      context = { configurationId: id, tournamentId };
    if (validateStructure(structure, tournamentId).structureValid)
      plan = compile(structure, context);
    else {
      // Layout identity is local to each group. Unrelated incomplete routes
      // must not erase valid nodes; this does not approve the global plan.
      plan = {
        units: structure.stages.flatMap((stage) => {
          const local = {
            ...structure,
            stages: [{ ...stage, order: 1 }],
            pools: [],
            routes: [],
          };
          return validateStructure(local, tournamentId).structureValid
            ? compile(local, context).units
            : [];
        }),
      };
    }
  }
  for (const unit of plan.units) {
    ids.add(unit.unitKey);
    for (const node of [...unit.matches, ...unit.windows, ...unit.waves])
      ids.add(node.planKey);
    unit.inputs.forEach((p) => ids.add(inputKey(unit, p.channel)));
    unit.outputs.qualification.forEach((q) => ids.add(outputKey(unit, q)));
  }
  if (runtime?.configurationId === id)
    for (const unit of runtime.units)
      for (const round of unit.rounds)
        for (const match of round.matches)
          if (match.planKey) ids.add(match.planKey);
  return ids;
}
module.exports = { graphNodeIds, belongsToGroup, inputKey, outputKey };
