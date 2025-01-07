import { parse as parseMDtoAST } from '@textlint/markdown-to-ast';
import { Parser } from 'acorn';
import jsx from 'acorn-jsx';
import { getObject } from './common';

const jsxExt = jsx.default();
// const jsxExt = jsx();

const options = {
	ecmaVersion: 'latest',
	sourceType: 'module',
};

// export function cleanMap (map, path) {
// 	for (const [name, imports] of Object.entries(node)) {
// 		const location = map[name];

// 		for (const name in imports) {
// 			location[name].delete(path)
// 		}
// 	}
// }

// export function buildMap (nodes) {
// 	const map = {};

// 	for (const [rootPath, imports] of Object.entries(nodes)) {
// 		for (const [sourcePath, exports] of Object.entries(imports)) {
// 			let mapLocation = map[sourcePath];

// 			if (!mapLocation) {
// 				mapLocation = {};
// 				map[sourcePath] = mapLocation;
// 			}

// 			for (const importedName in exports) {
// 				let mapEntry = mapLocation[importedName];

// 				if (!mapEntry) {
// 					mapEntry = new Set();
// 					mapLocation[importedName] = mapEntry;
// 				}

// 				mapEntry.add(rootPath);
// 			}
// 		}
// 	}

// 	return map;
// }

function processNode (node, imports, locals, exports) {
	const { type } = node;

	// switch (type) {
	// 	case ''
	// }
}

export function parseJS (text) {
	const { body } = Parser.extend(jsxExt).parse(text, options);
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

function processHeaderId (header) {
	const { children } = header;
	const lastChild = children[children.length - 1];
	const { type, loc, range, value } = lastChild;

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

	return id;
}

function processText (node) {
	const { children } = node;
	let text = '';

	for (const node of children) {
		const { type } = node;

		switch (type) {
			case 'Link': {
				text += processText(node);
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

function findByType (candidateNodes, expectedType) {
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

// TODO 2) allow number prefixes and suffixes on hash values as an attribute
// - e.g. abc123 (item '123' within 'abc' group)
// - a number prefix can also be included
// - e.g. 0type123 (subitem '0' within abc123)
// - when resolving a hash...
//   - first try to find an exact match
//   - then a match with the prefix removed
//     - if found, add subitem to found item
//   - then a match with the suffix removed as well
//     - if found, add item (and subitem if needed) to group
// - might need to extend MD syntax to put prefix/suffix numbers on reference instead of import
//   - e.g. [Custom Header][0main123], where main was an import
//   - e.g. or maybe use {#0main123} as shorthand for [Header #123.0][main], where Header text is pulled from remote file Header
// - HOW WOULD THESE GET STORED IN NODES?
//   - maybe just reference #0main123 in locals arrays (would have to store 'main' alias in import array though)
//   - maybe locals should store a label string as well to make it easier to generate navs and fill in the Header text
//     - reparsing MD should only be necessary when rendering its content
export function parseMD (text) {
	const tree = parseMDtoAST(text);
	const { children } = tree;
	const imports = {};
	const locals = {};
	const exports = [];
	const refs = {};
	const fileRefs = {};
	const numberRefs = {};
	let prevStart = text.length;
	let nextKeyIndex = 0;

	const definitionNodes = findByType(children, 'Definition');
	const headerNodes = findByType(children, 'Header').reverse();
	const referenceNodes = findByType(children, 'LinkReference').reverse();

	for (const node of definitionNodes) {
		const { range, label, url } = node;
		const match = url.match(/^([./].*?)?(?:#(.*?)(\d*?))?$/);

		if (imports[label] || !match) {
			continue;
		}

		const [path = '.', name, number] = match.slice(1);
		const rangeString = range.slice(0, 2).join('-');
		const importObject = getObject(imports, path, {});
		const importRef = getObject(importObject, name || '', [rangeString]);
		refs[label] = importRef;
		fileRefs[label] = importObject;
		numberRefs[label] = number;
	}

	for (const node of headerNodes) {
		const { range = [0] } = node || {};
		const rangeStart = range[0];
		const referenceIndex = referenceNodes.findIndex(({ range }) => range[0] < rangeStart);
		const referenceCount = referenceIndex === -1 ? referenceNodes.length : referenceIndex;
		const references = referenceNodes.splice(0, referenceCount).reverse();
		const id = node ? processHeaderId(node) : '';
		const text = node ? processText(node) : '';

		Object.assign(node, { id, text, references, end: prevStart });
		prevStart = rangeStart;
	}

	const headerStack = [];
	headerNodes.reverse();

	for (const node of headerNodes) {
		const { range, depth, id, text, references, end } = node;
		let key = id;

		if (!key || locals[key]) {
			while (locals[nextKeyIndex]) {
				nextKeyIndex++;
			}

			key = String(nextKeyIndex);
		}

		headerStack.splice(0, headerStack.length - depth + 1, key);
		const parentKey = headerStack[1];

		const localArray = [`${range[0]}-${end}${parentKey ? `#${parentKey}` : ''}${text && ` ${text}`}`];
		locals[key] = localArray;

		if (key === id) {
			exports.push(key);
		}

		for (const node of references) {
			const { label } = node;
			const text = processText(node);
			let [, hash, name = '', number] = text.match(/(?:#((.*?)(\d*?)))?\s*$/);
			let ref = refs[label];

			if (hash) {
				const importObject = fileRefs[label];

				if (name) {
					ref = importObject ? getObject(importObject, name, ref.slice(0, 1)) : undefined;
				}
			} else {
				number = numberRefs[label];
			}

			if (!ref) {
				continue;
			}

			let keyIndex = ref.findIndex(keyString => (new RegExp(`^${key}( |$)`)).test(keyString));

			if (keyIndex === -1) {
				ref.push(key);
				keyIndex = 1;
			}

			if (number && !(new RegExp(` ${number}( |$)`)).test(ref[keyIndex])) {
				const parts = ref[keyIndex].split(' ');
				parts.push(number);
				ref[keyIndex] = parts.join(' ');
			}
		}
	}

	return {
		...imports,
		'': {
			'': [`0-${prevStart}${exports.length ? ` ${exports.join(' ')}`: ''}`],
			...locals,
		},
	};
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
