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

// TODO: change this to store just a list of files to show in editor
// - swap out the lists on the side when a new textarea is clicked into
// - make it clear which textarea is the one being edited
// - open imports directly above active textarea and exports directly below
// - stacking is the alternative to flipping between tabs, and will be much more useful when focus mode is enabled
//   - focus mode collapses code across all contexts that don't contribute to the variable that are flagged to be in focus
//   - it helps trace logic across your codebase at a glance
// - go back to putting the path for the active textarea in the path input at the top

export function loadImport (path) {
	state.imports = [
		...state.imports,
		path,
	];
}

export function loadExport () {
	state.imports = [
		...state.imports,
		path,
	];
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

function resizeChange () {
	const { codeRef, filesRef } = refs;
	const [codeInput] = codeRef;
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
			resizeChange();
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
						onkeydown: () => resizeChange(),
						onfocus: () => focusFile(tab, i),
						onblur: () => saveChange(ref, path),
					}];
				}),
			]
		];
	};
}
