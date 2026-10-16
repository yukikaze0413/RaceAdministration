// @ts-nocheck
export function check(value, schema, path, fail) {
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value))
      fail(path, "必须为对象");
    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(schema.properties, key))
        fail(path + "/" + key, "未知字段");
      check(value[key], schema.properties[key], path + "/" + key, fail);
    }
  } else if (schema.type === "array") {
    if (
      !Array.isArray(value) ||
      value.length < (schema.minItems ?? 0) ||
      (schema.uniqueItems && new Set(value).size !== value.length)
    )
      fail(path, "数组无效或重复");
    value.forEach((v, i) => check(v, schema.items, path + "/" + i, fail));
  } else if (
    (schema.type === "integer"
      ? !Number.isSafeInteger(value)
      : typeof value !== schema.type) ||
    (schema.enum && !schema.enum.includes(value)) ||
    (schema.minimum !== undefined && value < schema.minimum) ||
    (schema.maximum !== undefined && value > schema.maximum)
  )
    fail(path, "参数类型或允许范围无效");
}

export function validateRuleParameters(parameters, rule) { const fail = (path, message) => {const e = new Error(message + "：" + path); e.code = "INVALID_INPUT"; throw e;}; check({...rule.defaults.parameters,...parameters}, rule.parameterSchema, "/parameters", fail); }
