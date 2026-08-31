import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { Node, Project, SyntaxKind, type SourceFile, type Statement } from 'ts-morph';
import type { ChangedFile } from './diff';
import type { SymbolKind } from './types';

export interface RawSymbol {
  name: string;
  kind: SymbolKind;
  file: string;
  startLine: number;
  endLine: number;
  node?: Node;
}

export function openProject(repoDir: string): Project {
  const tsconfig = join(repoDir, 'tsconfig.json');
  const project = existsSync(tsconfig)
    ? new Project({ tsConfigFilePath: tsconfig })
    : new Project({ compilerOptions: { allowJs: false } });
  project.addSourceFilesAtPaths([join(repoDir, '**/*.{ts,tsx}'), `!${join(repoDir, '**/node_modules/**')}`]);
  return project;
}

function fileLevel(file: ChangedFile): RawSymbol {
  return { name: basename(file.path), kind: 'file', file: file.path, startLine: 1, endLine: 1 };
}

function namedDeclaration(stmt: Statement): { name: string; kind: SymbolKind; node: Node } | undefined {
  if (Node.isFunctionDeclaration(stmt) && stmt.getName()) {
    return { name: stmt.getName()!, kind: 'function', node: stmt };
  }
  if (Node.isClassDeclaration(stmt) && stmt.getName()) {
    return { name: stmt.getName()!, kind: 'class', node: stmt };
  }
  if (Node.isInterfaceDeclaration(stmt) || Node.isTypeAliasDeclaration(stmt) || Node.isEnumDeclaration(stmt)) {
    return { name: stmt.getName(), kind: 'type', node: stmt };
  }
  if (Node.isVariableStatement(stmt)) {
    const decl = stmt.getDeclarations()[0];
    if (!decl) return undefined;
    const init = decl.getInitializer();
    const isFn = init !== undefined
      && (init.getKind() === SyntaxKind.ArrowFunction || init.getKind() === SyntaxKind.FunctionExpression);
    return { name: decl.getName(), kind: isFn ? 'function' : 'variable', node: decl };
  }
  return undefined;
}

function componentKind(name: string, filePath: string, kind: SymbolKind): SymbolKind {
  return kind === 'function' && filePath.endsWith('.tsx') && /^[A-Z]/.test(name) ? 'component' : kind;
}

export function extractSymbols(project: Project, repoDir: string, file: ChangedFile): RawSymbol[] {
  if (!/\.tsx?$/.test(file.path) || file.isDeleted) return [fileLevel(file)];
  const sf: SourceFile | undefined = project.getSourceFile(join(repoDir, file.path));
  if (!sf) return [fileLevel(file)];

  const found = new Map<string, RawSymbol>();
  let orphanLines = false;

  for (const line of file.changedLines) {
    const stmt = sf.getStatements().find(
      (s) => s.getStartLineNumber() <= line && line <= s.getEndLineNumber(),
    );
    const named = stmt ? namedDeclaration(stmt) : undefined;
    if (!named) { orphanLines = true; continue; }
    const container = stmt as Statement;
    found.set(named.name, {
      name: named.name,
      kind: componentKind(named.name, file.path, named.kind),
      file: file.path,
      startLine: container.getStartLineNumber(),
      endLine: container.getEndLineNumber(),
      node: named.node,
    });
  }

  const symbols = [...found.values()];
  if (symbols.length === 0) return [fileLevel(file)];
  if (orphanLines) symbols.push(fileLevel(file)); // lignes hors déclaration (imports…) : entrée fichier en plus
  return symbols;
}
