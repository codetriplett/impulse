import { getObject } from './common';

export function getPath (rootPath, relativePath) {
	if (!relativePath.startsWith('.')) {
		return relativePath;
	} else if (relativePath === '.') {
		return '/index';
	}

	const sections = relativePath.replace(/^.\//, '').split('/');
	const sourcePath = rootPath.slice(0, -1);

	while (sections[0] === '..') {
		sections.shift();
		sourcePath.pop();
	}

	sourcePath.push(...sections);
	return `/${sourcePath.join('/')}`;
}

export function clearNode (map, path) {
	const existingNode = map[path];

	if (!existingNode) {
		return;
	}

	const { '': locals, ...imports } = existingNode;
	const exportPaths = {};
	let hasExports = false;

	for (const [importPath, existingImport] of Object.entries(imports)) {
		const importNode = map[importPath];
		const { '': locals } = importNode;
		const names = Object.keys(existingImport);

		for (const name of names) {
			const array = locals[name];
			const index = array?.indexOf?.(path) || 0;

			if (index < 1) {
				continue;
			}
			
			array.splice(index, 1);

			if (!array[0] && array.length < 2) {
				delete locals[name];
			}
		}

		if (Object.keys(importNode).length < 2 && !Object.keys(locals).length) {
			delete map[importPath];
		}
	}

	for (const [name, array] of Object.entries(locals)) {
		if (array.length < 2) {
			delete locals[name];
			continue;
		}

		array[0] = '';
		exportPaths[name] = array.slice(1);
		hasExports = true;
	}

	if (!hasExports) {
		delete map[path];
		return;
	}

	map[path] = { '': locals };
	return exportPaths;
}

export function updateNode (map, path, relativeNode) {
	const exportPaths = clearNode(map, path) || {};

	if (!relativeNode) {
		return;
	}

	const folders = path.slice(1).split('/');
	const { '': infos, ...relativeImports } = relativeNode;
	const absoluteImports = {};
	const locals = {};

	for (const [name, info] of Object.entries(infos)) {
		const paths = exportPaths[name] || [];
		locals[name] = [info, ...paths];
	}

	for (const [relativePath, importObject] of Object.entries(relativeImports)) {
		const sourcePath = getPath(folders, relativePath);
		const mapNode = getObject(map, sourcePath, { '': {} });
		const mapLocals = mapNode[''];
		absoluteImports[sourcePath] = importObject;

		for (const name in importObject) {
			const remote = getObject(mapLocals, name, ['']);
			const index = remote.indexOf(path);

			if (index !== -1) {
				continue;
			}

			remote.push(path);
		}
	}

	const absoluteNode = { ...absoluteImports, '': locals };
	map[path] = absoluteNode;
	return absoluteNode;
}
