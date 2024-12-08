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
	const exports = {};
	let hasExports = false;

	if (existingNode) {
		const existingRef = existingNode[1];
		const { '': existingExports, ...existingImports } = existingRef;

		for (const [importPath, existingImport] of Object.entries(existingImports)) {
			const importNode = map[importPath];
			const importRef = importNode[1];
			const { '': exports } = importRef;
			const names = Object.keys(existingImport);

			for (const name of names) {
				const array = exports[name];
				const index = array.indexOf(path);

				if (index <= 0) {
					continue;
				}
				
				array.splice(index, 1);
				
				if (array.length === 1 && array[0] < 0) {
					delete exports[name];
				}
			}

			if (Object.keys(exports).length === 0 && Object.keys(importRef).length < 2) {
				delete map[importPath];
			}
		}

		for (const [name, array] of Object.entries(existingExports)) {
			const paths = array.slice(1);

			if (paths.length) {
				exports[name] = [-1, ...paths];
				hasExports = true;
			}
		}
	}

	if (hasExports) {
		map[path] = ['', { '': exports }];
		return exports;
	}
	
	delete map[path];
}

export function updateMap (map, path, templateNode) {
	const wrappedExports = clearNode(map, path) || {};

	if (!templateNode) {
		return;
	}

	const folders = path.slice(1).split('/');
	const [type, refs, ...locals] = templateNode;
	const { '': newExports = {}, ...relativeImports } = refs;
	const absoluteImports = {};

	for (const [relativePath, importObject] of Object.entries(relativeImports)) {
		const sourcePath = getPath(folders, relativePath);
		const mapNode = getObject(map, sourcePath, ['', { '': {} }]);
		const mapExports = mapNode[1][''];
		absoluteImports[sourcePath] = importObject;

		for (const name of Object.keys(importObject)) {
			const exportArray = getObject(mapExports, name, [-1]);
			exportArray.push(path);
		}
	}

	for (const [name, value] of Object.entries(newExports)) {
		const array = getObject(wrappedExports, name, [-1]);
		array[0] = value;
	}

	const newRefs = { ...absoluteImports, '': wrappedExports };
	const node = [type, newRefs, ...locals];
	map[path] = node;
}
