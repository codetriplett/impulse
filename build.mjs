import * as esbuild from 'esbuild'

const ctx = await esbuild.context({
	entryPoints: [
		'src/index.js',
	],
	external: [
		'@triplett/stew',
		'acorn',
		'acorn-jsx',
	],
	bundle: true,
	minify: true,
	outdir: 'dist',
	format: 'cjs',
});

await ctx.watch();
