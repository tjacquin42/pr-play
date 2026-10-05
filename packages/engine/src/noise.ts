import type { ChangedFile } from './diff';

const NOISE_PATTERNS: RegExp[] = [
  /(^|\/)pnpm-lock\.yaml$/, /(^|\/)package-lock\.json$/, /(^|\/)yarn\.lock$/,
  /\.snap$/, /(^|\/)dist\//, /(^|\/)build\//, /\.min\.(js|css)$/, /\.map$/,
  /(^|\/)generated\//,
];

export function isNoise(file: ChangedFile): boolean {
  return file.isRenameOnly || NOISE_PATTERNS.some((p) => p.test(file.path));
}

export function splitNoise(files: ChangedFile[]): { kept: ChangedFile[]; noise: string[] } {
  const kept: ChangedFile[] = [];
  const noise: string[] = [];
  for (const f of files) (isNoise(f) ? noise.push(f.path) : kept.push(f));
  return { kept, noise };
}
