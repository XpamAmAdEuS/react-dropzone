import { build } from 'esbuild';
import pkg from './package.json' assert { type: 'json' };

const formats = [
  { name: 'esm', extension: 'mjs' },
];

/** @type {import('esbuild').BuildOptions} */
const config = {
  bundle: true,
  minify: true,
  sourcemap: false,
  target: ['esnext'],
  logLevel: 'info',
  entryPoints: ['src/index.ts'],
  external: Object.keys(pkg.peerDependencies),
};

for (const { name, extension } of formats) {
  await build({ ...config, format: name, outfile: `./dist/index.${extension}` });
}
