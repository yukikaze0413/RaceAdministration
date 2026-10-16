import type { CanvasGraph } from "./types";
export type EditToken = { epoch: number; revision: number; projectId: string | null };
export class EditorState {
  epoch = 0;
  revision = 0;
  projectId: string | null = null;
  private content = "";
  private savedContent: string | null = null;
  private savedName = "";
  replace(graph: CanvasGraph | null, projectId: string | null) {
    this.epoch++;
    this.revision++;
    this.projectId = projectId;
    this.content = graph ? JSON.stringify(graph) : "";
    this.savedContent = null;
  }
  commit(graph: CanvasGraph | null) {
    this.revision++;
    this.content = graph ? JSON.stringify(graph) : "";
  }
  markSaved(graph: CanvasGraph, name: string) {
    this.savedContent = JSON.stringify(graph);
    this.savedName = name;
  }
  forgetSaved() { this.savedContent = null; }
  dirty(name: string) { return this.savedContent !== this.content || name !== this.savedName; }
  capture(): EditToken { return { epoch: this.epoch, revision: this.revision, projectId: this.projectId }; }
  matches(token: EditToken) {
    return this.epoch === token.epoch && this.revision === token.revision && this.projectId === token.projectId;
  }
}
