import { parse as mapNodetoAST } from '@textlint/markdown-to-ast';
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

function processId (props, elements, ids) {
	const suffix = elements[elements.length - 1];

	if (typeof suffix !== 'string') {
		return;
	}

	const [hash, id] = suffix.match(/\s*\{#(.*?)\}\s*$/) || [];

	if (!hash) {
		return;
	}

	elements[elements.length - 1] = suffix.slice(0, -hash.length);

	if (ids.has(id)) {
		return;
	}

	props.id = id;
	ids.add(id);
}

function processExtended (elements, nameless) {
	const index = elements.findIndex(element => element?.[0] === 'br');
	const sequence = elements.splice(0, index === -1 ? elements.length : index);
	const [prefix] = sequence;

	if (typeof prefix !== 'string') {
		return sequence;
	}

	const [brackets, value] = prefix.match(/^\s*\[(.)\]\s+(?=\w)/) || [];

	if (brackets) {
		const checked = value === 'x';
		sequence[0] = prefix.slice(brackets.length);
		const input = ['input', { type: 'checkbox', checked }];
		const label = ['label', {}, ...sequence];
		nameless.push(input);
		labelMap.set(input, label);
		return [input, label];
	}
	
	return sequence;
}

const labelMap = new WeakMap();
const idSet = new WeakSet();

function parseNode (node, definitions, references, ids, nameless, path, tableAlign = [], i) {
	const { type, range, value, align = tableAlign, children = [] } = node;
	
	if (node.type === 'Str') {
		return value;
	}

	const [start] = range;
	const props = { key: start };

	switch (type) {
		case 'Definition': {
			const { label, url } = node;
	
			if (!Object.prototype.hasOwnProperty.call(definitions, label)) {
				definitions[label] = url;
			}
	
			return;
		}
		case 'Code': {
			return ['code', props, value];
		}
		case 'CodeBlock': {
			const { lang } = node;
			
			if (lang) {
				props['data-lang'] = lang;
			}

			return ['pre', props,
				['code', {}, value],
			];
		}
		case 'HorizontalRule': {
			return ['hr', props];
		}
		case 'Break': {
			return ['br', props];
		}
		case 'Image': {
			const { url, title, alt } = node;
			props.src = url;
			props.alt = alt;

			if (title !== null) {
				props.title = title;
			}

			return ['img', props];
		}
	}

	// TODO: put switch statement above this for ones that don't use children
	const childElements = [];
	
	for (const [i, child] of children.entries()) {
		const element = parseNode(child, definitions, references, ids, nameless, path, align, i);
	
		if (!element) {
			continue;
		} else if (typeof element !== 'string') {
			childElements.push(element);
			continue;
		}
		
		const lines = element.split('\n');

		for (const [j, line] of lines.entries()) {
			if (j) {
				childElements.push(['br', {}]);
			}

			if (line) {
				childElements.push(line);
			}
		}
	}

	switch (type) {
		case 'Document': {
			return ['', props, ...childElements];
		}
		case 'Header': {
			processId(props, childElements, ids);
			const { depth } = node;
			const { id = '' } = props;

			const header = [depth, props,
				['a', { href: `${path}#${id}` }, ...childElements],
			];

			if (id) {
				idSet.add(header);
			} else {
				nameless.push(header);
			}

			return header;
		}
		case 'Paragraph': {
			const elements = [];

			while (childElements.length) {
				const processedElements = processExtended(childElements, nameless);
				elements.push(...processedElements);

				if (!childElements.length) {
					break;
				}

				const [br] = childElements.splice(0, 1);
				elements.push(br);
			}

			return ['p', props, ...elements];
		}
		case 'List': {
			const { ordered, spread } = node;

			if (!spread) {
				for (const item of childElements) {
					const paragraph = item[2];

					if (item.length > 3 || paragraph?.[0] !== 'p') {
						continue;
					}

					item.splice(2, 1, ...paragraph.slice(2));
				}
			}

			const tag = ordered ? 'ol' : 'ul';
			return [tag, props, ...childElements];
		}
		case 'ListItem': {
			const { checked } = node;
			const item = ['li', props, ...childElements];

			if (checked !== null) {
				const [paragraph] = childElements;
				const labelElements = paragraph.splice(2);
				const input = ['input', { type: 'checkbox', checked }];
				const label = ['label', {}, ...labelElements];
				paragraph.push(input, label);
				nameless.push(input);
				labelMap.set(input, label);
			}

			return item;
		}
		case 'BlockQuote': {
			return ['blockquote', props, ...childElements];
		}
		case 'Emphasis': {
			return ['em', props, ...childElements];
		}
		case 'Strong': {
			return ['strong', props, ...childElements];
		}
		case 'Delete': {
			return ['del', props, ...childElements];
		}
		case 'Link': {
			const { url, title } = node;
			props.href = url;

			if (title !== null) {
				props.title = title;
			}

			return ['a', props, ...childElements];
		}
		case 'LinkReference': {
			const { label } = node;
			props.href = `#${label}`;
			const link = ['a', props, ...childElements];
			references.push(link);
			return link;
		}
		case 'Table': {
			const [head, ...body] = childElements;

			for (const cell of head.slice(2)) {
				cell[0] = 'th';
			}

			return ['table', props,
				['thead', {}, head],
				['tbody', {}, ...body],
			];
		}
		case 'TableRow': {
			return ['tr', props, ...childElements];
		}
		case 'TableCell': {
			const textAlign = tableAlign[i];

			if (textAlign) {
				props.style = `text-align:${textAlign};`;
			}

			return ['td', props, ...childElements];
		}
	}
}

export function parseMD (text, path = '') {
	const root = mapNodetoAST(text);
	const definitions = {};
	const references = [];
	const ids = new Set();
	const nameless = [];
	const fragment = parseNode(root, definitions, references, ids, nameless, path);
	let headerIndex = 0;
	let checkboxIndex = 0;

	for (const reference of references) {
		const props = reference[1];
		const label = props.href.slice(1);
		
		if (!Object.prototype.hasOwnProperty.call(definitions, label)) {
			continue;
		}

		props.href = definitions[label];
	}

	for (const element of nameless) {
		const [tag] = element;
		let id;

		if (typeof tag === 'number') {
			do {
				id = `header${headerIndex++}`;
			} while (ids.has(id))

			element[2][1].href += id;
		} else if (tag === 'input') {
			do {
				id = `checkbox${checkboxIndex++}`;
			} while (ids.has(id))

			const label = labelMap.get(element);
			label[1].for = id;
		}
		
		element[1].id = id;
	}

	return fragment;
}

export function findByType (candidates, expectedTag) {
	const matches = [];

	for (const candidate of candidates) {
		if (!Array.isArray(candidate)) {
			continue;
		}

		const [tag, props, ...children] = candidate;

		if ('key' in props && (tag === expectedTag || expectedTag === 'h' && typeof tag === 'number')) {
			matches.push(candidate);
		}

		const additions = findByType(children, expectedTag);
		matches.push(...additions);
	}

	return matches;
}

function getText (element) {
	if (!Array.isArray(element)) {
		return element;
	} else if (element[0] === 'br') {
		return ' ';
	}

	return element.slice(2).map(getText).join('');
}

// TODO: change this to accpt result of parseMD
// - have key prop store range string 'start-finish'
// - have id prop store id for headings
// - have definitions prop of root fragment store definition data (label: url)
export function mapNode (layout, prevStart) {
	const children = layout.slice(2);
	const headings = findByType(children, 'h');
	const links = findByType(children, 'a');
	const snips = [];

	for (let i = headings.length - 1; i >= 0; i--) {
		const heading = headings[i];
		const [depth, props] = heading;
		const { key: start, id } = props;
		const text = getText(heading).trim().replace(/\s\s+/, ' ');
		const isExport = idSet.has(heading);
		const snip = [start, prevStart, depth, text, id, isExport];
		snips.unshift(snip);
		prevStart = start;

		const linkIndex = links.findLastIndex(link => link[1].key >= start);
		const snipLinks = linkIndex === -1 ? [] : links.splice(linkIndex);
		snip.push(...snipLinks);
	}

	snips.push([0, prevStart, 0, '', '', false, ...links]);
	const imports = {};
	const locals = {};
	const exports = [];
	const stack = [];

	for (const snip of snips) {
		const [start, finish, depth, text, id, isExport, ...links] = snip;

		for (const link of links) {
			const url = link[1].href;
			const [, path = '.', name = ''] = url.match(/^([./].*?)?(?:#(.*?))?$/);
			const location = getObject(imports, path, {});
			const remote = getObject(location, name, []);
			remote.push(id);
		}

		stack.splice(0, stack.length - depth + 1, id);
		const parent = stack[1];
		const info = `${start}-${finish}${parent ? `#${parent}` : ''}${text ? ` ${text}` : ''}`;
		locals[id] = info;

		if (!isExport) {
			continue;
		}

		exports.push(id);
	}

	if (exports.length) {
		locals[''] += ` ${exports.join(' ')}`;
	}

	return { ...imports, '': locals };
	
	// const definitions = findByType(children, 'Definition');
	// // const snips = findByType(children, 'Header');
	// // const links = findByType(children, 'Link');
	// const references = findByType(children, 'LinkReference');
	// headings.unshift({ range: [0], children: [] });





	// for (const node of definitions) {
	// 	const { label, url } = node;

	// 	if (urls[label]) {
	// 		continue;
	// 	}

	// 	urls[label] = url;
	// }
	
	// for (let i = headings.length - 1; i >= 0; i--) {
	// 	const snip = headings[i];
	// 	const { range } = snip;
	// 	const [rangeStart] = range;

	// 	processIdOld(snip);
	// 	range[1] = prevStart;
	// 	prevStart = rangeStart;

	// 	const linkIndex = links.findLastIndex(({ range }) => range[0] >= rangeStart);
	// 	const snipLinks = linkIndex === -1 ? [] : links.splice(linkIndex);

	// 	const referenceIndex = references.findLastIndex(({ range }) => range[0] >= rangeStart);
	// 	const snipReferences = referenceIndex === -1 ? [] : references.splice(referenceIndex);

	// 	for (const reference of snipReferences) {
	// 		const { label } = reference;
	// 		const url = urls[label];

	// 		if (!url) {
	// 			continue;
	// 		}

	// 		snipLinks.push({ url });
	// 	}

	// 	Object.assign(snip, {
	// 		text: getText(snip),
	// 		links: snipLinks,
	// 	});
	// }
	
	// const imports = {};
	// const locals = {};
	// const stack = [];
	// let index = 0;

	// for (const snip of headings) {
	// 	const { range, depth, text, id = '', links } = snip;
	// 	const [start, finish] = range;
	// 	let key = id;
	
	// 	if (depth && (!key || locals[key])) {
	// 		while (locals[index]) {
	// 			index++;
	// 		}

	// 		key = String(index);
	// 	}

	// 	for (const link of links) {
	// 		const { url } = link;
	// 		const [, path = '.', name = ''] = url.match(/^([./].*?)?(?:#(.*?))?$/);
		
	// 		const location = getObject(imports, path, {});
	// 		const remote = getObject(location, name, []);
	// 		remote.push(key);
	// 	}

	// 	stack.splice(0, stack.length - depth + 1, key);
	// 	const parent = stack[1];
	// 	const info = `${start}-${finish}${parent ? `#${parent}` : ''}${text ? ` ${text}` : ''}`;
	// 	locals[key] = info;

	// 	if (!id || key !== id) {
	// 		continue;
	// 	}

	// 	locals[''] += ` ${id}`;
	// }

	// return { ...imports, '': locals };
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
			return mapNode(text);
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
// export function mapNode (content, map, rootFolders) {
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
