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

export function clearNode (map, nodePath) {
	const existingNode = map[nodePath];
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

				const index = array.slice(1).findIndex(hashPath => {
					if (typeof hashPath !== 'string') {
						return;
					}

					const [path] = hashPath.split('#');
					return path === nodePath;
				});

				if (index < 0) {
					continue;
				}
				
				array.splice(index + 1, 1);

				if (array.length < 2 && !array[0]) {
					delete locals[name];
				}
			}

			if (Object.keys(locals).length < 2 && locals[''].length < 2 && Object.keys(importNode).length < 2) {
				delete map[importPath];
			}
		}

		for (const [name, array] of Object.entries(existingLocals)) {
			array[0] = '';

			if (array.length > 1) {
				exportPaths[name] = array;
				hasExports = true;
			}
		}
	}

	if (hasExports) {
		if (!exportPaths['']) {
			exportPaths[''] = [''];
		}

		map[nodePath] = { '': exportPaths };
		return exportPaths;
	}

	delete map[nodePath];
}

export function updateNode (map, path, templateNode) {
	const exportPaths = clearNode(map, path) || {};

	if (!templateNode) {
		return;
	}

	const folders = path.slice(1).split('/');
	const { '': locals, ...relativeImports } = templateNode;
	const absoluteImports = {};

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

	for (const [relativePath, importObject] of Object.entries(relativeImports)) {
		const sourcePath = getPath(folders, relativePath);
		const mapNode = getObject(map, sourcePath, { '': { '': [''] } });
		const mapExports = mapNode[''];
		absoluteImports[sourcePath] = importObject;

		for (const [name, array] of Object.entries(importObject)) {
			const exportArray = getObject(mapExports, name, ['']);
			const variationStrings = [];

			const hash = array.slice(1).map(string => {
				const [name, ...numbers] = string.split(' ');

				if (numbers.length) {
					variationStrings.push(`${name}#${numbers.join('#')}`);
				}

				return name;
			}).join('#');

			const hashPath = `${path}${hash ? `#${hash}` : ''}${variationStrings.length ? ` ${variationStrings.join(' ')}` : ''}`;
			exportArray.push(hashPath);
		}
	}

	const node = { ...absoluteImports, '': locals };
	map[path] = node;
	return node;
}
