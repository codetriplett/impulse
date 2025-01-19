// import { buildMap } from './parse';
// import { renderList, renderImports } from './list';
// import { renderTab } from './file';
// import { renderMenu } from './menu';
import { parse } from './parse';
import { updateNode } from './map';
import { getObject } from './common';
import { processId, findByType } from './parse';
import { createState, onRender } from '@triplett/stew';
import { parse as parseMDtoAST } from '@textlint/markdown-to-ast';

const { pathname, hash } = window.location;

export const state = createState({
	// imports: [],
	// exports: [],
	files: {},
	map: {},
	hash,
	path: `${pathname}${hash || '#'}`,
	snips: [],
	isLeftNavExpanded: true,
	isRightNavExpanded: true,
});

function updateFile (path, text, type) {
	if (type !== 'md') {
		return;
	}

	const { map } = state;
	const node = parse(text, 'md');
	updateNode(map, path, node);
}

export function recallSession () {
	let files, map, snips, settings;

	try {
		files = JSON.parse(window.localStorage.getItem('impulse:files') || '{}');
		map = JSON.parse(window.localStorage.getItem('impulse:map'));
		snips = JSON.parse(window.localStorage.getItem('impulse:snips') || '[]');
		settings = JSON.parse(window.localStorage.getItem('impulse:settings') || '{}');
	} catch (err) {
		window.localStorage.removeItem('impulse:files');
		window.localStorage.removeItem('impulse:map');
		window.localStorage.removeItem('impulse:snips');
		window.localStorage.removeItem('impulse:settings');
		files = {};
		snips = [];
		settings = {};
	}

	Object.assign(state, { files, map, snips, settings });

	if (!map) {
		map = {};
		state.map = map;

		for (const [path, text] of Object.entries(files)) {
			if (!text) {
				delete files[path];
				continue;
			}

			updateFile(path, text, 'md');
		}

		window.localStorage.setItem('impulse:map', JSON.stringify(map));
	}
}

export function storeSession () {
	const { files, map, snips } = state;
	window.localStorage.removeItem('impulse:map'); // in case the localStorage limit is reached
	window.localStorage.setItem('impulse:files', JSON.stringify(files));
	window.localStorage.setItem('impulse:map', JSON.stringify(map));
	window.localStorage.setItem('impulse:snips', JSON.stringify(snips));
}

// show all locals first, regardless of whether they export
// - for MD: start with h2 tags, then embed lower h tags below those (only ones that have label (e.g. MD))
//   - have a final option at the end for citations (imports)
//     - expand to show headlines for imports in the order they were first used
// - for JS: show just the citations without having to expand
function getCitations (path, registry, focusedNames) {
	const { map } = state;
	const node = map[path];

	if (!node) {
		return [];
	}

	const { '': locals, ...imports } = node;
	const includeNames = focusedNames || Object.keys(locals);
	const childEntries = [];
	const citations = [];

	for (const name of includeNames) {
		const array = locals[name];

		if (!array) {
			continue;
		}

		const [info] = array;
		const [position, ...strings] = info.split(' ');
		const [range, parent] = position.split('#');
		const [start, finish] = range.split('-');
		const heading = strings.join(' ');
		const entry = [Number(start), Number(finish), parent, name, heading];

		childEntries.push(entry);
	}
	
	childEntries.sort(([a], [b]) => a - b);

	for (const childEntry of childEntries) {
		const [start, finish, parent, name, heading] = childEntry;
		const hashPath = `${path}#${name}`;
		let child = registry[hashPath];

		if (!child) {
			child = {};
			registry[hashPath] = child;
		}

		citations.push(child);

		if (child.name !== undefined) {
			continue;
		}

		const childCitations = [];

		Object.assign(child, {
			path: `${path}#${name}`,
			name: name,
			start: start,
			finish: finish,
		});

		if (name) {
			child.heading = heading;
		}

		for (const [path, object] of Object.entries(imports)) {
			const names = Object.keys(object).filter(importName => {
				return object[importName].indexOf(name) !== -1;
			});

			const newCitations = getCitations(path, registry, names);
			childCitations.push(...newCitations);
		}

		if (childCitations.length) {
			child.citations = childCitations;
		}

		if (name) {
			const parentHashPath = `${path}#${parent || ''}`;
			const node = getObject(registry, parentHashPath, {});
			const children = getObject(node, 'children', [])
			children.push(child);
		}
	}

	return citations;
}

// show just the exports (not headlines)
// - expand to show the headlines of snips that mention the export
// - this can be used to manage a basic todo list, where a slightly modified tag is used to tag ones that have been completed
function getMentions (path, depthMap = {}, depth = 0, rootPath) {
	const { map } = state;
	const node = map[path];

	if (!node) {
		return;
	}

	if (!rootPath) {
		rootPath = path;
	}
	
	const { '': locals } = node;
	const hashPaths = new Set(Object.values(locals).map(array => array.slice(1)).flat());
	const nextDepth = depth + 1;
	const newPaths = [];

	for (const hashPath of hashPaths) {
		const [firstPart] = hashPath.split(' ');
		const [path] = firstPart.split('#');

		if (path === rootPath || depthMap[path] !== undefined) {
			continue;
		}

		depthMap[path] = [depth];
		newPaths.push(path);
	}

	for (const path of newPaths) {
		getExports(path, depthMap, nextDepth, rootPath);
	}

	return depthMap;
}

// function loadPath () {
// 	const { href, hash } = window.location;

// 	if (!hash && !href.endsWith('#')) {
// 		return;
// 	}

// 	const { files, tabs } = state;
// 	const path = hash.slice(1);
// 	const tabIndex = tabs.length - 1;

// 	if (path && !path.startsWith('/')) {
// 		return;
// 	}

// 	for (const [i, tab] of tabs.slice(1).entries()) {
// 		const [{ index }] = tab;
// 		const mainPath = tab[index + 1];

// 		if (mainPath === path) {
// 			switchTab(i);
// 			return;
// 		}
// 	}

// 	state.tabs = [
// 		{ ...tabs[0], index: tabIndex },
// 		...tabs.slice(1),
// 		[{ index: 0, name: path || 'Menu' }, path],
// 	];

// 	if (path && !files[path]) {
// 		files[path] = '';
// 	}
// }

if (typeof window !== 'undefined') {
	window.onhashchange = () => {
		const { pathname, hash } = window.location;
		const path = `${pathname}${hash || '#'}`;

		Object.assign(state, {
			hash,
			path,
		});
	};
}

// show import list and info page for path that is found but not yet loaded
// - paths to folders should show the imports of all files inside it
// - paths to files should show the export list as well
// show info page and export list for module that is found
// - allow modules to live within project under an alias for their path, to support monorepos
// lists should have the option to toggle them to be split up by their imports/exports, with subdirectories underneath

let definitions;

function renderLeftMenuChild (child) {
	const { path, heading, children } = child;

	return ['li', null,
		['button', {
			className: 'child-button',
			onclick: () => {
				const [, hash = ''] = path.split(/(?=#)/);
				window.location.hash = hash;
			},
		}, heading],
		!children?.length ? null : renderChildren(children),
	];
}

function renderChildren (children) {
	return ['ul', { className: 'children' },
		...children.map(renderLeftMenuChild),
	];
}

function scopeTree (allNodes, ...ranges) {
	return allNodes.filter(node => {
		const { type, range } = node;
		return type === 'Definition' || ranges.some(([start, end]) => range[0] >= start && range[1] <= end);
	});
}

function renderCitation (hashPath, manifest) {
	const { path, snips } = state;

	if (hashPath === path) {
		return;
	}

	const isActive = allCitations.values().some(citation => hashPath === citation.path);

	return memo => {
		const [path] = hashPath.split('#');

		if (hashPath !== memo[0]) {
			const { files } = state;
			const { start, finish } = manifest[hashPath];
			const file = files[path];
			const astNodes = parseMDtoAST(file).children;
			const scopedNodes = scopeTree(astNodes, [start, finish]);
			memo[0] = hashPath;
			memo[1] = scopedNodes;
			memo[2] = prepareDefinitions(astNodes);
		}

		const [scopedNodes, definitions] = memo.slice(1);

		return ['div', { className: `snip ${isActive ? '' : 'snip-inactive'}` },
			['button', {
				className: 'close',
				onclick: () => {
					const index = snips.indexOf(path);
					const newSnips = [...snips];
					newSnips.splice(index, 1);
					state.snips = newSnips;
					storeSession();
				},
			}, '✕'],
			...scopedNodes.map(node => renderAstNode(node, definitions, path)),
		];
	};
}

let allCitations;

function renderLeftMenu (manifest, pathname, ...hashes) {
	const { snips } = state;
	let { children = [] } = manifest[`${pathname}#`] || {};

	if (children.length === 1) {
		const { children: nestedChildren = [], name } = children[0];
		children = nestedChildren;

		if (hashes.indexOf('') !== -1) {
			hashes.push(`#${name}`);
		}
	}

	allCitations = new Set(hashes.map(hash => {
		const { citations = [] } = hash && manifest[`${pathname}${hash}`] || {};
		return citations;
	}).flat());

	return ['div', {
		className: 'navigation',
	},
		renderChildren(children),
		['ul', { className: 'citations' },
			...allCitations.values().map(citation => {
				const { path, heading } = citation;
				const pathIndex = snips.indexOf(path);

				return ['li', null,
					['button', {
						className: `citation-button ${pathIndex !== -1 ? 'citation-button-active' : ''}`,
						onclick: () => {
							const newSnips = [...snips];

							if (pathIndex === -1) {
								newSnips.push(path);
							} else {
								newSnips.splice(pathIndex, 1);
							}

							Object.assign(state, {
								snips: newSnips,
								isRightNavExpanded: true,
							});

							storeSession();
						},
					}, heading],
				];
			}),
		],
	];
}

function renderRightMenu (manifest) {
	const { path, snips } = state;

	if (snips.length === 0 || snips.length === 1 && snips[0] === path) {
		return;
	}

	return ['ul', {
		className: 'snips',
	},
		...snips.map(path => renderCitation(path, manifest)),
	];
}

let headerIndex = 0;

function renderAstNode (node, definitions, remotePath = '') {
	const { type, children } = node;

	if (type === 'Header') {
		processId(node);
	}

	const childElements = children ? children.map(node => renderAstNode(node, definitions, remotePath)) : [];

	switch (type) {
		case 'Header': {
			const { id = headerIndex++, depth } = node;

			return [depth, { id },
				['a', { href: `${remotePath}#${id}` }, ...childElements],
			];
		}
		case 'Paragraph': {
			return ['p', null, ...childElements];
		}
		case 'Str': {
			const { value } = node;
			return value;
		}
		case 'LinkReference': {
			const { label } = node;
			const href = definitions[label];

			if (!href) {
				return;
			}

			return ['a', {
				href,
			}, ...childElements];
		}
	}
}

// TODO: render immediate mentions, but include mentions of mentions when expanded

// TODO: finish right nav, with similar behavior as left nav (tag hierarchy on right, mentions below)

// TODO: try parallel mode which displays two docs side by side, and  lines up snips with identical ids
// - useful for studying parallel histories, e.g. events by year
// - use hash as path

// TODO: tag overview, #tag
// - from home page path

// TODO: edit mode, #/path/to/file
// - from home page path
// - edit file directly

// TODO: CMS, /path/to/template#/path/to/page
// - will render form and preview of page (if there is a js file at path to page)
// - js file will accept json as props and returns either string or object (to use directly in DOM), or Array or function (to render with stew)

function resizeTextarea (ref) {
	const [textarea] = ref;
	textarea.style.height = '0px';
	const { scrollHeight } = textarea;
	textarea.style.height = `${scrollHeight}px`;
}

function renderEditor (memo) {
	const { files, hash } = state;
	const [prevHash] = memo;
	const path = hash.slice(1);
	const ref = [];

	if (hash !== prevHash) {
		memo[0] = hash;
		memo[1] = files[path];
	}

	const file = memo[1];

	onRender(() => {
		resizeTextarea(ref);
	});

	return ['div', {
		className: 'app',
	},
		['div', {
			className: 'main',
		},
			['textarea', {
				className: 'editor',
				ref,
				onkeydown: () => {
					resizeTextarea(ref);
				},
				onkeyup: () => {
					resizeTextarea(ref);
				},
			}, file],
			['button', {
				className: 'save',
				onclick: () => {
					const [textarea] = ref;
					updateFile(path, textarea.value, 'md');
					storeSession();
					window.location.reload();
				},
			}, '🖫'],
		],
	];
}

function prepareDefinitions (astNodes) {
	const definitionNodes = findByType(astNodes, 'Definition');
	const definitions = {};

	for (const node of definitionNodes) {
		const { label, url } = node;
		definitions[label] = url;
	}

	return definitions;
}

// TODO: render markdown if exists in file, otherwise use path to fetch js file to render HTML
function renderPage (memo) {
	const { files, hash, path, isLeftNavExpanded, isRightNavExpanded, snips } = state;
	const { pathname } = window.location;
	const [prevPath, prevHash] = memo;

	if (pathname !== prevPath || hash !== prevHash) {
		memo[0] = pathname;
		memo[1] = hash;

		if (pathname !== prevPath) {
			const file = files[pathname];
			const astNodes = parseMDtoAST(file).children;
			memo[2] = astNodes; // TODO: process id on headers (remove from string and add id prop)
			memo[3] = prepareDefinitions(astNodes);
		}

		const manifest = {};
		memo[4] = manifest;
		getCitations(pathname, manifest);
		// getMentions(pathname, citations);
	}

	const [astNodes, definitions, manifest] = memo.slice(2);
	headerIndex = 0;

	return ['div', {
		className: 'app',
	},
		isLeftNavExpanded && renderLeftMenu(manifest, pathname, hash),
		['div', {
			className: 'main',
		},
			['button', {
				className: 'expand-left',
				onclick: () => {
					state.isLeftNavExpanded = !isLeftNavExpanded;
				},
			}, '≡'],
			snips.length > 0 && (snips.length > 1 || snips[0] !== path) && ['button', {
				className: 'expand-right',
				onclick: () => {
					state.isRightNavExpanded = !isRightNavExpanded;
				},
			}, '#'],
			...astNodes.map(node => renderAstNode(node, definitions)),
		],
		isRightNavExpanded && renderRightMenu(manifest),
	];
}

function renderHomePage (memo) {
	return ['p', null, 'Home Page'];
}

function renderMap (memo) {
	return ['p', null, 'map'];
}

function renderForm (memo) {
	return ['p', null, 'form'];
}

function renderApp (memo) {
	const { hash} = state;
	const { pathname } = window.location;

	if (pathname !== '/') {
		if (!hash || !hash.startsWith('#/')) {
			return renderPage;
		} else {
			return renderForm;
		}
	} else {
		if (!hash || hash === '#') {
			return renderHomePage;
		} else if (hash.startsWith('#/')) {
			return renderEditor;
		}
	}

	return renderMap;
}

if (typeof window !== 'undefined') {
	recallSession();

	const root = document.querySelector(':root');
	const { theme = 'dark' } = state.settings;

	if (theme === 'dark') {
		root.style.setProperty('--page-background', '#333');
		root.style.setProperty('--paper-background', '#222');
		root.style.setProperty('--paper-shadow', '#111');
		root.style.setProperty('--paper-font-color', '#ccc');
		root.style.setProperty('--paper-inactive-background', '#333');
		root.style.setProperty('--button-background', '#444');
		root.style.setProperty('--button-border-color', '#555');
		root.style.setProperty('--button-font-color', '#777');
		root.style.setProperty('--button-hover-background', '#555');
		root.style.setProperty('--button-hover-border-color', '#666');
		root.style.setProperty('--button-hover-font-color', '#777');
		root.style.setProperty('--navigation-font-color', '#ccc');
		root.style.setProperty('--reference-font-color', '#999');
		root.style.setProperty('--reference-active-background', '#555');
		root.style.setProperty('--divider-color', '#777');
		root.style.setProperty('--link-font-color', '#4b4bde');
		root.style.setProperty('--link-visited-font-color', '#8d54c1');
	}

	stew('#app', renderApp);
}
