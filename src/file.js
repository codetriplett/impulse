import parseHeader, { cleanMap } from './parse';
import { state, refs, getPath, storeSession } from '.';

const { onRender } = window.stew;

let fileRefs = [];

// TODO: creates new tab
// - each tab holds a column of files
export function createFile () {
	state.path = '';
}

export function loadFile (path) {
	const { files } = state;
	state.file = files[path];
}

export function saveFile () {
	const { nodes, files, map } = state;
	const { codeRef } = refs;
	const [codeInput] = codeRef;
	const folders = path.slice(1).split('/');
	const file = codeInput.value;
	const path = getPath();
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
			...nodes,
			[path]: node
		},
	});
}

function resizeChange (i) {
	const { filesRef } = refs;
	const [codeInput] = fileRefs[i];
	const codeWrapper = codeInput.parentElement;
	const [filesDiv] = filesRef
	const { scrollTop, scrollLeft } = filesDiv;
	const { scrollHeight, scrollWidth, clientHeight, clientWidth } = codeInput;
	const isBottom = scrollTop > 0 && scrollTop + clientHeight >= clientHeight;
	const isRight = scrollLeft > 0 && scrollLeft + clientWidth >= clientWidth;
	codeWrapper.style.height = '0px';
	codeInput.style.width = '0px';
	codeWrapper.style.height = `${scrollHeight + 16}px`;
	codeInput.style.width = `${scrollWidth + 16}px`;
	filesDiv.scrollTop = isBottom ? scrollHeight : scrollTop;
	filesDiv.scrollLeft = isRight ? scrollWidth : scrollLeft;
}

export function closeReference (tab, i) {
	if (i < tab[0].index) {
		tab[0].index -= 1;
	}

	tab.splice(i + 1, 1);
	state.tabs = [...state.tabs];
	storeSession();
}

function saveChange (ref, path, i) {
	const { nodes, files, map } = state;
	const [input] = ref;
	const folders = path.slice(1).split('/');
	const file = input.value;
	let node = nodes[path];
	
	node = parseHeader(file, map, folders);
	files[path] = input.value;
	nodes[path] = node;

	Object.assign(state, {
		files: { ...files },
		node: { ...nodes },
	});

	resizeChange(i);
	storeSession();
}

function renderFiles (tab, placement, paths, type, isBefore) {
	if (!paths.length) {
		return;
	}

	const { files } = state;
	const { filesRef } = refs;
	const [{ index: activePathIndex }] = tab;
	const indexOffset = type === 'imports' ? 0 : activePathIndex + (type === 'main' ? 0 : 1);

	return ['div', { className: `files-wrapper files-wrapper-${type} ${isBefore ? 'files-wrapper-before' : ''}` },
		['div', {
			className: `files files-${placement}`,
			ref: filesRef,
		},
			...paths.map((path, i) => {
				const fileIndex = indexOffset + i;
				const ref = fileRefs[fileIndex];

				return ['div', { className: 'file-wrapper' },
					type !== 'main' && ['div', { className: 'file-header' },
						['h2', { className: 'file-heading' }, path],
						indexOffset !== activePathIndex && ['button', {
							className: 'file-icon',
							onclick: () => closeReference(tab, fileIndex),
						}, '✕'],
					],
					['div', { className: 'textarea-wrapper' },
						['textarea', {
							className: 'file',
							value: files[path],
							spellcheck: false,
							readOnly: fileIndex !== activePathIndex,
							ref,
							onpaste: () => {
								setTimeout(() => {
									saveChange(ref, path, fileIndex);
								}, 0);
							},
						}],
					],
				];
			}),
		],
	];
}

export function renderTab (tab, placement) {
	const { codeRef } = refs;
	const [{ index: activePathIndex }, ...paths] = tab;
	fileRefs = paths.map(() => []);
	fileRefs[activePathIndex] = codeRef;

	return () => {
		onRender(() => {
			for (let i = 0; i < fileRefs.length; i++) {
				resizeChange(i);
			}
		});

		const importPaths = paths.slice(0, activePathIndex);
		const exportPaths = paths.slice(activePathIndex + 1);

		return ['', null,
			renderFiles(tab, placement, importPaths, 'imports', true),
			renderFiles(tab, placement, [paths[activePathIndex]], 'main', exportPaths.length > 0),
			renderFiles(tab, placement, exportPaths, 'exports'),
		];
	};
}
