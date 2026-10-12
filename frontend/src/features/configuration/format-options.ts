export type Definition = {
  ruleVersion: string;
  format: string;
  label: string;
  defaults: any;
  parameterSchema: any;
  runtimeReady: boolean;
};
export const numberChoices = (n: number) =>
  Array.from(
    { length: Math.max(0, Math.min(64, Math.floor(n))) },
    (_, i) => i + 1,
  );
const power = (n: number) =>
  Number.isInteger(n) && n >= 1 && (n & (n - 1)) === 0;
export function groupInputs(d: any) {
  return (
    d.groupSize +
    (d.parameters.lowerEntryMode === "same"
      ? d.groupSize
      : d.parameters.lowerEntryMode === "half"
        ? d.groupSize / 2
        : 0)
  );
}
export function sizes(d: any, budget = 64) {
  const possible = [
    "major-cologne-2026-v1",
    "ti2026-observed-candidate-v1",
  ].includes(d.ruleVersion)
    ? [16]
    : d.format === "gsl"
      ? [4]
      : d.format === "double-elimination" ||
          (d.format === "single-elimination" &&
            d.parameters.bracketMode !== "segmented")
        ? [2, 4, 8, 16, 32, 64]
        : numberChoices(64).filter((n) => n >= 2);
  return possible.filter((n) => groupInputs({ ...d, groupSize: n }) <= budget);
}
export function qualifiers(d: any) {
  if (
    ["major-cologne-2026-v1", "ti2026-observed-candidate-v1"].includes(
      d.ruleVersion,
    )
  )
    return [8];
  if (d.format === "gsl") return [2];
  if (d.format === "double-elimination")
    return d.groupSize >= 4 ? [1, 2, 3] : [1, 2];
  if (d.format === "single-elimination")
    return numberChoices(d.groupSize / 2).filter(
      (q) =>
        power(d.groupSize / q) &&
        (d.parameters.bracketMode === "segmented" || power(q)),
    );
  return numberChoices(d.groupSize);
}
export function counts(d: any, budget = 64) {
  return numberChoices(budget / groupInputs(d));
}
export function inputBudget(configuration: any, stageId: string | null) {
  if (
    stageId &&
    configuration.routes.some((r: any) => r.target.stageId === stageId)
  )
    return 64;
  return Math.max(
    0,
    64 -
      configuration.stages
        .filter(
          (s: any) =>
            s.id !== stageId &&
            !configuration.routes.some((r: any) => r.target.stageId === s.id),
        )
        .reduce((sum: number, s: any) => sum + (s.capacity ?? 0), 0),
  );
}
export function repair(d: any, budget = 64) {
  const next = structuredClone(d),
    ns = sizes(next, budget);
  if (ns.length && !ns.includes(next.groupSize))
    next.groupSize = ns.filter((n) => n <= next.groupSize).at(-1) ?? ns[0];
  const qs = qualifiers(next);
  if (qs.length && !qs.includes(next.qualifyCount))
    next.qualifyCount =
      qs.filter((q) => q <= next.qualifyCount).at(-1) ?? qs[0];
  const cs = counts(next, budget);
  if (cs.length && !cs.includes(next.groupCount)) next.groupCount = cs.at(-1);
  if (next.ruleVersion === "swiss-fixed-v1")
    next.parameters.roundCount = Math.min(
      next.parameters.roundCount,
      next.groupSize % 2 ? next.groupSize : next.groupSize - 1,
    );
  if (next.qualifyCount !== 1) {
    if ("thirdPlace" in next.parameters) next.parameters.thirdPlace = false;
    if ("finalReset" in next.parameters) next.parameters.finalReset = false;
    delete next.parameters.overrides?.final;
  }
  if (next.groupSize < 4 && "thirdPlace" in next.parameters)
    next.parameters.thirdPlace = false;
  if (!next.parameters.thirdPlace) delete next.parameters.overrides?.thirdPlace;
  return next;
}
export function fromDefinition(def: Definition, name = "新阶段") {
  return {
    name,
    format: def.format,
    ruleVersion: def.ruleVersion,
    ...structuredClone(def.defaults),
  };
}
export function fromStage(s: any) {
  return {
    name: s.name,
    format: s.format,
    ruleVersion: s.ruleVersion,
    groupSize: s.groupSize,
    groupCount: s.groupCount,
    qualifyCount: s.qualifyCount,
    parameters: structuredClone(s.parameters),
  };
}

function matchesSchema(value: any, schema: any): boolean {
  if (schema.enum && !schema.enum.includes(value)) return false;
  if (schema.type === "object")
    return (
      !!value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (schema.required ?? []).every((key: string) =>
        Object.hasOwn(value, key),
      ) &&
      Object.entries(value).every(([key, v]) =>
        schema.properties[key]
          ? matchesSchema(v, schema.properties[key])
          : schema.additionalProperties !== false,
      )
    );
  if (schema.type === "array")
    return (
      Array.isArray(value) &&
      value.length >= (schema.minItems ?? 0) &&
      value.length <= (schema.maxItems ?? Infinity) &&
      (!schema.uniqueItems || new Set(value).size === value.length) &&
      value.every((v) => matchesSchema(v, schema.items))
    );
  if (schema.type === "integer")
    return (
      Number.isSafeInteger(value) &&
      value >= (schema.minimum ?? -Infinity) &&
      value <= (schema.maximum ?? Infinity)
    );
  if (schema.type === "boolean") return typeof value === "boolean";
  if (schema.type === "string") return typeof value === "string";
  return true;
}
export function parametersValid(d: any, definition: Definition) {
  const p = d.parameters;
  const ti = d.ruleVersion === "ti2026-observed-candidate-v1";
  if (
    ti &&
    (d.groupSize !== 16 ||
      d.qualifyCount !== 8 ||
      JSON.stringify(p.tiebreakers) !==
        JSON.stringify(definition.defaults.parameters.tiebreakers))
  )
    return false;
  if (
    d.ruleVersion === "major-cologne-2026-v1" &&
    (d.groupSize !== 16 ||
      d.qualifyCount !== 8 ||
      JSON.stringify(p.tiebreakers) !==
        JSON.stringify(["record", "DS-wl-v1", "initialSeed"]) ||
      p.overrides?.advancement !== 3 ||
      p.overrides?.elimination !== 3)
  )
    return false;
  if (!matchesSchema(p, definition.parameterSchema)) return false;
  if (!p.seeding?.kind || !p.seeding?.seedTableVersion) return false;
  if (
    p.points &&
    (["win", "draw", "loss", "doubleLoss"].some(
      (k) => p.points[k] === undefined,
    ) ||
      !(p.points.win > p.points.draw && p.points.draw >= p.points.loss))
  )
    return false;
  if (
    p.tiebreakers &&
    (p.tiebreakers[0] !==
      (d.format === "threshold-swiss" ? "record" : "points") ||
      (!ti &&
        !["initialSeed", "manual-with-reason"].includes(p.tiebreakers.at(-1))))
  )
    return false;
  if (p.thirdPlace && (d.qualifyCount !== 1 || d.groupSize < 4)) return false;
  if (p.finalReset && d.qualifyCount !== 1) return false;
  if (
    d.ruleVersion === "swiss-fixed-v1" &&
    p.roundCount > (d.groupSize % 2 ? d.groupSize : d.groupSize - 1)
  )
    return false;
  return true;
}
