import parseHeader, { cleanMap } from './parse';
import { state, refs, getTab, getPath, storeSession } from '.';

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

function closeReference (tab, i) {
	if (i < tab[0].index) {
		tab[0].index -= 1;
	}

	tab.splice(i + 1, 1);
	state.tabs = [...state.tabs];
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

export function renderTab (tab, placement) {
	const { codeRef, filesRef } = refs;
	const [{ index: activePathIndex }, ...paths] = tab;
	fileRefs = paths.map(() => []);
	fileRefs[activePathIndex] = codeRef;

	return () => {
		const { files } = state;

		onRender(() => {
			for (let i = 0; i < fileRefs.length; i++) {
				resizeChange(i);
			}
		});

		return ['div', { className: 'files-wrapper' },
			['div', {
				className: `files files-${placement}`,
				ref: filesRef,
			},
				...paths.map((path, i) => {
					const ref = fileRefs[i];

					return ['div', { className: 'file-wrapper' },
						['div', { className: 'file-header' },
							['h2', { className: 'file-heading' }, path],
							i !== activePathIndex && ['button', {
								className: 'file-icon',
								onclick: () => closeReference(tab, i),
							}, '✕'],
						],
						['div', { className: 'textarea-wrapper' },
							...Array(Math.abs(i - activePathIndex)).fill(0).map(() => ['div', {
								className: 'indent-line',
							}]),
							['textarea', {
								className: 'file',
								value: files[path],
								spellcheck: false,
								readOnly: i !== activePathIndex,
								ref,
								onpaste: () => saveChange(ref, path, i),
							}],
						],
					];
				}),
			]
		];
	};
}
