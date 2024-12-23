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
	const exportPaths = {};
	let hasExports = false;

	if (existingNode) {
		const { '': existingLocals, ...existingImports } = existingNode;

		for (const [importPath, existingImport] of Object.entries(existingImports)) {
			const importNode = map[importPath];
			const { '': locals } = importNode;
			const names = Object.keys(existingImport);

			for (const name of names) {
				const array = locals[name];

				if (!array) {
					continue;
				}

				const index = array.indexOf(path);

				if (index < 0) {
					continue;
				}
				
				array.splice(index, 1);

				if (array.length === 0) {
					delete locals[name];
				}
			}

			if (Object.keys(locals).length < 2 && locals[''].length === 0 && Object.keys(importNode).length < 2) {
				delete map[importPath];
			}
		}

		for (const [name, array] of Object.entries(existingLocals)) {
			const paths = array.filter(it => typeof it === 'string');

			if (paths.length) {
				exportPaths[name] = paths;
				hasExports = true;
			}
		}
	}

	if (hasExports) {
		if (!exportPaths['']) {
			exportPaths[''] = [];
		}

		map[path] = { '': exportPaths };
		return exportPaths;
	}

	delete map[path];
}

export function updateNode (map, path, templateNode) {
	const exportPaths = clearNode(map, path) || {};

	if (!templateNode) {
		return;
	}

	const folders = path.slice(1).split('/');
	const { '': locals, ...relativeImports } = templateNode;
	const absoluteImports = {};

	for (const [relativePath, importObject] of Object.entries(relativeImports)) {
		const sourcePath = getPath(folders, relativePath);
		const mapNode = getObject(map, sourcePath, { '': { '': [] } });
		const mapExports = mapNode[''];
		absoluteImports[sourcePath] = importObject;

		for (const name of Object.keys(importObject)) {
			const exportArray = getObject(mapExports, name, []);
			exportArray.push(path);
		}
	}

	for (const [name, array] of Object.entries(locals)) {
		const relativePaths = exportPaths[name];

		if (!relativePaths) {
			continue;
		}

		const absolutePaths = relativePaths.map(path => getPath(folders, path));

		if (absolutePaths) {
			array.push(...absolutePaths);
		}
	}

	const node = { ...absoluteImports, '': locals };
	map[path] = node;
	return node;
}
