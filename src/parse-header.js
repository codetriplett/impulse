import { parse } from 'acorn';

const options = {
	ecmaVersion: 'latest',
	sourceType: 'module',
};

export function getPath (rootPath, relativePath) {
	if (!relativePath.startsWith('.')) {
		return relativePath;
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

export function buildMap (nodes) {
	const map = {};

	for (const [rootPath, imports] of Object.entries(nodes)) {
		for (const [sourcePath, exports] of Object.entries(imports)) {
			let mapLocation = map[sourcePath];

			if (!mapLocation) {
				mapLocation = {};
				map[sourcePath] = mapLocation;
			}

			for (const importedName in exports) {
				let mapEntry = mapLocation[importedName];

				if (!mapEntry) {
					mapEntry = new Set();
					mapLocation[importedName] = mapEntry;
				}

				mapEntry.add(rootPath);
			}
		}
	}

	return map;
}

export function cleanMap (path, node, map) {
	for (const [name, imports] of Object.entries(node)) {
		const location = map[name];

		for (const name in imports) {
			location[name].delete(path)
		}
	}
}

export default function parseHeader (code, map, rootFolders) {
	const { body } = parse(code, options);
	const node = {};
	const rootPath = `/${rootFolders.join('/')}`;

	for (const { type, source, specifiers } of body) {
		if (type !== 'ImportDeclaration') {
			continue;
		}

		const { value } = source;
		const sourcePath = getPath(rootFolders, value);
		let mapLocation = map[sourcePath];
		let nodeLocation = node[sourcePath];

		if (!mapLocation) {
			mapLocation = {};
			map[sourcePath] = mapLocation;
		}

		if (!nodeLocation) {
			nodeLocation = {};
			node[sourcePath] = nodeLocation;
		}

		for (const { type, local, imported } of specifiers) {
			const importedName = type === 'ImportDefaultSpecifier' ? 'default' : imported.name;
			const localName = local.name;
			let mapEntry = mapLocation[importedName];

			if (!mapEntry) {
				mapEntry = new Set();
				mapLocation[importedName] = mapEntry;
			}

			mapEntry.add(rootPath);
			nodeLocation[importedName] = localName;
		}
	}

	return node;
}
