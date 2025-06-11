import { parse } from './parse';
import { updateNode } from './map';
import { getObject } from './common';
import { extractTemplate, extractBlocks } from './parse';
import { FormField } from './form';
import { localStorage } from './storage';

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
		files = JSON.parse(localStorage.getItem('files'));
		map = JSON.parse(localStorage.getItem('map'));
		// templates = JSON.parse(storage.getItem('templates'));
		snips = JSON.parse(localStorage.getItem('snips') || '[]');
		settings = JSON.parse(localStorage.getItem('settings') || '{}');
	} catch (err) {
		localStorage.removeItem('files');
		localStorage.removeItem('map');
		localStorage.removeItem('templates');
		localStorage.removeItem('snips');
		localStorage.removeItem('settings');
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

		localStorage.setItem('files', JSON.stringify(files));
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

		localStorage.setItem('map', JSON.stringify(map));
		localStorage.setItem('templates', JSON.stringify(templates));
	}
}

export function storeSession () {
	const { files, map, templates, snips } = state;
	localStorage.removeItem('map'); // in case the localStorage limit is reached
	localStorage.setItem('files', JSON.stringify(files));
	localStorage.setItem('map', JSON.stringify(map));
	localStorage.setItem('templates', JSON.stringify(templates));
	localStorage.setItem('snips', JSON.stringify(snips));
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
				localStorage.setItem('settings', JSON.stringify(state.settings));
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

function Editor ({ formRef, draftData, file }) {
	// TODO: fetchCode of parent path to get schema, and fetchJson of current path to get savedData
	// - store in onmount memos (savedData should be refetched when editor is opened again after save)
	const schema = {};
	const data = {}; // draftData || savedData

	stew(null, [file], () => {
		const [, textarea] = formRef;
		textarea.value = file;
		resizeTextarea(formRef);
	});

	return ['form', {
		ref: formRef,
		className: 'edit',
		onkeyup: () => state.isChanged = true,
	},
		FormField(schema, data),
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

function Citation ({ hashPath }) {
	const { snips } = state;
	const isActive = allCitations.some(citation => citation.path === hashPath);
	const markdown = stew(fetchFile, [`${hashPath.split('#')[0]}.md`], undefined);
	const layout = stew(markdown, [hashPath], undefined);

	// TODO: clean up how manifest stores its data
	// - it no longer needs to back in ranges, since markdown will scope itself from hash value
	// - are any of the : symbols needed then?

	return !layout ? null : ['div', {
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

function fetchText (path) {
	// TODO: store with .md extension in localStorage, just like they would in the filesystem
	const file = state.files[path.replace(/\.md$/, '')];
	return file || fetch(path).then(res => res.text()).catch(() => '');
}

function fetchJson (path) {
	const file = state.files[path];
	return file ? JSON.parse(file) : fetch(path).then(res => res.json()).catch(() => null);
}

function fetchCode (path) {
	const { files } = state;
	const file = files[path];

	if (!file) {
		return import(path).catch(() => {
			console.error(`Not found: ${path}`);
		});
	}

	return import(URL.createObjectURL(
		new Blob([file], { type: 'application/javascript' })
	));
}

function Block ({ names, data, resources }, content) {
	const path = names.join('/');

	if (resources) {
		const [Component,, styles, ...urls] = stew(fetchCode, [`/${path}.mjs`], {}).default || [];
		const cssUrls = urls.filter(url => url.endsWith('.css'));
		const jsUrls = urls.filter(url => /\.m?js$/.test(url));
		content = Component && data ? Component(data, content) : undefined;

		for (const src of jsUrls.reverse()) {
			resources.unshift(['script', { type: 'module', src }]);
		}

		for (const href of cssUrls.reverse()) {
			resources.unshift(['link', { rel: 'stylesheet', href }]);
		}

		if (styles) {
			resources.unshift(['style', null, styles]);
		}
	} else {
		resources = [];
	}

	if (names.length < 2) {
		return ['', null, ...resources, content];
	}

	names = names.slice(0, -1);
	data = stew(fetchJson, [`/${path}.json`], null);
	return Block({ names, data, resources }, content);
}

function Page () {
	const [names, ...paths] = stew(() => {
		const { pathname } = window.location;
		const names = [];

		const paths = pathname.replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, m => {
			return `/${Array(m.length - 1).fill('.').join('')}/`
		}).split(/\/(?=\.+\/)/);

		if (!pathname.startsWith('//')) {
			names.push(...paths.shift().split('/'));
			paths.unshift(names[names.length - 1]);
		}

		paths[0] = `./${paths[0]}`;

		return [names, ...paths.map(path => {
			const [dots, ...rest] = path.split('/');
			const { length } = dots;
			names.splice(-length, length, ...rest);
			return `/${names.join('/')}`;
		})];
	}, []);

	const styles = stew(() => {
		return document.querySelector('#styles').textContent;
	}, []);
	
	// TODO: read and parse customizations object from localStage as an onmount memo for use in markdown call

	const columns = paths.map(path => {
		// TODO: include a revision number in deps to ensure new files are used once saved
		// - this param won't be used by the function, so it should be fine
		const markdown = stew(fetchText, [`${path}.md`], undefined);
		return stew(markdown, [path, {}, 'main']);
	});

	const content = columns.length < 2 ? columns[0] : ['main', {
		style: { display: 'flex' },
	},
		...columns.map(column => ['div', { style: { flex: '0 1 0' } }, ...column.slice(2)]),
	];

	const { hash, draftData, draft, snips, isLeftNavExpanded, isEditing, isChanged } = state;
	const hashPath = `${pathname}${hash}`;
	const formRef = [];

	const manifest = stew(() => {
		const manifest = {};
		getCitations(pathname, manifest);
		return manifest;
		// getMentions(pathname, citations);
	}, [content, hash]);

	const leftButtonClassName = `expand-left ${!isLeftNavExpanded ? 'toggle-off' : ''}`;

	return ['', {},
		// TODO: toggle between left nav and editing mode
		isEditing
			? [Editor, { formRef, draftData, file }]
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
					['style', null, styles],
					names.length > 1 ? Block({ names }, content) : content,
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
		// TODO: should stew build new element from selector if not found?
		// - also, should props be for attributes to apply to wrapper (but with '' still for convert function)
		stew('#app', {}, [pathname === '/' ? HomePage : Page]);
	});
}
