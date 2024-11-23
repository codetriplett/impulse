const { createState } = window.stew;

const listState = createState({
	isSplit: false,
	isExpanded: false,
	expandedImportFolders: {},
	expandedExportFolders: {},
});

const classNames = {
	imports: 'import-list',
	exports: 'export-list',
};

const labels = {
	imports: 'Imports',
	exports: 'Exports',
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
function createTree (depthMap) {
	const { isExpanded } = listState;
	const paths = Object.keys(depthMap);
	const folder = {};
	const modules = [];

	for (const path of paths) {
		const depth = depthMap[path];

		if (depth !== 0 && !isExpanded) {
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

function renderFolder (folder, type) {
	const { path, name, modules = [], folders, files } = folder;
	const folderKey = type === 'imports' ? 'expandedImportFolders' : 'expandedExportFolders';
	const isExpanded = listState[folderKey][path];
	
	return ['', null,
		name && ['button', {
			className: 'folder-button',
			type: 'button',
			onclick: () => {
				listState[folderKey] = {
					...listState[folderKey],
					[path]: !isExpanded,
				};
			},
		}, name],
		['ul', {
			className: `folder ${isExpanded ? 'folder-expanded' : ''}`,
		},
			...modules.map(name => {
				return ['li', {
					className: 'module-item',
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
					className: 'folder-item',
				},
					renderFolder(folder, type),
				];
			}),
			...files.map(name => {
				return ['li', {
					className: 'file-item',
				},
					['button', {
						className: 'file-button',
						type: 'button',
						onclick: () => {
							console.log('load', name);
						},
					}, name],
				]
			}),
		],
	];
}

export function renderList (levels, type) {
	if (!levels) {
		return null;
	}

	return memo => {
		const { isExpanded } = listState;
		const [prevLevels, prevRootFolder, prevIsExpanded] = memo;
		let rootFolder = prevRootFolder;

		if (levels !== prevLevels || isExpanded !== prevIsExpanded) {
			rootFolder = createTree(levels);
			memo.splice(0, 2, levels, rootFolder, isExpanded);
		}

		return ['div', { className: classNames[type] },
			['div', { className: 'list-header' },
				['h2', { className: 'list-heading' }, labels[type]],
				['button', {
					className: 'list-icon',
					onclick: () => {
						listState.isExpanded = !isExpanded;
					},
				}, isExpanded ? '-' : '+'],
			],
			renderFolder(rootFolder, type),
		];
	};
}