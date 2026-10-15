"use strict";

const formats = [
  { id: "bo1", label: "BO1", bestOf: 1 },
  { id: "bo3", label: "BO3", bestOf: 3 },
];
const format = (params) => formats.find((f) => f.id === params.matchFormat);

function validate(params, fail) {
  if (!format(params)) fail("请选择当前支持的单场赛制");
}
module.exports = {
  formats,
  format,
  validate,
  defaultFormat: formats[1],
};
