import { onRender } from '@triplett/stew';
import { parse } from './parse';
import { updateNode } from './map';
import { state, refs, storeSession } from '.';

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
	const { nodes, files } = state;
	const [input] = ref;
	const text = input.value;
	const type = path.match(/(?:\.([a-z]+))?$/)[1] || 'md';
	const node = parse(text, type);
	const processedNode = updateNode(nodes, path, node);
	files[path] = text;
	nodes[path] = processedNode;

	Object.assign(state, {
		files: { ...files },
		node: { ...nodes },
	});

	resizeChange(i);
	storeSession();
}

function focusImportFile (hashPath, activePath) {
	const [path, hash = ''] = hashPath.split('#');
	const { files, nodes } = state;
	const file = files[path];
	const { '': locals } = nodes[path];
	const local = locals[hash];

	if (!local) {
		return '';
	}

	const [info] = local[0].split(' ');
	const [range] = info.split('#');
	const [start, finish] = range.split('-');
	const text = file.slice(start, finish);

	return text;

	// const fragments = [];

	// console.log(locals);

	// for (const [name, array] of Object.entries(locals)) {
	// 	const inScope = array.some(hashPath => {
	// 		if (typeof hashPath !== 'string') {
	// 			return;
	// 		}

	// 		// TODO: compare the hashes for import depths of 1 or more
	// 		// - needs to only include fragments that relate to the locals used directly by the active file
	// 		const [path, ...hashes] = hashPath.split('#');
	// 		return path === activePath;
	// 	});

	// 	if (!inScope) {
	// 		continue;
	// 	}

	// 	const [start, end] = array;
	// 	const fragment = file.slice(start, end);
	// 	fragments.push(fragment);
	// }

	// const text = fragments.join('\n');
	// return text;
}

function focusExportFile (path, activePath) {
	return file;
}

function renderFiles (tab, placement, paths, type, isBefore, activePath) {
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

				return memo => {
					if (type !== 'main' && memo.length === 0) {
						memo[0] = type === 'imports' ? focusImportFile(path, activePath) : focusExportFile(path, activePath);
					}

					const value = type === 'main' ? files[path] : memo[0];

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
								value,
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
				};
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
		const activePath = paths[activePathIndex];

		return ['', null,
			renderFiles(tab, placement, importPaths, 'imports', true, activePath),
			renderFiles(tab, placement, [activePath], 'main', exportPaths.length > 0),
			renderFiles(tab, placement, exportPaths, 'exports', false, activePath),
		];
	};
}
