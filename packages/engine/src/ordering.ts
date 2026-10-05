import type { Layer } from './types';

export const LAYER_ORDER: Layer[] = ['types', 'server', 'api', 'ui', 'other', 'tests'];

export function classifyLayer(file: string): Layer {
  if (/(\.(test|spec)\.tsx?$)|((^|\/)__tests__\/)/.test(file)) return 'tests';
  if (/(^|\/)(types?|schemas?|shared|models?)(\/|\.)/.test(file)) return 'types';
  if (/(^|\/)(api|routes?|endpoints?)(\/|\.)/.test(file)) return 'api';
  if (/\.tsx$|(^|\/)(components?|pages?|views?|web)(\/|\.)/.test(file)) return 'ui';
  if (/(^|\/)(server|services?|lib|utils?|core)(\/|\.)/.test(file)) return 'server';
  return 'other';
}

export function readingOrder(items: { file: string; callersCount: number }[]): number[] {
  return items
    .map((item, index) => ({ index, layer: LAYER_ORDER.indexOf(classifyLayer(item.file)), calls: item.callersCount }))
    .sort((a, b) => a.layer - b.layer || b.calls - a.calls || a.index - b.index)
    .map((x) => x.index);
}
