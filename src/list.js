import { state, storeSession } from '.';
import { closeReference } from './file';

const { createState } = window.stew;

const importState = createState({
	isSplit: false,
	isExtended: false,
	expandedFolders: {},
});

const exportState = createState({
	isSplit: false,
	isExtended: false,
	expandedFolders: {},
});

const classNames = {
	imports: 'import-list',
	exports: 'export-list',
};

// TODO: change this to store just a list of files to show in editor
// - swap out the lists on the side when a new textarea is clicked into
// - make it clear which textarea is the one being edited
// - open imports directly above active textarea and exports directly below
// - stacking is the alternative to flipping between tabs, and will be much more useful when focus mode is enabled
//   - focus mode collapses code across all contexts that don't contribute to the variable that are flagged to be in focus
//   - it helps trace logic across your codebase at a glance
// - go back to putting the path for the active textarea in the path input at the top

function loadImport (path) {
	const { tabs } = state;
	const [{ index: tabIndex }] = tabs;
	const tab = tabs[tabIndex + 1];
	const [{ index: pathIndex }] = tab;
	tab.splice(pathIndex + 1, 0, path);
	tab[0].index += 1;
	state.tabs = [...tabs];
	storeSession();
}

function loadExport (path) {
	const { tabs } = state;
	const [{ index: tabIndex }] = tabs;
	const tab = tabs[tabIndex + 1];
	const [{ index: pathIndex }] = tab;
	tab.splice(pathIndex + 2, 0, path);
	state.tabs = [...tabs];
	storeSession();
}

function buildFolder (folder, path) {
	const reducedPath = path.replace(/\/index$/, '').replace(/^\//, '');
	const names = reducedPath ? reducedPath.split('/') : [];
 
	for (const name of names) {
		if (!folder[name]) {
			folder[name] = {};
		}

		folder = folder[name];
	}

	folder.index = true;
}

function sortFolder (folder, path = '', name = '') {
	const { index, ...children } = folder;
	const entries = Object.entries(children);
	const hasIndex = index === true;
	const isFolder = entries.length > 0;
	
	if (path && !isFolder) {
		return { path };
	}

	const folders = [];
	const files = hasIndex ? ['index'] : [];

	for (const [name, childFolder] of entries) {
		const subTree = sortFolder(childFolder, `${path}/${name}`, name);
		const isSubFolder = subTree.path.endsWith('/');

		if (isSubFolder) {
			folders.push(subTree);
		} else {
			files.push(name);
		}
	}

	folders.sort(({ path: a }, { path: b }) => a - b);
	files.sort();
	path += '/';

	return { path, name, folders, files };
}

// TODO: allow toggling to split directory up by each import/export in current file
function createTree (depthMap, type) {
	const listState = type === 'imports' ? importState : exportState;
	const { isExtended } = listState;
	const paths = Object.keys(depthMap);
	const folder = {};
	const modules = [];

	for (const path of paths) {
		const [depth] = depthMap[path];

		if (depth !== 0 && !isExtended) {
			continue;
		}

		if (!path.startsWith('/')) {
			modules.push(path);
		} else {
			buildFolder(folder, path);
		}
	}

	const sortedFolder = sortFolder(folder);
	sortedFolder.modules = modules;
	return sortedFolder;
}

function renderFolder (folder, type, activePaths, activeTab) {
	const { path, name, modules = [], folders, files } = folder;
	const [{ index: activePathIndex }] = activeTab;
	const listState = type === 'imports' ? importState : exportState;
	const { expandedFolders } = listState;
	const isExpanded = expandedFolders[path];
	const loadReference = type === 'imports' ? loadImport : loadExport;

	return ['', null,
		name && ['button', {
			className: 'folder-button',
			type: 'button',
			onclick: () => {
				listState.expandedFolders = {
					...expandedFolders,
					[path]: !isExpanded,
				};
			},
		}, name],
		['ul', {
			className: `folder ${isExpanded ? 'folder-expanded' : ''}`,
		},
			...modules.map(name => {
				return ['li', {
					className: 'list-item module-item',
				},
					['button', {
						className: 'module-button',
						type: 'button',
						onclick: () => {
							console.log('load', name);
						},
					}, name],
				]
			}),
			...folders.map(folder => {
				return ['li', {
					className: 'list-item folder-item',
				},
					renderFolder(folder, type, activePaths, activeTab),
				];
			}),
			...files.map(name => {
				const filePath = `${path}${name}`;
				const isActive = activePaths.indexOf(filePath) !== -1;

				return ['li', {
					className: `list-item file-item ${isActive ? 'file-item-active' : ''}`,
				},
					['button', {
						className: 'file-button',
						type: 'button',
						onclick: () => {
							if (isActive) {
								const fileIndex = activePaths.indexOf(filePath) + (type === 'imports' ? 0 : activePathIndex + 1);
								closeReference(activeTab, fileIndex);
							} else {
								loadReference(filePath);
							}
						},
					}, name],
				]
			}),
		],
	];
}

export function renderList (levels, type, showSettings, activeTab) {
	if (!levels) {
		return null;
	}

	const listState = type === 'imports' ? importState : exportState;
	const [{ index: activePathIndex }] = activeTab;
	const activePaths = type === 'imports' ? activeTab.slice(1, activePathIndex + 1) : activeTab.slice(activePathIndex + 2);

	return memo => {
		const { isExtended } = listState;
		const [prevLevels, prevRootFolder, prevIsExtended] = memo;
		let rootFolder = prevRootFolder;

		if (levels !== prevLevels || isExtended !== prevIsExtended) {
			rootFolder = createTree(levels, type, isExtended);
			memo.splice(0, 3, levels, rootFolder, isExtended);
		}

		return ['div', { className: classNames[type] },
			showSettings && ['ul', { className: 'list-settings' },
				['li', { className: 'list-setting' },
					['input', {
						type: 'checkbox',
						checked: isExtended,
						onclick: () => listState.isExtended = !isExtended,
					}],
					['label', { className: 'list-setting-label' }, 'Recursive Scan'],
				],
			],
			renderFolder(rootFolder, type, activePaths, activeTab),
		];
	};
}