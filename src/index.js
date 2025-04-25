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

function HomePage () {
	return ['p', {}, 'Home Page'];
}

function Content ({ path = '', names, module }) {
	path += `/${names[0]}`;

	let [content, data] = stew((prev = []) => {
		for (const resource of prev.slice(2)) {
			resource.remove();
		}

		return Promise.all([
			names.length > 1 ? import(`${path}.mjs`) : fetch(`${path}.md`).then(res => res.text()),
			module ? fetch(`${path}.json`).then(res => res.json()) : undefined,
		]).then(array => {
			if (names.length > 1) {
				const [,, styles, ...resources] = array[0].default;
				const cssUrls = resources.filter(url => url.endsWith('.css'));
				const jsUrls = resources.filter(url => /\.m?js$/.test(url));
				const stylesheet = document.createElement('style');
				stylesheet.innerText = styles;
				document.body.appendChild(stylesheet);

				array.push(
					stylesheet,
					...cssUrls.map(href => {
						const stylesheet = document.createElement('link');
						Object.assign(stylesheet, { rel: 'stylesheet', href });
						document.body.appendChild(stylesheet);
						return stylesheet;
					}),
					...jsUrls.map(src => {
						const script = document.createElement('script');
						Object.assign(script, { type: 'module', src });
						document.body.appendChild(script);
						return script;
					}),
				);
			}

			return array;
		});
	}, [path], [
		names.length > 1 ? {} : null,
	]);

	if (names.length > 1) {
		content = Content({ path, names: names.slice(1), module: content });
	}

	if (!module) {
		return content;
	}

	const [callback,, styles, ...resources] = module.default || [];
	// TODO: add styles and resources (in shadow root like the old code did)
	return data ? callback(data, content) : null;
}

function Page () {
	const names = pathname.slice(1).split('/');
	// TODO: use fetched content and modules to render page
	// TODO: render left nav
	// TODO: render right nav

	return ['div', {},
		// TODO: wrap in this after shadow dom is tested, it isn't removing shadowRoot properly
		// ['template', { shadowrootmode: 'open' },
			[Content, { names }],
		// ],
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

		stew('#app', {}, [pathname === '/' ? HomePage : Page]);
	});
}
