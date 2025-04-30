import { parse } from './parse';
import { updateNode } from './map';
import { getObject } from './common';
import { parseMD, extractTemplate, extractBlocks } from './parse';
import { FormField } from './form';

const { pathname, hash } = window.location;

export const state = stew({
	// imports: [],
	// exports: [],
	files: {},
	map: {},
	templates: {},
	settings: {},
	hash,
	path: `${pathname}${hash || '#'}`,
	snips: [],
	isLeftNavExpanded: true,
	isEditing: false,
	isTemplateFocused: false,
	isChanged: false,
	draftData: null,
	draft: null,
	draftProps: null,
	layout: null,
});

function updateFile (path, text, type) {
	const { files, map } = state;

	switch (type) {
		default: {
			return;
		}
		case 'json': {
			files[`${path}.json`] = typeof text === 'object' ? JSON.stringify(text) : text;
			return;
		}
		case 'md': {
			break;
		}
	}

	const vars = {};
	const relativeNode = parse(text, 'md', vars);
	updateNode(map, path, relativeNode);
	files[path] = text;
	
	const node = map[path];
	const codePath = `${path}.mjs`;
	const template = extractTemplate(text, node, vars);
	// TODO: don't preprocess templates, just process them on the fly with file and node
	// - less likely to get out of sync

	if (template) {
		files[codePath] = template;
	} else {
		delete files[codePath];
	}
}

const defaultFilePaths = [
	'/markdown.md',
	'/javascript.md',
	'/webgl.md',
	'/site.md',
	'/site/category.md',
	'/site/category.json',
	'/site/category/page.md',
	'/site/category/page.json',
	'/site/category/page2.md',
	'/site/category/page2.json',
];

export async function recallSession () {
	let files, map, templates, snips, settings;

	try {
		files = JSON.parse(window.localStorage.getItem('impulse:files'));
		map = JSON.parse(window.localStorage.getItem('impulse:map'));
		// templates = JSON.parse(window.localStorage.getItem('impulse:templates'));
		snips = JSON.parse(window.localStorage.getItem('impulse:snips') || '[]');
		settings = JSON.parse(window.localStorage.getItem('impulse:settings') || '{}');
	} catch (err) {
		window.localStorage.removeItem('impulse:files');
		window.localStorage.removeItem('impulse:map');
		window.localStorage.removeItem('impulse:templates');
		window.localStorage.removeItem('impulse:snips');
		window.localStorage.removeItem('impulse:settings');
		snips = [];
		settings = {};
	}

	Object.assign(state, { files, map, templates, snips, settings });

	// TODO: only store changes to local storage
	// - add helper that will attempt to fetch file from server if not found in local storage
	// - add an option to create a backup of the localStorage files (in a folder and file structure)
	// - store in localStorage with .md and .json extensions
	if (!files) {
		files = {};
		Object.assign(state, { files, map: {}, templates: {} });

		await Promise.all(defaultFilePaths.map(async path => {
			const file = await fetch(path).then(res => res.text());
			files[path.replace(/\.md$/, '')] = file;
		}));

		window.localStorage.setItem('impulse:files', JSON.stringify(files));
	}

	if (!map || !templates) {
		if (!map) {
			map = {};
			state.map = map;
		}

		if (!templates) {
			templates = {};
			state.templates = templates;
		}

		for (const [path, text] of Object.entries(files)) {
			if (!text) {
				delete files[path];
				continue;
			}

			updateFile(path, text, 'md');
		}

		window.localStorage.setItem('impulse:map', JSON.stringify(map));
		window.localStorage.setItem('impulse:templates', JSON.stringify(templates));
	}
}

export function storeSession () {
	const { files, map, templates, snips } = state;
	window.localStorage.removeItem('impulse:map'); // in case the localStorage limit is reached
	window.localStorage.setItem('impulse:files', JSON.stringify(files));
	window.localStorage.setItem('impulse:map', JSON.stringify(map));
	window.localStorage.setItem('impulse:templates', JSON.stringify(templates));
	window.localStorage.setItem('impulse:snips', JSON.stringify(snips));
}

// show all locals first, regardless of whether they export
// - for MD: start with h2 tags, then embed lower h tags below those (only ones that have label (e.g. MD))
//   - have a final option at the end for citations (imports)
//     - expand to show headlines for imports in the order they were first used
// - for JS: show just the citations without having to expand
function getCitations (path, manifest, focusedNames) {
	const { map } = state;
	const node = map[path];

	if (!node) {
		return [];
	}

	const { '': locals, ...imports } = node;
	const includeNames = focusedNames || Object.keys(locals);
	const childEntries = [];
	const citations = [];

	for (const name of includeNames) {
		const array = locals[name];

		if (!array) {
			continue;
		}

		const [info] = array;
		const [position, ...strings] = info.split(' ');
		const [range, parent] = position.split('#');
		const [start, finish] = range.split('-');
		const heading = strings.join(' ');
		const entry = [Number(start), Number(finish), parent, name, heading];

		childEntries.push(entry);
	}
	
	childEntries.sort(([a], [b]) => a - b);

	for (const childEntry of childEntries) {
		const [start, finish, parent, name, heading] = childEntry;
		const hashPath = `${path}#${name}`;
		let child = manifest[hashPath];

		if (!child) {
			child = {};
			manifest[hashPath] = child;
		}

		citations.push(child);

		if (child.name !== undefined) {
			continue;
		}

		const childCitations = [];

		Object.assign(child, {
			path: `${path}#${name}`,
			name: name,
			start: start,
			finish: finish,
		});

		if (name) {
			child.heading = heading;
		}

		for (const [path, object] of Object.entries(imports)) {
			const names = Object.keys(object).filter(importName => {
				return object[importName].indexOf(name) !== -1;
			});

			const newCitations = getCitations(path, manifest, names);
			childCitations.push(...newCitations);
		}

		if (childCitations.length) {
			child.citations = childCitations;
		}

		if (name) {
			const parentHashPath = `${path}#${parent || ''}`;
			const node = getObject(manifest, parentHashPath, {});
			const children = getObject(node, 'children', [])
			children.push(child);
		}
	}

	return citations;
}

// show just the exports (not headlines)
// - expand to show the headlines of snips that mention the export
// - this can be used to manage a basic todo list, where a slightly modified tag is used to tag ones that have been completed
function getMentions (path, depthMap = {}, depth = 0, rootPath) {
	const { map } = state;
	const node = map[path];

	if (!node) {
		return;
	}

	if (!rootPath) {
		rootPath = path;
	}
	
	const { '': locals } = node;
	const hashPaths = new Set(Object.values(locals).map(array => array.slice(1)).flat());
	const nextDepth = depth + 1;
	const newPaths = [];

	for (const hashPath of hashPaths) {
		const [firstPart] = hashPath.split(' ');
		const [path] = firstPart.split('#');

		if (path === rootPath || depthMap[path] !== undefined) {
			continue;
		}

		depthMap[path] = [depth];
		newPaths.push(path);
	}

	for (const path of newPaths) {
		getExports(path, depthMap, nextDepth, rootPath);
	}

	return depthMap;
}

// TODO: give overview here
// - also show list of files that have drafts
function HomePage () {
	const { settings } = state;
	const { theme = 'dark' } = settings;

	stew(null, [theme], () => {
		document.body.className = `${theme}-theme`;
	});

	return ['div', {
		className: 'main',
	},
		['button', {
			type: 'button',
			style: {
				position: 'absolute',
				right: '15px',
			},
			onclick: () => {
				const newTheme = theme === 'dark' ? 'light' : 'dark';
				state.settings = { ...settings, theme: newTheme };
				window.localStorage.setItem('impulse:settings', JSON.stringify(state.settings));
			},
		}, 'switch to ', theme === 'dark' ? 'light' : 'dark', ' mode'],
		[1, {}, 'Bring Your Notes to Life'],
		['p', {},
			'At its core, this is a simple note-taking tool that allows you to create links between notes for easy exploration. Notes are formatted in Markdown, which is a common and straightforward format that offers great portability. This tool extends that to support blocks of code that can wrap your notes in interective elements to create websites, or even 3d graphics. Even if you have no coding experience, this tool can serve as an entry point to learn those skills, without needing to learn complex build systems.',
		],
		['small', {},
			'All notes are stored locally in your browser. Everything here is a work in progress, but feel free to try it out for yourself.',
		],
	];
}

function convertValue (type, value, checked) {
	switch (type) {
		case 'checkbox': {
			return checked;
		}
		case 'number':
		case 'range': {
			return Number(value);
		}
	}

	return value;
}

function resizeTextarea (ref) {
	const [, textarea] = ref;
	textarea.style.height = '0px';
	const { scrollHeight } = textarea;
	textarea.style.height = `${scrollHeight}px`;
}

function processForm (form) {
	const data = {};

	for (const input of form.elements) {
		const { type, id, value, checked, placeholder } = input;

		if (!id) {
			continue;
		}

		const names = id.split(/\.|(?=\[)/).map(name => name[0] === '[' ? Number(name.slice(1, -1)) : name);
		const finalName = names.pop();
		let castValue = convertValue(type, value, checked);
		
		if (names[0] === '') {
			names.shift();

			if (!castValue) {
				castValue = convertValue(type, placeholder, checked);
			}
		} else if (!castValue) {
			continue;
		}

		const object = names.reduce((object, name) => {
			if (object[name]) {
				return object[name];
			}

			const newObject = typeof name === 'number' ? [] : {};
			object[name] = newObject
			return newObject;
		}, data);

		object[finalName] = castValue;
	}

	return data;
}

function Editor ({ formRef, schema, data, file }) {
	stew(null, [file], () => {
		const [, textarea] = formRef;
		textarea.value = file;
		resizeTextarea(formRef);
	});

	return ['form', {
		ref: formRef,
		className: 'edit',
	},
		...FormField(schema, data),
		['textarea', {
			ref: formRef,
			className: 'editor',
			placeholder: '(empty)',
			onkeydown: event => {
				const { key } = event;

				if (key === 'Tab') {
					event.preventDefault();
					const [, textarea] = formRef;
					const { value, selectionStart, selectionEnd } = textarea;
					textarea.value = `${value.slice(0, selectionStart)}\t${value.slice(selectionEnd)}`;
					textarea.selectionStart = textarea.selectionEnd = selectionStart + 1;
				}

				resizeTextarea(formRef);
				state.isChanged = true;
			},
			onkeyup: () => {
				resizeTextarea(formRef);
				state.isChanged = true;
			},
		}, file],
	];
}

async function fetchFile (path) {
	const { files } = state;
	const file = files[path.replace(/\.md$/, '')];

	if (!file) {
		return fetch(path).catch(() => ({
			text: () => '',
			json: () => ({}),
		}));
	}

	return {
		text: () => file,
		json: () => JSON.parse(file),
	};
}

function importFile (path) {
	const { files } = state;
	const file = files[path];

	if (!file) {
		return import(path).catch(() => {
			console.log('==== MJS not found, might need to create from MD');
		});
	}

	return import(URL.createObjectURL(
		new Blob([file], { type: 'application/javascript' })
	));
}

if (typeof window !== 'undefined') {
	window.onhashchange = () => {
		const { pathname, hash } = window.location;
		const path = `${pathname}${hash || '#'}`;

		Object.assign(state, {
			hash,
			path,
		});
	};
}

function LeftMenuChild ({ path, heading, children }) {
	return ['li', null,
		['button', {
			className: 'child-button',
			onclick: () => {
				const [, hash = ''] = path.split(/(?=#)/);
				window.location.hash = hash;
			},
		}, heading],
		!children?.length ? null : LeftMenuChildren({ children }),
	];
}

function LeftMenuChildren ({ children }) {
	return ['ul', { className: 'children' },
		...children.map(LeftMenuChild),
	];
}

function scopeLayout (layout, start, finish) {
	const allChildren = layout.splice(2);
	const fromIndex = allChildren.findIndex(child => child?.[1]?.key >= start);

	if (fromIndex === -1) {
		return;
	}

	const toIndex = allChildren.findIndex(child => child?.[1]?.key >= finish);

	const children = toIndex === -1
		? allChildren.splice(fromIndex)
		: allChildren.splice(fromIndex, toIndex - fromIndex);

	layout.push(...children);
}

function Citation ({ hashPath }) {
	const { snips } = state;
	const isActive = allCitations.some(citation => citation.path === hashPath);
	const [path, hash] = hashPath.split('#');

	const layout = stew(() => {
		const { files, map } = state;
		const { '': locals = [] } = map[path] || {};
		const local = locals[hash];

		if (!local) {
			return;
		}

		const [info] = local;
		const [range] = info.split(/[:# ]/);
		const [start, finish] = range.split('-');
		const file = files[path];
		const layout = parseMD(file, path);
		scopeLayout(layout, start, finish);
		return layout;
	}, [hashPath]);

	if (!layout) {
		return null;
	}

	return ['div', {
		className: `snip ${isActive ? '' : 'snip-inactive'}`,
	},
		['button', {
			className: 'close',
			onclick: () => {
				const index = snips.indexOf(path);
				const newSnips = [...snips];
				newSnips.splice(index, 1);
				state.snips = newSnips;
				storeSession();
			},
		}, '✕'],
		layout,
	];
}

let allCitations;

function LeftMenu ({ manifest, hashPath, snips }) {
	snips = [...snips];

	const [pathname, hash = ''] = hashPath.split('#');
	const rootPath = `${pathname}#`;
	let { children = [] } = manifest[rootPath] || {};

	if (children.length === 1) {
		const { children: nestedChildren = [], name } = children[0];
		children = nestedChildren;

		if (hash === '') {
			snips.splice(1, 0, `${pathname}#${name}`);
		}
	}

	allCitations = new Set(snips.map(hashPath => {
		const { citations = [] } = manifest[hashPath] || {};
		return citations;
	}).flat()).values().filter(node => {
		return !node.path.startsWith(rootPath);
	});

	if (!children.length && !allCitations.length) {
		return null;
	}

	({ snips } = state);

	return ['div', {
		className: 'navigation',
	},
		LeftMenuChildren({ children }),
		['ul', {
			className: 'citations',
		},
			...allCitations.map(citation => {
				const { path, heading } = citation;
				const pathIndex = snips.indexOf(path);

				return ['li', null,
					['button', {
						className: `citation-button ${pathIndex !== -1 ? 'citation-button-active' : ''}`,
						onclick: () => {
							const newSnips = [...snips];

							if (pathIndex === -1) {
								newSnips.push(path);
							} else {
								newSnips.splice(pathIndex, 1);
							}

							Object.assign(state, {
								snips: newSnips,
							});

							storeSession();
						},
					}, heading],
				];
			}),
		],
	];
}

function RightMenu () {
	const { hash, snips } = state;
	const activeHashPath = `${pathname}${hash}`;

	// TODO: see why stew doesn't reconcile this properly
	// - something about it being at the end of the array of children
	if (!snips.length || snips.length === 1 && snips[0] === activeHashPath) {
		return;
	}

	return ['ul', {
		className: 'snips',
	},
		...snips.map(hashPath => hashPath !== activeHashPath && [Citation, { hashPath }]),
	];
}

/*

phase 2

/modules/content : wraps content in parent components
/modules : presents in documentation mode (interactive code blocks)

//modules/content : just renders content on its own
//modules/content//content2 : renders content in side-by-side grid, without wrapping in parent components
/modules/content//content2 : renders content in side-by-side grid, with wrapping in parent components
/modules/content///other : extra slashes backtrack (so second file is found at /modules/other instead of /modules/content/other)

/modules/content/ : same as without slash (it's common for people to add this intentionally)
/modules/content// : eliminates modules from left side for each extra slash (still need to add styles and resources, but not wrapped in component)

*/

function Page () {
	const { hash, draftData, draft, snips, isLeftNavExpanded, isEditing, isChanged } = state;
	const hashPath = `${pathname}${hash}`;

	// TODO: allow breaking of component chain by having two slashes
	// - e.g. /site/category//info -> uses /site/category/info as the root instead of /site
	const files = [...stew(() => {
		const names = pathname.slice(1).split('/');
		const promises = [];
		let path = '';

		while (names.length) {
			path += `/${names.shift()}`;

			if (promises.length) {
				promises.push(fetchFile(`${path}.json`).then(res => res.json()));
			}

			promises.push(names.length
				? importFile(`${path}.mjs`)
				: fetchFile(`${path}.md`).then(res => res.text())
			);
		}

		return Promise.all(promises);
	}, [], [])];

	if (!files.length) {
		return;
	}
	
	let file = files.pop();
	const schema = files[files.length - 2]?.default?.[1];
	const lastData = files[files.length - 1];
	const formRef = [];
	const resources = [];
	
	if (draft) {
		file = draft;
	}

	let content = stew(() => {
		return parseMD(file);
	}, [file]);

	const manifest = stew(() => {
		const manifest = {};
		getCitations(pathname, manifest);
		return manifest;
		// getMentions(pathname, citations);
	}, [content, hash]);

	// maybe it would work better to have sequence in reverse order
	while (files.length > 1) {
		let [module, data] = files.splice(-2);

		if (data === lastData && draftData) {
			data = draftData;
		}

		const [Component,, styles, ...urls] = module.default;
		const cssUrls = urls.filter(url => url.endsWith('.css'));
		const jsUrls = urls.filter(url => /\.m?js$/.test(url));

		for (const src of jsUrls.reverse()) {
			resources.unshift(['script', { type: 'module', src }]);
		}

		for (const href of cssUrls.reverse()) {
			resources.unshift(['link', { rel: 'stylesheet', href }]);
		}
		
		resources.unshift(['style', {}, styles]);
		content = Component(data, content);
	}

	const leftButtonClassName = `expand-left ${!isLeftNavExpanded ? 'toggle-off' : ''}`;
	const styles = document.querySelector('#styles').textContent;
	resources.unshift(['style', {}, styles]);

	return ['', {},
		// TODO: toggle between left nav and editing mode
		isEditing
			? [Editor, { formRef, schema, data: draftData || lastData, file }]
			: isLeftNavExpanded && [LeftMenu, { manifest, hashPath, snips }],
		['div', {
			className: 'main',
		},
			!isEditing
				? ['button', {
					className: leftButtonClassName,
					onclick: () => {
						state.isLeftNavExpanded = !isLeftNavExpanded;
					},
				}, '≡']
				: isChanged
					? ['button', {
						className: leftButtonClassName,
						onclick: () => {
							const [form, textarea] = formRef;
							
							if (!form.reportValidity()) {
								return null;
							}

							Object.assign(state, {
								draftData: processForm(form),
								draft: textarea.value === files[pathname] ? null : textarea.value,
								isChanged: false,
							});
						},
					}, '👁']
					// TODO: only show this if draft has been previewed and there are changes from what is currently saved
					// - maybe show delete button if draft is '' instead of null
					: ['button', {
						className: leftButtonClassName,
						onclick: () => {
							if (draftData !== null) {
								updateFile(pathname, draftData, 'json');
							}

							if (draft !== null) {
								updateFile(pathname, draft, 'md');
							}

							storeSession();
						},
					}, '🖫'],
			// TODO: have separate 'reset' and 'delete' button
			!isEditing
				? ['button', {
					className: 'expand-right',
					onclick: () => {
						state.isEditing = true;
					},
				}, '✎']
				: isChanged
					? ['button', {
						className: 'expand-right',
						onclick: () => {
							Object.assign(state, {
								draft: null,
								isChanged: false,
							});
						},
					}, '🗑︎'] // TODO: change this to cancel symbol (circle with slash)
					: ['button', {
						className: 'expand-right',
						onclick: () => {
							state.isEditing = false;
						},
					}, '✕'],
			['div', {},
				['template', { shadowrootmode: 'open' },
					['', {},
						...resources,
						content,
					],
				],
			],
		],
		!isEditing && [RightMenu],
	];
}

if (typeof window !== 'undefined') {
	recallSession().then(() => {
		const { theme = 'dark' } = state.settings;
		document.body.className = `${theme}-theme`;
		// TODO: have object be for props instead of context
		// - context can be set by wrapping children fragment
		// - '' prop can still be used to set a converter function
		stew('#app', { className: 'app' }, [pathname === '/' ? HomePage : Page]);
	});
}
