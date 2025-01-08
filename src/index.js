// import { buildMap } from './parse';
import { renderList, renderImports } from './list';
import { renderTab } from './file';
import { renderMenu } from './menu';
import { getObject } from './common';
import { createState, onRender } from '@triplett/stew';

export const state = createState({
	tabs: [],
	imports: [],
	exports: [],
	nodes: {},
	files: {},
	showImports: true,
	showExports: true,
	showImportSettings: false,
	showExportSettings: false,
});

export function recallSession () {
	let impulse;

	try {
		impulse = JSON.parse(window.localStorage.getItem('impulse') || '{}');
	} catch (err) {
		window.localStorage.removeItem('impulse');
		impulse = {};
	}

	const { tabs = [{ index: 0, name: 'Impulse', scroll: 0 }], nodes = {}, files = {} } = impulse;
	Object.assign(state, { tabs, nodes, files });
}

export function storeSession () {
	const { tabs, nodes, files, map } = state;
	const impulse = { tabs, nodes, files, map };
	window.localStorage.setItem('impulse', JSON.stringify(impulse));
}

export const refs = {
	codeRef: [],
	filesRef: [],
};

export function getTab () {
	const { tabs } = state;
	const [{ index }] = tabs;
	return tabs[index + 1];
}

export function getPath (tab) {
	if (!tab) {
		tab = getTab() || [{}];
	}

	const [{ index }] = tab;
	return tab[index + 1];
}

function switchTab (tabIndex) {
	const { tabs } = state;
	tabs[0].index = tabIndex;
	state.tabs = [...tabs];

	const path = getPath();
	window.location.hash = path;

	storeSession();
}

function closeTab (tabIndex) {
	const { tabs } = state;
	const [{ index: activeTabIndex }] = tabs;
	tabs.splice(tabIndex + 1, 1);

	if (tabIndex < activeTabIndex || activeTabIndex > 0 && activeTabIndex >= tabs.length - 1) {
		tabs[0].index -= 1;
	}

	state.tabs = [...tabs];
	storeSession();
}

// show all locals first, regardless of whether they export
// - for MD: start with h2 tags, then embed lower h tags below those (only ones that have label (e.g. MD))
//   - have a final option at the end for citations (imports)
//     - expand to show headlines for imports in the order they were first used
// - for JS: show just the citations without having to expand
function getCitations (path, registry, focusedNames) {
	const { nodes } = state;
	const node = nodes[path];

	if (!node) {
		return [];
	}

	const { '': locals, ...imports } = node;
	const childEntries = [];
	const citations = [];

	for (const name of focusedNames) {
		const array = locals[name];

		if (!array) {
			continue;
		}

		const [info] = array;
		const [position, ...strings] = info.split(' ');
		const [range, parent] = position.split('#');
		const [start] = range.split('-');
		const heading = strings.join(' ');
		const entry = [Number(start), parent, name, heading];

		childEntries.push(entry);
	}
	
	childEntries.sort(([a], [b]) => a - b);

	for (const childEntry of childEntries) {
		const [, parent, name, heading] = childEntry;
		const hashPath = `${path}#${name}`;
		let child = registry[hashPath];

		if (child?.name === undefined) {
			if (!child) {
				child = {};
				registry[hashPath] = child;
			}

			const childCitations = [];
			child.path = `${path}#${name}`;
			child.name = name;

			if (name) {
				child.heading = heading;
			}

			for (const [path, object] of Object.entries(imports)) {
				const names = Object.keys(object).filter(importName => {
					return object[importName].indexOf(name) > 0;
				});

				const newCitations = getCitations(path, registry, names);
				childCitations.push(...newCitations);
			}

			if (childCitations.length) {
				child.citations = childCitations;
			}
		}

		if (name) {
			const parentHashPath = `${path}#${parent || ''}`;
			const node = getObject(registry, parentHashPath, {});
			const children = getObject(node, 'children', [])
			children.push(child);
		}
		
		citations.push(child);
	}

	return citations;
}

export function getImports (path, focusedNames = [], citations = {}) {
	const { nodes } = state;
	const node = nodes[path];

	if (!node) {
		return [];
	}

	const { '': locals } = node;
	const names = focusedNames.length ? focusedNames : Object.keys(locals);
	getCitations(path, citations, names);

	return citations[`${path}#`];
}








	// for (const [path, object] of Object.entries(imports)) {
	// 	if (path === '') {
	// 		continue;
	// 	}

	// 	const refs = {};

	// 	for (const [importName, array] of Object.entries(object)) {
	// 		for (const string of array.slice(1)) {
	// 			const [localName] = string.split(' ');

	// 			if (!focusedNames.has(localName)) {
	// 				continue;
	// 			}

	// 			const names = getObject(refs, localName, new Set());
	// 			names.add(importName);
	// 		}
	// 	}

	// 	for (const [name, names] of Object.entries(refs)) {
	// 		const nestedImport = getImports(path, names, [...visitedNames]);
	// 		const nestedObject = getObject(nestedImports, name, []);
	// 		nestedObject.push(nestedImport);
	// 	}
	// }
	
	// // TODO: put nested headlines under their parent using the # value after range
	// // - ones that don't point to a parent headline will exist in the top level children array
	// const children = .map(([, name, text]) => {
	// 	const child = { text, name };
	// 	const citations = nestedImports[name];

	// 	if (citations) {
	// 		child.citations = citations;
	// 	}

	// 	return child;
	// });

	// const citations = nestedImports[''] || [];
	// return { path, children, citations };

	// return { children, citations };
	


	// const paths = Object.keys(imports);
	// const nextDepth = depth + 1;
	// const newPaths = [];

	// for (const path of paths) {
	// 	if (path === rootPath || depthMap[path] !== undefined) {
	// 		continue;
	// 	}

	// 	depthMap[path] = [depth];
	// 	newPaths.push(path);
	// }

	// for (const path of newPaths) {
	// 	getImports(path, depthMap, nextDepth, rootPath);
	// }

	// if (Object.keys(depthMap).length === 0) {
	// 	return;
	// }

	// return depthMap;
// }

// show just the exports (not headlines)
// - for MD: expand to show variations
//   - also show a final option below exports to expand to show implementations
// - for JS: show just the implementations without having to expand them
function getExports (path, depthMap = {}, depth = 0, rootPath) {
	const { nodes } = state;
	const node = nodes[path];

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

function loadPath () {
	const { href, hash } = window.location;

	if (!hash && !href.endsWith('#')) {
		return;
	}

	const { files, tabs } = state;
	const path = hash.slice(1);
	const tabIndex = tabs.length - 1;

	if (path && !path.startsWith('/')) {
		return;
	}

	for (const [i, tab] of tabs.slice(1).entries()) {
		const [{ index }] = tab;
		const mainPath = tab[index + 1];

		if (mainPath === path) {
			switchTab(i);
			return;
		}
	}

	state.tabs = [
		{ ...tabs[0], index: tabIndex },
		...tabs.slice(1),
		[{ index: 0, name: path || 'Menu' }, path],
	];

	if (path && !files[path]) {
		files[path] = '';
	}
}

if (typeof window !== 'undefined') {
	window.onhashchange = () => {
		loadPath();
		storeSession();
	};
}

// show import list and info page for path that is found but not yet loaded
// - paths to folders should show the imports of all files inside it
// - paths to files should show the export list as well
// show info page and export list for module that is found
// - allow modules to live within project under an alias for their path, to support monorepos
// lists should have the option to toggle them to be split up by their imports/exports, with subdirectories underneath

function renderApp (memo) {
	const { tabs, files, showImports, showExports, showImportSettings, showExportSettings } = state;
	const [prevPath, prevFiles, prevImports, prevExports] = memo;
	const { codeRef } = refs;
	const { index: activeTabIndex } = tabs[0];
	const activeTab = getTab();
	const path = getPath() || '';
	const isFile = !!path;
	let imports = prevImports;
	let exports = prevExports;

	if (path !== prevPath || files !== prevFiles) {
		imports = getImports(path);
		exports = getExports(path);
		memo.splice(0, 4, path, files, imports, exports);

		// TODO: change stew to ignore boolean true, like it does for false, instead of keeping existing node?
		// - it messes with layouts that might have set true for a different expression
		// - use ref in layout instead, since those are seen as objects which are left alone
		// if (path && imports === prevImports && exports === prevExports) {
		// 	return true;
		// }
	}

	const tabPlacement = activeTabIndex === 0 ? tabs.length === 2 ? 'only' : 'first' : activeTabIndex === tabs.length - 2 ? 'last' : 'middle';
	const hasImports = showImports && imports;
	const hasExports = showExports && exports;

	onRender(() => {
		if (path !== prevPath) {
			const [input] = codeRef

			if (input) {
				if (path) {
					input.value = files[path];
				}

				input.focus();
				input.setSelectionRange(0, 0);
			}
		}
	});

	return ['div', { className: 'app' },
		activeTab && ['', null,
			['ul', { className: 'tabs' },
				['li', { className: `tab list-tab ${hasImports ? 'tab-active' : ''}` },
					['button', {
						className: 'tab-button',
						disabled: !imports || !isFile,
						onclick: () => state.showImports = !showImports,
					}, 'Imports'],
					['button', {
						className: 'tab-icon',
						onclick: () => state.showImportSettings = !showImportSettings,
					}, '☰'],
				],
				...tabs.slice(1).map((tab, i) => {
					return ['li', { className: `tab ${tab === activeTab ? 'tab-active' : ''} tab-${tabPlacement}` },
						['div', { className: 'tab-button-wrapper' },
							['button', {
								className: 'tab-button',
								onclick: () => switchTab(i),
							}, tab[0].name],
						],
						['button', {
							className: 'tab-icon',
							onclick: () => closeTab(i),
						}, '✕'],
					];
				}),
				['li', { className: `tab list-tab ${hasExports ? 'tab-active' : ''}` },
					['button', {
						className: 'tab-button',
						disabled: !exports || !isFile,
						onclick: () => state.showExports = !showExports,
					}, 'Exports'],
					['button', {
						className: 'tab-icon',
						onclick: () => state.showExportSettings = !showExportSettings,
					}, '☰'],
				],
			],
			['div', { className: 'editor-wrapper' },
				['div', { className: 'editor' },
					// TODO: fix stew issue where empty string (path) doesn't remove preview list element
					hasImports && renderImports(imports, showImportSettings, activeTab),
					path ? renderTab(activeTab, tabPlacement) : renderMenu(),
					hasExports && renderList(exports, 'exports', showExportSettings, activeTab),
				],
			],
		],
	];
}

if (typeof window !== 'undefined') {
	recallSession();
	loadPath();
	stew('#app', renderApp);
}
