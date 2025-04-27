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
	hash,
	path: `${pathname}${hash || '#'}`,
	snips: [],
	isLeftNavExpanded: true,
	isEditing: false,
	isTemplateFocused: false,
	isChanged: false,
	draft: null,
	draftProps: null,
	layout: null,
});

function updateFile (path, text, type) {
	switch (type) {
		default: {
			return;
		}
		case 'json': {
			files[path] = text;
			return;
		}
		case 'md': {
			break;
		}
	}

	const { files, map } = state;
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
	'/site.md',
	'/site/category.md',
	'/site/category.json',
	'/site/category/page.md',
	'/site/category/page.json',
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

			if (!map[path]) {
				updateFile(path, text, 'md');
			}
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

function HomePage () {
	return ['p', {}, 'Home Page'];
}

function Form ({ schema, data }) {
	// TODO: copy over old editing panel code
	return ['div', { className: 'edit' },
		...Object.entries(schema).map(definition => {
			return ['input', {}];
		}),
	];
}

function resizeTextarea (ref) {
	const [textarea] = ref;
	textarea.style.height = '0px';
	const { scrollHeight } = textarea;
	textarea.style.height = `${scrollHeight}px`;
}

function Editor ({ schema, data, file, editRef }) {
	stew(null, [file], () => {
		const [textarea] = editRef;
		textarea.value = file;
		resizeTextarea(editRef);
	});

	return ['div', {
		className: 'edit',
	},
		// [Form, { schema, data }],
		['textarea', {
			className: 'editor',
			placeholder: '(empty)',
			ref: editRef,
			onkeydown: () => {
				resizeTextarea(editRef);
				state.isChanged = true;
			},
			onkeyup: () => {
				resizeTextarea(editRef);
				state.isChanged = true;
			},
		}, file],
	];
}

async function fetchFile (path) {
	const { files } = state;
	const file = files[path];

	if (!file) {
		return fetch(path);
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
		return import(path);
	}

	return import(URL.createObjectURL(
		new Blob([file], { type: 'application/javascript' })
	));
}

function LeftMenu () {
	return ['div', {
		className: 'navigation',
	}];
}

function Page () {
	// TODO: use fetched content and modules to render page
	// TODO: render left nav
	// TODO: render right nav
	const { draft, isLeftNavExpanded, isEditing, isChanged } = state;

	// CORRECTION: this doesn't need to fetch data for each layer
	// - the lowest one holds the data for all
	// - the schema of all the other levels just define their requirements
	//   - schema should only build based on what was expected that hasn't already been set by its children maybe?
	// - JSON for higher levels serve as example data to test the feature if you want
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
	const data = files[files.length - 1];
	const editRef = [];
	const resources = [];
	const schemas = [];
	
	if (draft) {
		file = draft;
	}

	let content = stew(() => {
		return parseMD(file);
	}, [file]);

	// maybe it would work better to have sequence in reverse order
	while (files.length > 1) {
		const [module, data] = files.splice(-2);
		const [Component, schema, styles, ...urls] = module.default;
		const cssUrls = urls.filter(url => url.endsWith('.css'));
		const jsUrls = urls.filter(url => /\.m?js$/.test(url));

		for (const src of jsUrls.reverse()) {
			resources.unshift(['script', { type: 'module', src }]);
		}

		for (const href of cssUrls.reverse()) {
			resources.unshift(['link', { rel: 'stylesheet', href }]);
		}
		
		schemas.unshift(schema);
		resources.unshift(['style', {}, styles]);
		content = Component(data, content);
	}

	const leftButtonClassName = `expand-left ${!isLeftNavExpanded ? 'toggle-off' : ''}`;
	const schema = Object.assign({}, ...schemas);
	const styles = document.querySelector('#styles').textContent;
	resources.unshift(['style', {}, styles]);

	return ['', {},
		// TODO: toggle between left nav and editing mode
		isEditing
			? [Editor, { schema, data, file, editRef }]
			: isLeftNavExpanded && [LeftMenu],
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
							const [editInput] = editRef;
							
							Object.assign(state, {
								draft: editInput.value === files[pathname] ? null : editInput.value,
								isChanged: false,
							});
						},
					}, '👁']
					// TODO: only show this if draft has been previewed and there are changes from what is currently saved
					// - maybe show delete button if draft is '' instead of null
					: ['button', {
						className: leftButtonClassName,
						onclick: () => {
							const [editInput] = editRef;
							const text = editInput.value;
							updateFile(pathname, text, 'md');
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
	];
}

if (typeof window !== 'undefined') {
	recallSession().then(() => {
		const { theme = 'dark' } = state.settings;
		const root = document.querySelector(':root');
	
		switch (theme) {
			case 'dark': {
				root.style.setProperty('--page-background', '#333');
				root.style.setProperty('--paper-background', '#222');
				root.style.setProperty('--paper-shadow', '#111');
				root.style.setProperty('--paper-font-color', '#ccc');
				root.style.setProperty('--paper-inactive-background', '#333');
				root.style.setProperty('--button-background', '#444');
				root.style.setProperty('--button-border-color', '#555');
				root.style.setProperty('--button-font-color', '#777');
				root.style.setProperty('--button-hover-background', '#555');
				root.style.setProperty('--button-hover-border-color', '#666');
				root.style.setProperty('--button-hover-font-color', '#777');
				root.style.setProperty('--navigation-font-color', '#ccc');
				root.style.setProperty('--reference-font-color', '#999');
				root.style.setProperty('--reference-active-background', '#555');
				root.style.setProperty('--divider-color', '#777');
				root.style.setProperty('--link-font-color', '#4b4bde');
				root.style.setProperty('--link-visited-font-color', '#8d54c1');
				break;
			}
		}

		// TODO: have object be for props instead of context
		// - context can be set by wrapping children fragment
		// - '' prop can still be used to set a converter function
		stew('#app', { className: 'app' }, [pathname === '/' ? HomePage : Page]);
	});
}
