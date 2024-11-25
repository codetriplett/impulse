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
	const [filesDiv] = filesRef
	const { scrollHeight, scrollWidth } = codeInput;
	const prevScrollTop = filesDiv.scrollTop;
	const prevScrollLeft = filesDiv.scrollLeft;
	codeInput.style.height = '0px';
	codeInput.style.width = '0px';
	codeInput.style.height = `${scrollHeight + 16}px`;
	codeInput.style.width = `${scrollWidth + 16}px`;

	setTimeout(() => {
		filesDiv.scrollTop = prevScrollTop;
		filesDiv.scrollLeft = prevScrollLeft;
	}, 0);
}

function focusFile (tab, i) {
	const { tabs } = state;
	tab[0].index = i;
	state.tabs = [...tabs];
}

function saveChange (ref, path) {
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

					return ['textarea', {
						className: 'file',
						value: files[path],
						spellcheck: false,
						ref,
						onkeydown: () => resizeChange(i),
						onfocus: () => focusFile(tab, i),
						onblur: () => saveChange(ref, path),
					}];
				}),
			]
		];
	};
}
