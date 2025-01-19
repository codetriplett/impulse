import { parse as parseMDtoAST } from '@textlint/markdown-to-ast';
import { parse as parseJStoAST } from 'acorn';
import { getObject } from './common';

const options = {
	ecmaVersion: 'latest',
	sourceType: 'module',
};

export function parseJS (text) {
	const { body } = parseJStoAST(text, options);
	const imports = {};
	const importRefs = {};

	for (const node of body) {
		const { start, end, type } = node;

		// TODO: need to include for and if defintions as locals
		// - these should be shown when focusing a line within them
		// - an if ref that references another if ref, means it's an else if

		switch (type) {
			case 'ImportDeclaration': {
				const { specifiers, source } = node;
				const sourceValue = source.value;
				const importObject = getObject(imports, sourceValue, {});

				for (const node of specifiers) {
					const { type, local } = node;
					const localName = local.name;
					let sourceName;
					
					if (type === 'ImportDefaultSpecifier') {
						sourceName = 'default';
					}

					const importArray = getObject(importObject, sourceName, []);
					importRefs[localName] = importArray;
				}

				break;
			}
			case 'ExportNamedDeclaration': {
				const { declaration } = node;
				const { type } = declaration;

				switch (type) {
					case 'VariableDeclaration': {
						const { declarations } = declaration;
						break;
					}
				}

				break;
			}
			default: {
				console.log('========', type);
				break;
			}
		}
	}

	console.log(imports);

	return imports;
}

export function processId (node) {
	if ('id' in node) {
		return;
	}

	const { children = [] } = node;
	const lastChild = children[children.length - 1];
	const { type, loc, range, value } = lastChild || {};

	if (type !== 'Str') {
		return;
	}
	
	const [suffix, id] = value.match(/\s*\{#(.*?)\}\s*$/) || [];

	if (!suffix) {
		return;
	}

	const { end } = loc;
	const { length } = suffix;

	lastChild.raw = value.slice(0, -length);
	lastChild.value = value.slice(0, -length);
	end.column -= length;
	range[1] -= length;
	node.id = id;
}

function getText (node) {
	const { children } = node;
	let text = '';

	for (const node of children) {
		const { type } = node;

		switch (type) {
			case 'Link': {
				text += getText(node);
				break;
			}
			case 'Str': {
				text += node.value;
				break;
			}
		}
	}

	return text;
}

export function findByType (candidateNodes, expectedType) {
	const foundNodes = [];

	for (const candidateNode of candidateNodes) {
		const { type, children = [] } = candidateNode;

		if (type === expectedType) {
			foundNodes.push(candidateNode);
		}

		const additionalNodes = findByType(children, expectedType);
		foundNodes.push(...additionalNodes);
	}

	return foundNodes;
}

export function parseMD (text) {
	const tree = parseMDtoAST(text);
	const { children } = tree;
	const urls = {};
	let prevStart = text.length;
	
	const definitions = findByType(children, 'Definition');
	const snips = findByType(children, 'Header');
	const links = findByType(children, 'Link');
	const references = findByType(children, 'LinkReference');
	snips.unshift({ range: [0], children: [] });

	for (const node of definitions) {
		const { label, url } = node;

		if (urls[label]) {
			continue;
		}

		urls[label] = url;
	}
	
	for (let i = snips.length - 1; i >= 0; i--) {
		const snip = snips[i];
		const { range } = snip;
		const [rangeStart] = range;

		processId(snip);
		range[1] = prevStart;
		prevStart = rangeStart;

		const linkIndex = links.findLastIndex(({ range }) => range[0] >= rangeStart);
		const snipLinks = linkIndex === -1 ? [] : links.splice(linkIndex);

		const referenceIndex = references.findLastIndex(({ range }) => range[0] >= rangeStart);
		const snipReferences = referenceIndex === -1 ? [] : references.splice(referenceIndex);

		for (const reference of snipReferences) {
			const { label } = reference;
			const url = urls[label];

			if (!url) {
				continue;
			}

			snipLinks.push({ url });
		}

		Object.assign(snip, {
			text: getText(snip),
			links: snipLinks,
		});
	}
	
	const imports = {};
	const locals = {};
	const stack = [];
	let index = 0;

	for (const snip of snips) {
		const { range, depth, text, id = '', links } = snip;
		const [start, finish] = range;
		let key = id;
	
		if (depth && (!key || locals[key])) {
			while (locals[index]) {
				index++;
			}

			key = String(index);
		}

		for (const link of links) {
			const { url } = link;
			const [, path = '.', name = ''] = url.match(/^([./].*?)?(?:#(.*?))?$/);
		
			const location = getObject(imports, path, {});
			const remote = getObject(location, name, []);
			remote.push(key);
		}

		stack.splice(0, stack.length - depth + 1, key);
		const parent = stack[1];
		const info = `${start}-${finish}${parent ? `#${parent}` : ''}${text ? ` ${text}` : ''}`;
		locals[key] = info;

		if (!id || key !== id) {
			continue;
		}

		locals[''] += ` ${id}`;
	}

	return { ...imports, '': locals };
}

// TODO: allow override parse and render functions when running the CLI command
// - can put path to file that module.exports overrides after impulse command
// - onParse and onRender can also be added to modify the default results from here
export function parse (text, type) {
	switch (type) {
		case 'js': {
			return parseJS(text);
		}
		case 'md': {
			return parseMD(text);
		}
	}
}


// // TODO: create simplified parser
// // - doesn't need to describe everything fully
// // - just needs to track imports/exports, variables and blocks
// export function parseJS (content, map, rootFolders) {
// 	const { body } = Parser.extend(jsxExt).parse(content, options);
// 	const node = {};
// 	const rootPath = `/${rootFolders.join('/')}`;

// 	for (const { type, source, specifiers } of body) {
// 		if (type !== 'ImportDeclaration') {
// 			continue;
// 		}

// 		const { value } = source;
// 		const sourcePath = getPath(rootFolders, value);
// 		let mapLocation = map[sourcePath];
// 		let nodeLocation = node[sourcePath];

// 		if (!mapLocation) {
// 			mapLocation = {};
// 			map[sourcePath] = mapLocation;
// 		}

// 		if (!nodeLocation) {
// 			nodeLocation = {};
// 			node[sourcePath] = nodeLocation;
// 		}

// 		for (const { type, local, imported } of specifiers) {
// 			const importedName = type === 'ImportDefaultSpecifier' ? 'default' : imported.name;
// 			const localName = local.name;
// 			let mapEntry = mapLocation[importedName];

// 			if (!mapEntry) {
// 				mapEntry = new Set();
// 				mapLocation[importedName] = mapEntry;
// 			}

// 			mapEntry.add(rootPath);
// 			nodeLocation[importedName] = localName;
// 		}
// 	}

// 	return node;
// }

// // [localAndImportedName]: ./path
// // [localName]: ./path# (default, first H1, regardless of its own importedName)
// // [localName]: ./path#importedName

// // TODO: create full parser of basic markdown syntax
// // - will be used to render to html, and track imports/exports and tags
// // - just parse headers and links for now
// // - expand to full markdown support in the future
// export function parseMD (content, map, rootFolders) {
// 	const references = content.match(/\[.*?\]: +.*/g) || [];
// 	const tags = `\n${content.trim()}\n`.match(/\s#\S+(?!\})/g) || [];
// 	const sections = `\n${content.trim()}\n`.split(/(?=\n#+ )/) || [];
// 	const hasMain = content.search(/(^|(\s*\n))#/) > 0;
// 	const imports = {};
// 	const refs = {};
// 	const rootPath = `/${rootFolders.join('/')}`;

// 	if (hasMain) {
// 		sections.shift().trim();
// 	}

// 	for (const string of tags) {
// 		const tag = string.slice(2);
// 		references.push(`[${tag}]: #${tag}`);
// 	}

// 	// create helper that covers the similarity in code between JS and MD
// 	// - maybe parse to AST here that matches types and prop names used by JS, then pass AST to common resolver
// 	// - also add helper for the inserting of default object/array if it hasn't yet been added, before adding items to it
// 	for (const reference of references) {
// 		const [alias, path, name = 'default'] = reference.match(/\[(.*?)\]: +(.*?)(?:#(.*))?$/).slice(1);
// 		const sourcePath = path ? getPath(rootFolders, path) : '/';
// 		let importObject = imports[sourcePath];

// 		if (!importObject) {
// 			importObject = {};
// 			imports[sourcePath] = importObject;
// 		}

// 		let importArray = importObject[name];

// 		if (!importArray) {
// 			importArray = [];
// 			importObject[name] = importArray;
// 			refs[alias] = importArray;
// 		}
// 	}

// 	for (const section of sections) {
// 		const [name, content] = section.match(/#+ +.+? *(?:\{#(.*?)\})?\n+(.*)\n*/).slice(1);

// 		if (!name) {
// 			continue;
// 		}

// 		let mapObject = map[rootPath];

// 		if (!mapObject) {
// 			mapObject = {};
// 			map[rootPath] = mapObject;
// 		}

// 		if (!mapObject[name]) {
// 			mapObject[name] = {};
// 		}

// 		const references = content.match(/\[.*?\]\[.+?\]/g) || [];
// 		const tags = `\n${content.trim()}\n`.match(/[^{]#\S+(?!\})/g) || [];

// 		for (const string of tags) {
// 			const tag = string.slice(2);
// 			references.push(`[][${tag}]`);
// 		}

// 		for (const reference of references) {
// 			const [alias] = reference.match(/\[.*?\]\[(.+?)\]/).slice(1);
// 			refs[alias]?.push?.(name);
// 		}
// 	}

// 	for (const [sourcePath, importObject] of Object.entries(imports)) {
// 		let mapObject = map[sourcePath];

// 		if (!mapObject) {
// 			mapObject = {};
// 			map[sourcePath] = mapObject;
// 		}

// 		for (const [importName, refArray] of Object.entries(importObject)) {
// 			let exportObject = mapObject[importName];

// 			if (!exportObject) {
// 				exportObject = {};
// 				mapObject[importName] = exportObject;
// 			}

// 			let fullRefArray = exportObject[rootPath];

// 			if (!fullRefArray) {
// 				fullRefArray = [];
// 				exportObject[rootPath] = fullRefArray;
// 			}

// 			for (const name of refArray) {
// 				if (fullRefArray.indexOf(name) === -1) {
// 					fullRefArray.push(name);
// 				}
// 			}
// 		}
// 	}

// 	return imports;
// }



// // TODO: allow custom parser, to support other types of code
// // - all file types need imports and references, exports, and optionally tags
// // - MD files do these with reference links, headers, and tags
// // - JS files do these with imports and variable references, exports, and maybe ALLCAPS text in comments

// // run tool within folder using defaults
// // > impulse

// // run using custom parser
// // > impulse parse.js

// /*
// module.exports.parse = function (content, type) {
// 	// move the map resolution outside of the parser
// }
// */
