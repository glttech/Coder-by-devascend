export interface PrDiffDiagram {
  source: string;  // Mermaid source
  title: string;
}

interface FileNode {
  children: Map<string, FileNode>;
  files: string[];
}

function buildTree(files: string[]): FileNode {
  const root: FileNode = { children: new Map(), files: [] };
  for (const file of files) {
    const parts = file.split('/');
    const filename = parts.pop()!;
    let node = root;
    for (const part of parts) {
      if (!node.children.has(part)) {
        node.children.set(part, { children: new Map(), files: [] });
      }
      node = node.children.get(part)!;
    }
    node.files.push(filename);
  }
  return root;
}

function sanitizeId(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

function renderNode(node: FileNode, parentId: string, lines: string[], depth: number): void {
  if (depth > 3) return; // Don't go too deep
  for (const [dirName, child] of node.children.entries()) {
    const nodeId = `${parentId}_${sanitizeId(dirName)}`;
    lines.push(`  ${parentId}["${parentId.replace(/^root_?/, '') || '/'}"] --> ${nodeId}["📁 ${dirName}"]`);
    renderNode(child, nodeId, lines, depth + 1);
  }
  for (const file of node.files.slice(0, 10)) { // Max 10 files per dir
    const fileId = `${parentId}_f_${sanitizeId(file)}`;
    lines.push(`  ${parentId} --> ${fileId}["📄 ${file}"]`);
  }
  if (node.files.length > 10) {
    lines.push(`  ${parentId} --> ${parentId}_more["…+${node.files.length - 10} more"]`);
  }
}

export function generatePrDiffDiagram(prNumber: number, files: string[]): PrDiffDiagram {
  if (files.length === 0) {
    return { source: 'graph LR\n  A["No file changes recorded"]', title: `PR #${prNumber} — No changes` };
  }

  const limited = files.slice(0, 50); // Cap at 50 files
  const tree = buildTree(limited);
  const lines: string[] = ['graph LR'];
  renderNode(tree, 'root', lines, 0);

  // Fallback to flat list if tree is empty
  if (lines.length === 1) {
    for (const f of limited) {
      lines.push(`  root["PR #${prNumber}"] --> f_${sanitizeId(f)}["${f}"]`);
    }
  }

  const source = lines.join('\n');
  return {
    source,
    title: `PR #${prNumber} File Changes (${files.length} files${files.length > 50 ? ', showing 50' : ''})`,
  };
}
