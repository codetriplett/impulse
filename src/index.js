// import { buildMap } from './parse';
// import { renderList, renderImports } from './list';
// import { renderTab } from './file';
// import { renderMenu } from './menu';
import { parse } from './parse';
import { updateNode } from './map';
import { getObject } from './common';
import { processId } from './parse';
import { createState, onRender } from '@triplett/stew';
import { parse as parseMDtoAST } from '@textlint/markdown-to-ast';

export const state = createState({
	// imports: [],
	// exports: [],
	files: {},
	map: {},
	visibleNodes: [],
	expandedCitations: [],
	expandedMentions: [],
	isLeftNavExpanded: true,
	isRightNavExpanded: false,
});

export function recallSession () {
	let files, map;

	try {
		files = JSON.parse(window.localStorage.getItem('impulse:files') || '{}');
		map = JSON.parse(window.localStorage.getItem('impulse:map'));
	} catch (err) {
		window.localStorage.removeItem('impulse:files');
		window.localStorage.removeItem('impulse:map');
		files = {};
	}

	if (!map) {
		map = {};

		for (const [path, text] of Object.entries(files)) {
			if (!text) {
				delete files[path];
				continue;
			}

			const node = parse(text, 'md');
			updateNode(map, path, node);
		}

		window.localStorage.setItem('impulse:map', JSON.stringify(map));
	}

	Object.assign(state, { files, map });
}

export function storeSession () {
	const { files, map } = state;
	window.localStorage.remoteItem('impulse:map'); // in case the localStorage limit is reached
	window.localStorage.setItem('impulse:files', JSON.stringify(files));
	window.localStorage.setItem('impulse:map', JSON.stringify(map));
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

		if (child?.name === undefined) {
			if (!child) {
				child = {};
				registry[hashPath] = child;
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

// if (typeof window !== 'undefined') {
// 	window.onhashchange = () => {
// 		loadPath();
// 		storeSession();
// 	};
// }

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

function renderCitation (hashPath, citationsRegistry) {
	const { expandedCitations } = state;

	return memo => {
		const [path] = hashPath.split('#');

		if (hashPath !== memo[0]) {
			const { files } = state;
			const { start, finish } = citationsRegistry[hashPath];
			const file = files[path];
			const section = file.slice(start, finish);
			const astNodes = parseMDtoAST(section).children;
			memo[0] = hashPath;
			memo[1] = astNodes;
		}

		const astNodes = memo[1];

		return ['div', { className: 'snip' },
			['button', {
				className: 'close',
				onclick: () => {
					const index = expandedCitations.indexOf(path);
					const newExpandedCitations = [...expandedCitations];
					newExpandedCitations.splice(index, 1);
					state.expandedCitations = newExpandedCitations;
				},
			}, '✕'],
			...astNodes.map(renderAstNode),
		];
	};
}

function renderLeftMenu (leftMenu, citations, citationsRegistry) {
	const { expandedCitations } = state;
	let { children = [] } = leftMenu;

	if (children.length === 1) {
		children = children[0].children || [];
	}
	
	return ['div', {
		className: `side left-side ${expandedCitations.length ? 'with-snips' : ''}`,
	},
		renderChildren(children),
		!citations?.size ? null :  ['ul', { className: 'citations' },
			...citations.values().map(citation => {
				const { path, heading } = citation;
				const isExpanded = expandedCitations.indexOf(path) !== -1;

				return ['li', null,
					isExpanded
						? renderCitation(path, citationsRegistry)
						: ['button', {
							className: 'citation-button',
							onclick: () => {
								const newExpandedCitations = [...expandedCitations];
								newExpandedCitations.push(path);
								state.expandedCitations = newExpandedCitations;
							},
						}, heading],
				];
			}),
		],
	];
}

let headerIndex = 0;

function renderAstNode (node) {
	switch (node.type) {
		case 'Header': {
			const { depth, children } = node;
			processId(node);
			const id = node.id || headerIndex++;
			return [depth, { id }, ...children.map(renderAstNode)];
		}
		case 'Paragraph': {
			const { children } = node;
			return ['p', null, ...children.map(renderAstNode)];
		}
		case 'Str': {
			const { value } = node;
			return value;
		}
	}
}

// use intersection observer to detect which headings have entered and exited view
// - send names of all headings in view
// - wait until MD is rendered to HTML first
function gatherCitations (visibleNodes) {
	return new Set(visibleNodes.map(({ citations = [] }) => citations).flat());
}

// use this for now to render all citations, regardless of whether they are in view
function gatherNodes (node) {
	const { children = [] } = node;
	const nodes = children.map(gatherNodes).flat();
	return [node, ...nodes];
}

function renderApp (memo) {
	const { files, map, visibleNodes, isLeftNavExpanded, isRightNavExpanded } = state;
	const { pathname } = window.location;
	const [prevPath] = memo;

	if (pathname !== prevPath) {
		const file = files[pathname];
		memo[0] = pathname;
		memo[1] = parseMDtoAST(file).children; // TODO: process id on headers (remove from string and add id prop)
		definitions = {}; // TODO: scan for definitions

		const citations = {};
		getCitations(pathname, citations);
		memo[2] = citations;
		memo[3] = citations[`${pathname}#`];

		// memo[4] = getMentions(pathname);
	}

	const [astNodes, citationsRegistry, leftMenu, rightMenu, prevVisibleNodes] = memo.slice(1);

	if (visibleNodes !== prevVisibleNodes) {
		memo[5] = visibleNodes;
		memo[6] = gatherCitations(visibleNodes);
	}

	const [citations] = memo.slice(6);

	onRender(() => {
		if (pathname === prevPath) {
			return;
		}

		Object.assign(state, {
			visibleNodes: gatherNodes(leftMenu),
			expandedCitations: [],
			expandedMentions: [],
		});
	});

	headerIndex = 0;

	return ['div', {
		className: 'app',
	},
		isLeftNavExpanded && renderLeftMenu(leftMenu, citations, citationsRegistry),
		['div', {
			className: 'main',
		},
			['button', {
				className: 'expand-left',
				onclick: () => {
					state.isLeftNavExpanded = !isLeftNavExpanded;
				},
			}, '≡'],
			['button', {
				className: 'expand-right',
				onclick: () => {
					state.isRightNavExpanded = !isRightNavExpanded;
				},
			}, '#'],
			...astNodes.map(renderAstNode),
		],
		isRightNavExpanded && ['div', {
			className: 'side',
		},
			['ul', null,
				['li', null, 'Example Mention'],
			],
		],
	];




	// const { tabs, files, showImports, showExports, showImportSettings, showExportSettings } = state;
	// const [prevPath, prevFiles, prevImports, prevExports] = memo;
	// const { codeRef } = refs;
	// const { index: activeTabIndex } = tabs[0];
	// const activeTab = getTab();
	// const path = getPath() || '';
	// const isFile = !!path;
	// let imports = prevImports;
	// let exports = prevExports;

	// if (path !== prevPath || files !== prevFiles) {
	// 	imports = getImports(path);
	// 	exports = getExports(path);
	// 	memo.splice(0, 4, path, files, imports, exports);

	// 	// TODO: change stew to ignore boolean true, like it does for false, instead of keeping existing node?
	// 	// - it messes with layouts that might have set true for a different expression
	// 	// - use ref in layout instead, since those are seen as objects which are left alone
	// 	// if (path && imports === prevImports && exports === prevExports) {
	// 	// 	return true;
	// 	// }
	// }

	// const tabPlacement = activeTabIndex === 0 ? tabs.length === 2 ? 'only' : 'first' : activeTabIndex === tabs.length - 2 ? 'last' : 'middle';
	// const hasImports = showImports && imports;
	// const hasExports = showExports && exports;

	// onRender(() => {
	// 	if (path !== prevPath) {
	// 		const [input] = codeRef

	// 		if (input) {
	// 			if (path) {
	// 				input.value = files[path];
	// 			}

	// 			input.focus();
	// 			input.setSelectionRange(0, 0);
	// 		}
	// 	}
	// });

	// return ['div', { className: 'app' },
	// 	activeTab && ['', null,
	// 		['ul', { className: 'tabs' },
	// 			['li', { className: `tab list-tab ${hasImports ? 'tab-active' : ''}` },
	// 				['button', {
	// 					className: 'tab-button',
	// 					disabled: !imports || !isFile,
	// 					onclick: () => state.showImports = !showImports,
	// 				}, 'Imports'],
	// 				['button', {
	// 					className: 'tab-icon',
	// 					onclick: () => state.showImportSettings = !showImportSettings,
	// 				}, '☰'],
	// 			],
	// 			...tabs.slice(1).map((tab, i) => {
	// 				return ['li', { className: `tab ${tab === activeTab ? 'tab-active' : ''} tab-${tabPlacement}` },
	// 					['div', { className: 'tab-button-wrapper' },
	// 						['button', {
	// 							className: 'tab-button',
	// 							onclick: () => switchTab(i),
	// 						}, tab[0].name],
	// 					],
	// 					['button', {
	// 						className: 'tab-icon',
	// 						onclick: () => closeTab(i),
	// 					}, '✕'],
	// 				];
	// 			}),
	// 			['li', { className: `tab list-tab ${hasExports ? 'tab-active' : ''}` },
	// 				['button', {
	// 					className: 'tab-button',
	// 					disabled: !exports || !isFile,
	// 					onclick: () => state.showExports = !showExports,
	// 				}, 'Exports'],
	// 				['button', {
	// 					className: 'tab-icon',
	// 					onclick: () => state.showExportSettings = !showExportSettings,
	// 				}, '☰'],
	// 			],
	// 		],
	// 		['div', { className: 'editor-wrapper' },
	// 			['div', { className: 'editor' },
	// 				// TODO: fix stew issue where empty string (path) doesn't remove preview list element
	// 				hasImports && renderImports(imports, showImportSettings, activeTab),
	// 				path ? renderTab(activeTab, tabPlacement) : renderMenu(),
	// 				hasExports && renderList(exports, 'exports', showExportSettings, activeTab),
	// 			],
	// 		],
	// 	],
	// ];
}

if (typeof window !== 'undefined') {
	recallSession();
	stew('#app', renderApp);
}
