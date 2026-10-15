"use strict";
const definitions = {
  expander: [
    {
      key: "count",
      label: "展开数量",
      readOnly: true,
      persisted: false,
      source: "input-capacity",
    },
    {
      key: "inputCount",
      label: "来源集合数量",
      readOnly: true,
      persisted: false,
      source: "input-capacity",
    },
    {
      key: "outputCount",
      label: "输出席位数",
      readOnly: true,
      persisted: false,
      source: "input-capacity",
    },
    {
      key: "status",
      label: "状态",
      readOnly: true,
      persisted: false,
      source: "analysis",
    },
  ],
};
function readOnlyProperties(graph, node, capacity) {
  if (node.kind !== "expander") return [];
  const connected = require("./graph").incoming(graph, node, "collection");
  const presetCapacity = !connected && capacity != null;
  return definitions.expander.map((field) => ({
    ...field,
    source:
      field.key === "status"
        ? "分析结果"
        : presetCapacity && field.key !== "inputCount"
          ? "由预设规则推导"
          : "由输入集合推导",
    value:
      field.key === "status"
        ? !connected
          ? presetCapacity
            ? "预设容量，等待集合输入"
            : "等待集合输入"
          : capacity == null
            ? "数量待解析"
            : "跟随输入集合"
        : field.key === "inputCount" && !connected
          ? null
          : capacity,
  }));
}
module.exports = { definitions, readOnlyProperties };
