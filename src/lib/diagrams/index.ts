export { generateTaskLifecycleDiagram } from './taskLifecycle';
export { generateArchitectureDiagram } from './architecture';

export type DiagramKind = 'task_lifecycle' | 'architecture' | 'dependency';

export function getDiagramTitle(kind: DiagramKind, entityName: string): string {
  switch (kind) {
    case 'task_lifecycle': return `${entityName} — Lifecycle`;
    case 'architecture': return `${entityName} — Architecture`;
    case 'dependency': return `${entityName} — Dependencies`;
  }
}
