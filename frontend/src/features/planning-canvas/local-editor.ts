import { createEditor, EDITOR_PROTOCOL } from "../../../../shared/planning-canvas/dist/esm/index.js";
import { requestKey } from "../../shared/api";
export function localEditor(catalog: any) {
  if (catalog.editorProtocol !== EDITOR_PROTOCOL) throw new Error("编辑目录版本不匹配，请刷新页面。");
  return createEditor({ catalog, createId: requestKey });
}
