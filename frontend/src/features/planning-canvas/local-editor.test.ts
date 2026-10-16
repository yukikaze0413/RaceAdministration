import { expect, test } from "vitest";
import { localEditor } from "./local-editor";

test.each([undefined, "canvas-editor-unknown"])("incompatible editor protocol %s is rejected before editing", protocol => {
  expect(() => localEditor({editorProtocol:protocol})).toThrow("编辑目录版本不匹配");
});
