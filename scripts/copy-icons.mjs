// Иконки узлов рядом со сборкой (tsc копирует только .ts → .js).
import { copyFileSync, mkdirSync } from 'node:fs';

for (const node of ['Leadforms', 'LeadformsTrigger']) {
  mkdirSync(`dist/nodes/${node}`, { recursive: true });
  copyFileSync(`nodes/${node}/leadforms.svg`, `dist/nodes/${node}/leadforms.svg`);
}
