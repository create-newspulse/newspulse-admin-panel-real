import { Project, ImportDeclaration } from 'ts-morph';
import fg from 'fast-glob';
import path from 'node:path';

const project = new Project();
const files = fg.sync(['src/**/*.{ts,tsx}'], { absolute: true });

for (const file of files) {
  const source = project.addSourceFileAtPath(file);
  let changed = false;

  source.getImportDeclarations().forEach((imp: ImportDeclaration) => {
    const moduleSpecifier = imp.getModuleSpecifierValue();

    if (moduleSpecifier.startsWith('@/')) {
      const newPath = path
        .relative(path.dirname(file), path.resolve('src', moduleSpecifier.slice(2)))
        .replace(/\\/g, '/');

      imp.setModuleSpecifier(newPath.startsWith('.') ? newPath : './' + newPath);
      changed = true;
    }
  });

  if (changed) {
    source.saveSync();
    console.log(`✅ Fixed imports in ${file}`);
  }
}
