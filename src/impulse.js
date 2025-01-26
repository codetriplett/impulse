import { Parser } from 'acorn';
import jsx from 'acorn-jsx';

const jsxExt = jsx();

const options = {
	ecmaVersion: 'latest',
	sourceType: 'module',
};

function mapNode (text) {
	const references = text.match(/\[.*?\]: +.*/g) || [];
	const tags = `\n${text.trim()}\n`.match(/\s#\S+(?!\})/g) || [];
	const sections = `\n${text.trim()}\n`.split(/(?=\n#+ )/) || [];
	const hasMain = text.search(/(^|(\s*\n))#/) > 0;
	const imports = {};
	const refs = {};

	if (hasMain) {
		sections.shift().trim();
	}

	for (const string of tags) {
		const tag = string.slice(2);
		references.push(`[${tag}]: #${tag}`);
	}

	// create helper that covers the similarity in code between JS and MD
	// - maybe parse to AST here that matches types and prop names used by JS, then pass AST to common resolver
	// - also add helper for the inserting of default object/array if it hasn't yet been added, before adding items to it
	for (const reference of references) {
		const [alias, path, name = 'default'] = reference.match(/\[(.*?)\]: +(.*?)(?:#(.*))?$/).slice(1);
		const sourcePath = path || '/';
		let importObject = imports[sourcePath];

		if (!importObject) {
			importObject = {};
			imports[sourcePath] = importObject;
		}

		let importArray = importObject[name];

		if (!importArray) {
			importArray = [];
			importObject[name] = importArray;
			refs[alias] = importArray;
		}
	}

	for (const section of sections) {
		const [name, content] = section.match(/#+ +.+? *(?:\{#(.*?)\})?\n+(.*)\n*/).slice(1);

		if (!name) {
			continue;
		}

		const references = content.match(/\[.*?\]\[.+?\]/g) || [];
		const tags = `\n${content.trim()}\n`.match(/[^{]#\S+(?!\})/g) || [];

		for (const string of tags) {
			const tag = string.slice(2);
			references.push(`[][${tag}]`);
		}

		for (const reference of references) {
			const [alias] = reference.match(/\[.*?\]\[(.+?)\]/).slice(1);
			refs[alias]?.push?.(name);
		}
	}

	return imports;
}

function parseJS (text) {
	const { body } = Parser.extend(jsxExt).parse(text, options);
	const imports = {};
	const refs = {};
	const rootPath = `/${folders.join('/')}`;

	console.log(body);

	return imports;
}

export function parse (text, type) {
	switch (type) {
		case 'js': return parseJS(text);
		case 'md': return mapNode(text);
	}
}

export function onParse (tree, type) {
	return tree;
}

export function render (tree) {

}
