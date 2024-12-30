// import { buildMap } from './parse';
import { renderList } from './list';
import { renderTab } from './file';
import { renderMenu } from './menu';

const { createState, onRender } = window.stew;

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

function getImports (path, depthMap = {}, depth = 0, rootPath) {
	const { nodes } = state;
	const node = nodes[path];

	if (!node) {
		return;
	}

	if (!rootPath) {
		rootPath = path;
	}

	const { '': locals, ...imports } = node;
	const paths = Object.keys(imports);
	const nextDepth = depth + 1;
	const newPaths = [];

	for (const path of paths) {
		if (path === rootPath || depthMap[path] !== undefined) {
			continue;
		}

		depthMap[path] = [depth];
		newPaths.push(path);
	}

	for (const path of newPaths) {
		getImports(path, depthMap, nextDepth, rootPath);
	}

	if (Object.keys(depthMap).length === 0) {
		return;
	}

	return depthMap;
}

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
	const hashPaths = new Set(Object.values(locals).map(array => array.filter(it => typeof it === 'string')).flat());
	const nextDepth = depth + 1;
	const newPaths = [];

	for (const hashPath of hashPaths) {
		const [path] = hashPath.split('#');

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

window.onhashchange = () => {
	loadPath();
	storeSession();
};

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
					hasImports && renderList(imports, 'imports', showImportSettings, activeTab),
					path ? renderTab(activeTab, tabPlacement) : renderMenu(),
					hasExports && renderList(exports, 'exports', showExportSettings, activeTab),
				],
			],
		],
	];
}

recallSession();
loadPath();
stew('#app', renderApp);
