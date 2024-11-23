import { buildMap } from './parse-header';
import { renderList } from './list';
import { createFile, loadFile, saveFile, renderFile } from './file';

const { createState, onRender } = window.stew;

const nodes = JSON.parse(window.localStorage.getItem('project') || '{}');
export const files = JSON.parse(window.localStorage.getItem('files') || '{}');
export const map = buildMap(nodes);

export const state = createState({
	path: '',
	file: null,
	nodes,
});

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

	return depthMap;
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

	return depthMap;
}

// show import list and info page for path that is found but not yet loaded
// - paths to folders should show the imports of all files inside it
// - paths to files should show the export list as well
// show info page and export list for module that is found
// - allow modules to live within project under an alias for their path, to support monorepos
// lists should have the option to toggle them to be split up by their imports/exports, with subdirectories underneath

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
					state.nodes = {};

					for (const key in map) {
						delete map[key];
					}
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
				renderList(imports, 'imports'),
				['div', { className: 'files' },
					renderFile(file, codeRef),
				],
				renderList(exports, 'exports'),
			],
		],
	];
}

stew('#app', renderApp);
