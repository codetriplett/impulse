import { buildMap } from './parse';
import { renderList } from './list';
import { createFile, loadFile, saveFile, renderTab } from './file';
import { renderMenu } from './menu';

const { createState, onRender } = window.stew;

export const state = createState({
	tabs: [],
	nodes: {},
	files: {},
	map: {},
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
	const map = buildMap(nodes);
	Object.assign(state, { tabs, nodes, files, map });
}

export function storeSession () {
	const { tabs, nodes, files, map } = state;
	const impulse = { tabs, nodes, files, map };
	window.localStorage.setItem('impulse', JSON.stringify(impulse));
}

export const refs = {
	pathRef: [],
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

	const names = Object.keys(node);

	for (const name of names) {
		if (name === rootPath || depthMap[name] !== undefined) {
			continue;
		}

		depthMap[name] = depth;
		getImports(name, depthMap, depth + 1, rootPath);
	}

	if (Object.keys(depthMap).length === 0) {
		return;
	}

	return depthMap;
}

function getExports (path, depthMap = {}, depth = 0, rootPath) {
	const { map } = state;
	const location = map[path];

	if (!location) {
		return;
	}

	if (!rootPath) {
		rootPath = path;
	}

	for (const set of Object.values(location)) {
		for (const name of set) {
			if (name === rootPath || depthMap[name] !== undefined) {
				continue;
			}

			depthMap[name] = depth;
			getExports(name, depthMap, depth + 1, rootPath);
		}
	}

	return depthMap;
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
	const { pathRef, codeRef } = refs;
	const { index: activeTabIndex, name: projectName } = tabs[0];
	const activeTab = getTab();
	const path = getPath() || '';
	const isInitial = memo.length === 0;
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
		if (isInitial && path) {
			loadFile(path);
		}

		if (path !== prevPath) {
			const [input] = path ? codeRef : pathRef;

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
		['form', {
			className: 'form',
			onsubmit: event => {
				event.preventDefault();

				// TODO: have action bar open new tab
				// - each tab holds its own textarea stack
				// - save should be automatic when text is changed (with debounce)
				// - have user choose when to close tabs

				const { tabs } = state;
				const [pathInput] = pathRef;
				const path = pathInput.value;
				const tabIndex = tabs.length - 1;
				pathInput.value = '';

				state.tabs = [
					{ ...tabs[0], index: tabIndex },
					...tabs.slice(1),
					[{ index: 0, name: path || 'Menu' }, path],
				];

				if (path && !files[path]) {
					files[path] = '';
				}
				
				storeSession();
			},
		},
			['div', { className: 'action-bar' },
				['h1', { className: 'project-name' }, projectName],
				['input', {
					className: 'action-input',
					type: 'text',
					ref: pathRef,
					onkeyup: () => {
						const [pathInput] = pathRef;
						Object.assign(state, { path: pathInput.value });
					},
				}],
				['input', {
					className: 'action-button',
					type: 'submit',
					value: 'Load',
				}],
			],
		],
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
					hasImports && renderList(imports, 'imports', showImportSettings),
					path ? renderTab(activeTab, tabPlacement) : renderMenu(),
					hasExports && renderList(exports, 'exports', showExportSettings),
				],
			],
		],
	];
}

recallSession();
stew('#app', renderApp);
