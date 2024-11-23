import parseHeader, { cleanMap } from './parse-header';
import { state, map, files } from '.';

const { onRender } = window.stew;

export function createFile () {
	state.file = '';
}

export function loadFile (codeRef) {
	const { path } = state;
	state.file = files[path];
}

export function saveFile (codeRef) {
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

function adjustInputHeight (codeRef) {
	const [codeInput] = codeRef;
	codeInput.style.height = '0px';
	codeInput.style.height = `${codeInput.scrollHeight + 4}px`;
}

export function renderFile (file, codeRef) {
	return () => {
		onRender(() => {
			adjustInputHeight(codeRef);
		});

		return ['', null,
			['textarea', {
				className: 'file',
				value: file,
				ref: codeRef,
				onkeydown: () => adjustInputHeight(codeRef),
				onkeyup: () => adjustInputHeight(codeRef),
			}],
		];
	};
}