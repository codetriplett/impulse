import { Parser } from 'acorn';
import jsx from 'acorn-jsx';
import { getObject } from './common';

const jsxExt = jsx();

const options = {
	ecmaVersion: 'latest',
	sourceType: 'module',
};

export function cleanMap (map, path) {
	for (const [name, imports] of Object.entries(node)) {
		const location = map[name];

		for (const name in imports) {
			location[name].delete(path)
		}
	}
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

function parseJS (text) {
	const { body } = Parser.extend(jsxExt).parse(text, options);
	const imports = {};
	const refs = {};
	const rootPath = `/${folders.join('/')}`;

	console.log(body);

	return imports;
}

export function parseMD (text) {
	const references = text.match(/\[.*?\]: +.*/g) || [];
	const tags = `\n${text.trim()}\n`.match(/\s#\S+(?!\})/g) || [];
	const sections = `\n${text.trim()}\n`.split(/(?=\n#+ )/) || [];
	const hasMain = text.search(/(^|(\s*\n))#/) > 0;
	const imports = {};
	const exports = {};
	const locals = [];
	const refs = {};

	if (hasMain) {
		sections.shift().trim();
	}

	for (const string of tags) {
		const tag = string.slice(2);
		references.push(`[${tag}]: #${tag}`);
	}

	// create helper that covers the similarity in code between JS and MD
	// - maybe parse to AST here that matches types and prop names used by JS, then pass AST to common resolver
	// - also add helper for the inserting of default object/array if it hasn't yet been added, before adding items to it
	for (const reference of references) {
		let [alias, path, name] = reference.match(/\[(.*?)\]: +(.*?)(?:#(.*))?$/).slice(1);
		const sourcePath = path || '/';
		const importObject = getObject(imports, sourcePath, {});

		if (!name) {
			name = alias;
		}

		const importArray = getObject(importObject, name, []);
		refs[alias] = importArray;
	}

	for (const section of sections) {
		const [name, content] = section.match(/#+ +.+? *(?:\{#(.*?)\})?\n+(.*)\n*/).slice(1);

		if (!name) {
			continue;
		}

		// TODO: rewrite this to be a while loop that searches for next header
		// - this way it will know its position to mark the start and finish character indexes
		const index = locals.length;
		locals.push([0, 0]);
		exports[name] = index;

		const references = content.match(/\[.*?\]\[.+?\]/g) || [];
		const tags = `\n${content.trim()}\n`.match(/[^{]#\S+(?!\})/g) || [];

		for (const string of tags) {
			const tag = string.slice(2);
			references.push(`[][${tag}]`);
		}

		for (const reference of references) {
			const [alias] = reference.match(/\[.*?\]\[(.+?)\]/).slice(1);
			refs[alias]?.push?.(index);
		}
	}

	imports[''] = exports;
	return [imports, ...locals];
}

// TODO: allow override parse and render functions when running the CLI command
// - can put path to file that module.exports overrides after impulse command
// - onParse and onRender can also be added to modify the default results from here
export function parse (text, type) {
	let node;

	switch (type) {
		case 'js': {
			node = parseJS(text);
			break;
		}
		case 'md': {
			node = parseMD(text);
			break;
		}
	}

	node.unshift(type);
	return node;
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
