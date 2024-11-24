import parseHeader, { cleanMap } from './parse-header';
import { state, refs, map, files } from '.';

const { onRender } = window.stew;

export function createFile () {
	state.file = '';
}

export function loadFile () {
	const { path } = state;
	state.file = files[path];
}

export function saveFile () {
	const { path, nodes } = state;
	const { codeRef } = refs;
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

function adjustInputHeight (codeRef, filesRef) {
	const [codeInput] = codeRef;
	const [filesDiv] = filesRef
	const { scrollHeight } = codeInput;
	const prevScrollTop = filesDiv.scrollTop;
	codeInput.style.height = '0px';
	codeInput.style.height = `${scrollHeight}px`;

	setTimeout(() => {
		filesDiv.scrollTop = prevScrollTop;
	}, 0);
}

export function renderFile (file, path) {
	const { codeRef, filesRef } = refs;

	return () => {
		onRender(() => {
			adjustInputHeight(codeRef, filesRef);
		});

		return ['', null,
			['span', { className: 'file-header' }, path],
			['textarea', {
				className: 'file',
				value: file,
				ref: codeRef,
				onkeydown: () => adjustInputHeight(codeRef, filesRef),
			}],
		];
	};
}