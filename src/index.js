// import { buildMap } from './parse';
// import { renderList, renderImports } from './list';
// import { renderTab } from './file';
// import { renderMenu } from './menu';
import { parse } from './parse';
import { updateNode } from './map';
import { getObject } from './common';
import { parseMD, extractTemplate, extractBlocks } from './parse';
import { createState, onRender } from '@triplett/stew';

const { pathname, hash } = window.location;

export const state = createState({
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

// function loadPath () {
// 	const { href, hash } = window.location;

// 	if (!hash && !href.endsWith('#')) {
// 		return;
// 	}

// 	const { files, tabs } = state;
// 	const path = hash.slice(1);
// 	const tabIndex = tabs.length - 1;

// 	if (path && !path.startsWith('/')) {
// 		return;
// 	}

// 	for (const [i, tab] of tabs.slice(1).entries()) {
// 		const [{ index }] = tab;
// 		const mainPath = tab[index + 1];

// 		if (mainPath === path) {
// 			switchTab(i);
// 			return;
// 		}
// 	}

// 	state.tabs = [
// 		{ ...tabs[0], index: tabIndex },
// 		...tabs.slice(1),
// 		[{ index: 0, name: path || 'Menu' }, path],
// 	];

// 	if (path && !files[path]) {
// 		files[path] = '';
// 	}
// }

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

// show import list and info page for path that is found but not yet loaded
// - paths to folders should show the imports of all files inside it
// - paths to files should show the export list as well
// show info page and export list for module that is found
// - allow modules to live within project under an alias for their path, to support monorepos
// lists should have the option to toggle them to be split up by their imports/exports, with subdirectories underneath

let definitions;

function renderLeftMenuChild (child) {
	const { path, heading, children } = child;

	return ['li', null,
		['button', {
			className: 'child-button',
			onclick: () => {
				const [, hash = ''] = path.split(/(?=#)/);
				window.location.hash = hash;
			},
		}, heading],
		!children?.length ? null : renderChildren(children),
	];
}

function renderChildren (children) {
	return ['ul', { className: 'children' },
		...children.map(renderLeftMenuChild),
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

	return memo => {
		const [path, hash] = hashPath.split('#');

		if (hashPath !== memo.hashPath) {
			const { files, map } = state;
			const { '': locals = [] } = map[path] || {};
			const local = locals[hash];
			let layout;

			if (local) {
				const [info] = local;
				const [range] = info.split(/[:# ]/);
				const [start, finish] = range.split('-');
				const file = files[path];
				const layout = parseMD(file);
				scopeLayout(layout, start, finish);
			}
			
			memo.hashPath = hashPath;
			memo.layout = layout;
		}

		const { layout } = memo;

		if (!layout) {
			return null;
		}

		return ['div', { className: `snip ${isActive ? '' : 'snip-inactive'}` },
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
	};
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

	if (!children.length && !allCitations.lenth) {
		return null;
	}

	return memo => {
		const { snips } = state;

		return ['div', {
			key: 'navigation',
			className: 'navigation',
		},
			renderChildren(children),
			['ul', { className: 'citations' },
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
	};
}

function RightMenu () {
	const { snips } = state;

	if (!snips.length) {
		return;
	}

	return ['ul', {
		className: 'snips',
	},
		...snips.map(hashPath => [Citation, { hashPath }]),
	];
}

// WEDNESDAY: edit mode (when left button is clicked)
// - snips panel will close, and navigation panel will change to edit
// - that button will change to close button (or save if there are changes)
// - right pane will change to a preview



// TUESDAY: edit mode
// - have hiding nav also toggle edit mode
// - change buttons to close, save buttons, as well as toggles for props/content, and styles/schema/renderer
// - allow paths to use styles/schema/renderer from a different path (with / reverting to impulse renderer)

/*

...resources // paths of JS and CSS files necessary for code
{ ...schema } // automatically creates variables for each top level property
...code

*/




// TODO: interweave notes (MD), schema (JSON), and code (JS) with same path (view and edit modes)
// - tie snips to the js variables and functions of the same name, and display any unused ones at the bottom
// - put schema at the very top, after the default snip (before first headline)
// - in edit mode, use a textarea for each section of the same type (e.g. MD, then JS for that MD, but multiple MD or JS can be included in one if not split up)
// - keep the navigation and reference panels in edit mode, and update them when saving changes



// TODO: finish left nav, with nested mentions
// - only show direction mentions, but allow them to expand to show the mentions scoped to each one
// - design should look similar to the local hierarchy nav, but for imports and exports
// - use tags instead of headlines for mentions. It is the replacement for the visual tag map in other programs (and sets it apart from main nav)
// - show file explorer on home page in place of navigation, and mention for tags from root url /

// TODO: finish right panel
// - this is a workspace for showing snips from other files without having to juggle tabs
// - snips aren't tied to which one is focused on main page, and they carry over as you browse
// - store session when opening closing snips, and show previous sessions on home page
// - new sessions are created when a snip is opened while navigating when a previous session was not continued
// - sessions are closed when their last snip is closed
// - keep the highlighting for items in left nav that are active in right nav

// TODO: try parallel mode which displays two docs side by side, and  lines up snips with identical ids
// - useful for studying parallel histories, e.g. events by year
// - use hash as path
// - render snips in table so they will add white space when other file has intermediate snips

// TODO: tag overview, #tag
// - from home page path

// TODO: edit mode, #/path/to/file
// - from home page path
// - edit file directly

// TODO: CMS, /path/to/template#/path/to/page
// - will render form and preview of page (if there is a js file at path to page)
// - js file will accept json as props and returns either string or object (to use directly in DOM), or Array or function (to render with stew)

/*
	!!! # as hash is treated the same as no hash
	!!! paths that end in / are treated the same as ones without
	!!! ids are technically allowed to have slashes, just not at the beginning

	/: show personal home page, and root tags, broken up into sets of 100 (alphabetically)
	/#tag: show hierarchy for tag
	/#/path/to/file: edit note

	/path/to/note: render markdown
	/path/to/page#name: focus snip
	/path/to/page#/path/to/other/page: compare pages

	HTML FEATURES

	/path/to/page/[#]: render HTML
	/#/path/to/page/: edit data

	!!! template and renderer are modified outside of tool?
*/

function resizeTextarea (ref) {
	const [textarea] = ref;
	textarea.style.height = '0px';
	const { scrollHeight } = textarea;
	textarea.style.height = `${scrollHeight}px`;
}

const editRef = [];

// TODO: save template to JS file
// - set resource paths at top as single line comments
// - set schema as module.exports
// - set render function and optional hydrate function to wrap markdown rendering (passing content and props as params)
//   - hydrate will also receive container element
// - set stew extention to allow webGL shaders (e.g. ['canvas', { width, height }, shader`...`, shader`...`])


// TODO: read .md and .json files from server if they are not found in local storage
// - only store files in local storage when saved while on nerve.dev
// - put options on home page to backup local storage files to zip file, or restore its content from a zip file
function EditingPanel ({ schema }) {
	const { files, draft } = state;
	const { pathname } = window.location;
	const file = draft || files[pathname] || '';
	
	onRender(() => {
		resizeTextarea(editRef);
	});

	// TODO: render form from schema
	// - fill with current props, then save back to json file on save
	console.log(schema);

	return ['div', {
		key: 'edit',
		className: 'edit',
	},
		['div', {
			className: 'form',
		}, 'PUT FORM HERE'],
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

function HomePage (memo) {
	return ['p', null, 'Home Page'];
}

// RENDER

// place a code fence before first heading to set a template
// - this will be renderer (with h1 id as props param name, and '' in props as final markdown)
// - have code fence for h1 set schema
// - have code fence for h2s set states or functions
// - have h3s set cues (if under state) or params (if under functions)

// if a template has a direct parent that is also a template...
// - merge its schema with the current one, favoring current one if names overlap
// - pass props and output of current render as '' prop to parent renderer
// - JSON for final page will include all merged props
// - this is recursive, so it needs to find full chain of parent templates before generating form and rendering bottom layer
// - this will allow pages to share common elements, like navigation



// SCHEMA
// { name: '(\w+) label "description"' }
// - stuff around () defines the type of value, and the rest is the label for the field in the form
// - use first instance of ( and last instance of ) to locate the contents of ()
// - stuff in quotes is optional, and provides a title shown when hovering over form label, similar to what markdown allows for links

// () boolean, which are optional by default
// template/path(\w*) fragment, which can provide a pattern for the final part of the path to fill in

// (\w+) string that matches pattern
// ([a-z])i with flags

// (5) any number 5 or below
// -5(5) any number between -5 and 5
// -5() any number -5 or above
// -5() any number -5 or above

// ['(5) array', ...] // can add up to 5 items from the options in the list

// can put ? after () to mark the field as optional, like an optional regex group
// can put flags after () or ()? for regex to use


// MAJOR STEW CHANGES

// props: { context, ...props } // this way any wrapper element can set a new context
// memo: { children, ...memo } // children makes sense here since it isn't something that drives how component renders, like props
// {}: use toString when server rendering, and ignore when encountered client side (have hydrate skip over its dom element as well)
// () => {}: custom processer, runs only on server render and on hydrate (with element passed in), or just once client-size if it wasn't server rendered
// [component, props, ...children], new fiber-based subcomponent. makes it easier to pass props without wrapping another function

async function processTemplate (pathname, layout) {
	const names = pathname.slice(1).split('/');
	const allResources = [];
	const promises = [fetchFile(`${pathname}.json`).then(res => res.json())];
	let allStyles = '';

	for (let i = names.length - 1; i > 0; i--) {
		const pathname = `/${names.slice(0, i).join('/')}`;
		promises.push(importFile(`${pathname}.mjs`));

		if (i > 1) {
			promises.push(fetchFile(`${pathname}.json`).then(res => res.json()));
		}
	}

	const modules = await Promise.all(promises);

	for (let i = 0; i < modules.length - 1; i += 2) {
		const [props, module] = modules.slice(i, i + 2);

		if (!module) {
			break;
		}

		const [render,, styles, ...resources] = module.default;
		layout = render({ ...props, '': layout });
		allStyles = `${styles}\n${allStyles}`;
		allResources.unshift(...resources);
	}

	const schema = modules[1]?.default?.[1];
	return [layout, schema, allStyles, ...allResources];
}

function Page (memo) {
	const { files, hash, draft, isLeftNavExpanded, isChanged, isEditing, snips, schema, layout } = state;
	const { content: prevContent, hash: prevHash } = memo;
	const hashPath = `${pathname}${hash}`;
	const content = draft || files[pathname] || '';

	if (content !== prevContent || hash !== prevHash) {
		memo.content = content;
		memo.hash = hash;

		if (content !== prevContent) {
			const contentLayout = parseMD(content);
			
			processTemplate(pathname, contentLayout).then(([layout, schema, styles, ...resources]) => {
				const cssUrls = resources.filter(url => url.endsWith('.css'));
				const jsUrls = resources.filter(url => /\.m?js$/.test(url));
				const style = document.querySelector('#styles');
				state.schema = schema;

				state.layout = ['', null,
					...cssUrls.map(href => ['link', { rel: 'stylesheet', href }]),
					['style', null, `${style.innerText}\n${styles}`],
					...layout,
				];

				jsUrls.reduce((promise, src) => {
					return promise.then(() => {
						return new Promise(resolve => {
							const script = document.createElement('script');
							script.onload = resolve;

							if (src.endsWith('.mjs')) {
								script.type = 'module';
							}

							script.src = src;
							document.body.appendChild(script);
						});
					});
				}, Promise.resolve());
			});
		}

		const manifest = {};
		memo.manifest = manifest;
		getCitations(pathname, manifest);
		// getMentions(pathname, citations);
	}

	const leftButtonClassName = `expand-left ${!isLeftNavExpanded ? 'toggle-off' : ''}`;
	const { manifest } = memo;
	headerIndex = 0;

	// TODO: render form using schema

	return ['div', {
		className: 'app',
	},
		// TODO: check if stew needs fixing
		// - it is sharing children between two different functions if they have the same spot in the layout
		// - should it check if the functions are a match before keeping them?
		// - should nameless (anonymous) functions share children? They would always be different between renders (no name means it was never stored to variable)
		// - if a function needs to be treated as a separate entity, either use a ref in its output or separate it out as its own component
		isEditing
			? [EditingPanel, { schema }]
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
							const [editInput] = editRef;
							
							Object.assign(state, {
								draft: editInput.value === files[pathname] ? null : editInput.value,
								isChanged: false,
							});
						},
					}, '👁']
					: ['button', {
						className: leftButtonClassName,
						onclick: () => {
							const [editInput] = editRef;
							const text = editInput.value;
							updateFile(pathname, text, 'md');
							storeSession();
							state.draft = null;
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
				: draft !== null || isChanged
					? ['button', {
						className: 'expand-right',
						onclick: () => {
							Object.assign(state, {
								draft: null,
								isChanged: false,
							});
						},
					}, '🗑︎']
					: ['button', {
						className: 'expand-right',
						onclick: () => {
							state.isEditing = false;
						},
					}, '✕'],
			['div', { mode: 'open' }, layout],
		],
		!isEditing && [RightMenu],
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

		stew('#app', pathname === '/' ? HomePage : Page);
	});
}
