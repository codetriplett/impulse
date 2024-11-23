import parseHeader, { buildMap, cleanMap } from './parse-header';

const { createState, onRender } = stew;

const nodes = JSON.parse(window.localStorage.getItem('project') || '{}');
const files = JSON.parse(window.localStorage.getItem('files') || '{}');
let map = buildMap(nodes);

const state = createState({
	path: '',
	file: null,
	nodes,
});

function loadFile (codeRef) {
	const { path } = state;
	state.file = files[path];
}

function createFile () {
	state.file = '';
}

function saveFile (codeRef) {
	const { path, nodes } = state;
	const [codeInput] = codeRef;
	const folders = path.slice(1).split('/');
	const file = codeInput.value;
	let node = nodes[path];

	if (node) {
		cleanMap(path, node, map);
	}

	state.file = file;
	files[path] = file;
	window.localStorage.setItem('files', JSON.stringify(files));

	node = parseHeader(file, map, folders);
	nodes[path] = node;
	window.localStorage.setItem('project', JSON.stringify(nodes));

	Object.assign(state, {
		nodes: {
			...state.nodes,
			[path]: node
		},
	});
}

function organizeByDepth (depthMap) {
	const levels = [];

	for (const [name, depth] of Object.entries(depthMap)) {
		if (!levels[depth]) {
			levels[depth] = [];
		}

		levels[depth].push(name);
	}

	return levels.map(level => level.sort());
}

function getImports (path, depthMap = {}, depth = 0, rootPath) {
	const { nodes } = state;
	const node = nodes[path];

	if (!node) {
		return [];
	}

	if (!rootPath) {
		rootPath = path;
	}

	const names = Object.keys(node);

	for (const name of names) {
		if (name === rootPath || depthMap[name]) {
			continue;
		}

		depthMap[name] = depth;
		getImports(name, depthMap, depth + 1, rootPath);
	}

	const imports = organizeByDepth(depthMap);
	return imports;
}

function getExports (path, depthMap = {}, depth = 0, rootPath) {
	const location = map[path];

	if (!location) {
		return [];
	}

	if (!rootPath) {
		rootPath = path;
	}

	for (const set of Object.values(location)) {
		for (const name of set) {
			if (name === rootPath || depthMap[name]) {
				continue;
			}

			depthMap[name] = depth;
			getExports(name, depthMap, depth + 1, rootPath);
		}
	}

	const exports = organizeByDepth(depthMap);
	return exports;
}

function renderList (levels, type) {
	if (!levels) {
		return null;
	}

	return ['div', { className: type },
		...levels.map(level => {
			return ['ul', null,
				...level.map(name => {
					return ['li', null, name];
				}),
			];
		}),
	];
}

function renderApp (memo) {
	const { path, file, nodes } = state;
	const [prevPath, prevNodes, prevFile, prevImports, prevExports] = memo;
	const pathRef = [];
	const codeRef = [];
	let imports = prevImports;
	let exports = prevExports;

	if (path !== prevPath || nodes !== prevNodes) {
		imports = getImports(path);
		exports = getExports(path);
		memo.splice(0, 2, path, nodes, file, imports, exports);

		if (path && imports === prevImports && exports === prevExports) {
			return true;
		}
	}

	onRender(() => {
		if (file !== null && file !== prevFile) {
			const [input] = codeRef;
			input.value = file;
			input.focus();
		}
	});

	return ['', null,
		['form', {
			className: 'form',
			onsubmit: event => {
				event.preventDefault();

				if (!path) {
					console.log('toggle help and settings menu');
					window.localStorage.removeItem('project');
					map = {};
					state.nodes = {};
				} else if (file !== null) {
					saveFile(codeRef);
				} else if (nodes[path]) {
					loadFile();
				} else {
					createFile();
				}
			},
		},
			['div', { className: 'action-bar' },
				['h1', { className: 'project-name' }, 'Project'],
				['input', {
					className: 'action-input',
					type: 'text',
					ref: pathRef,
					onkeyup: () => {
						const [pathInput] = pathRef;
						Object.assign(state, { path: pathInput.value, file: null });
					},
				}],
				['button', {
					className: 'action-button',
					type: 'submit',
				}, !path ? 'Menu' : file !== null ? 'Save' : nodes[path] ? 'Load' : 'Create'],
			],
			file !== null && ['div', { className: 'editor' },
				renderList(imports, 'import-list'),
				['textarea', {
					className: 'file',
					value: file,
					ref: codeRef,
				}],
				renderList(exports, 'export-list'),
			],
		],
	];
}

stew('#app', renderApp);
