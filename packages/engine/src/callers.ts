import { relative } from 'node:path';
import { Node, SyntaxKind } from 'ts-morph';
import type { RawSymbol } from './symbols';
import type { Caller } from './types';

function enclosingName(node: Node): string {
  for (const anc of node.getAncestors()) {
    if (Node.isFunctionDeclaration(anc) && anc.getName()) return anc.getName()!;
    if (Node.isClassDeclaration(anc) && anc.getName()) return anc.getName()!;
    if (Node.isVariableDeclaration(anc)) {
      // Ne compte comme scope englobant que si la variable est elle-même une fonction
      // (sinon un simple `const x = f(y)` masquerait la vraie fonction englobante).
      const init = anc.getInitializer();
      const isFn = init !== undefined
        && (init.getKind() === SyntaxKind.ArrowFunction || init.getKind() === SyntaxKind.FunctionExpression);
      if (isFn) return anc.getName();
    }
  }
  return node.getSourceFile().getBaseName();
}

export function findCallers(symbol: RawSymbol, changedPaths: Set<string>, repoDir: string): Caller[] {
  const node = symbol.node;
  if (!node || !Node.isReferenceFindable(node)) return [];
  const callers: Caller[] = [];
  for (const ref of node.findReferencesAsNodes()) {
    if (Node.isImportSpecifier(ref.getParent())) continue; // la ligne d'import, pas un appel réel
    const rel = relative(repoDir, ref.getSourceFile().getFilePath());
    if (changedPaths.has(rel)) continue;               // fichier touché par la PR
    if (rel === symbol.file) continue;                  // la déclaration elle-même
    callers.push({ file: rel, line: ref.getStartLineNumber(), symbol: enclosingName(ref) });
  }
  return callers;
}
