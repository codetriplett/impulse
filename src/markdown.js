// headings: \n\s{0,3}#{1,6} or \n\s={1,} or \n\s-{1,}
// list items: \n\s

function buildPath (rootPath, href = '') {
	if (!href.startsWith('.')) {
		return href;
	} else if (href === '.') {
		href = './index';
	}

	const sections = href.replace(/^.\//, '').split('/');
	const sourcePath = rootPath.slice(0, -1);

	while (sections[0] === '..') {
		sections.shift();
		sourcePath.pop();
	}

	sourcePath.push(...sections);
	return `/${sourcePath.join('/')}`;
}

export function parseInline (string, rootPath, links) {
	// TODO: process expressions in text (e.g. bold, strikethrough, ndash, etc)
	// - return array of children to spread onto parent element
	const content = [];

	while (string) {
		const spoilerMatch = string.match(/^\|\|(.*?)\|\|(.*)$/);

		if (spoilerMatch) {
			const [, spoiler, remainder] = spoilerMatch;
			content.push(['span', { onclick: {} }, spoiler]);
			string = remainder;
			continue;
		}

		const linkMatch = string.match(/^\[\s*(.*?)\s*\]\s*(?:\(\s*(.*?)\s*(?:['"](.*?)['"])?\s*\)|\[\s*(.*?)\s*\])(.*)$/);

		if (linkMatch) {
			const [, text, href, title, key, remainder] = linkMatch;
			const node = ['a',, text];
			content.push(node);
			string = remainder;

			if (key) {
				node[1] = key;
				links.push(node);
				continue;
			}

			const props = { href: buildPath(rootPath, href) };
			node[1] = props;

			if (title) {
				props.title = title;
			}

			continue;
		}

		content.push(string);
		break;
	}

	return content;
}

export default function parse (content, rootPath) {
	const lines = content.split('\n');
	const stack = [[0, ['', {}]]];
	const inlines = new Set();
	const references = {};
	const links = [];
	let string = '';
	let index = -1;
	let newlines = 0;
	let ticks = 0;
	let spaced = false;
	let alignments;

	for (const line of lines) {
		let padding = line.match(/[ \t]*/)[0];
		index += string.length + padding.length + 1;

		if (padding === line) {
			newlines += 1;
			string = line;
			continue;
		}

		const oldlines = newlines;
		let whitespace = padding.replace('\t', '    ').length;
		let container;
		newlines = 0;

		if (oldlines > 1) {
			stack.splice(1);
			[, container] = stack[0];
		} else {
			for (const [i, [indentation, node]] of stack.entries()) {
				if (whitespace < indentation) {
					stack.splice(i);
					break;
				}

				whitespace -= indentation;
				container = node;	
			}
		}

		let previous = container[container.length - 1];

		if (previous?.[0] === 'li') {
			container = previous;
			previous = container[container.length - 1];
		}

		if (whitespace > 3 || ticks) {
			if (ticks && line.match(/^ {0,3}(`+)[ \t]*$/)?.[1]?.length >= ticks) {
				ticks = 0;
				continue;
			}

			const indentation = ticks ? 0 : line[0] === '\t' ? 1 : 4;
			string = line.slice(indentation);
			index -= indentation;

			if (previous?.[0] === 'pre') {
				const text = previous[2][2];
				previous[2][2] += `${text ? Array(oldlines + 1).fill('\n').join('') : ''}${string}`;
			} else {
				container.push(['pre', { '': index },
					['code', {}, string],
				]);
			}

			continue;
		} else if (/^ {0,3}(`{3,})/.test(line)) {
			container.push(['pre', { '': index },
				['code', {}, ''],
			]);

			ticks = line.match(/^ {0,3}(`+)/)?.[1]?.length;
			continue;
		}

		string = line.slice(padding.length);
		const match = string.match(/^(?:(-|\d+[.)]) {1,4}(?![\s-]+$))?(?:\[\s*(.+?)\s*\]:\s*(.+?)\s*(?:['"](.*?)['"])?\s*$)?(#{1,6}(?= )|(?:=+|-[\s-]*|[+*])(?=\s*$)|\|(?!\|.*?\|\|))?\s*(.*?)\s*$/);
		const [, bullet = '', key, href, title, command = '', text] = match;
		const content = parseInline(text, rootPath, links);
		const nodes = [];

		if (key && !references[key]) {
			const props = { href: buildPath(rootPath, href) };
			references[key] = props;
			
			if (title) {
				props.title = title;
			}
		}

		switch (command[0]) {
			case '#': {
				nodes.unshift([command.length, {}, ...content]);
				break;
			}
			case '=': {
				if (previous?.[0] === 'p' && oldlines === 0) {
					previous[0] = 1;
					continue;
				}

				content.push(command);
				break;
			}
			case '-':
			case '+':
			case '*': {
				if (previous?.[0] === 'p' && oldlines === 0 && !/\s/.test(command)) {
					previous[0] = 2;
					continue;
				}

				nodes.unshift(['hr']);
				break;
			}
			case '|': {
				const string = text.endsWith('|') ? text : `${text}|`;

				if (/^(\s*:?-+:?\s*\|)+$/.test(string)) {
					const isFirst = !alignments;
					container = previous?.[2];

					alignments = string.slice(0, -1).split(/\s*\|\s*/).map(string => {
						return string.endsWith(':') ? string.startsWith(':') ? 'center' : 'right' : '';
					});

					if (isFirst && container?.[0] === 'tbody' && oldlines === 0) {
						container[0] = 'thead';
						previous.push(['tbody', {}]);

						for (const row of container.slice(2)) {
							for (const [i, cell] of row.slice(2).entries()) {
								const textAlign = alignments[i];
								cell[0] = 'th';

								if (textAlign) {
									cell[1].style = { textAlign };
								}
							}
						}
					}

					continue;
				}
		
				nodes.unshift(['tr', {}, ...string.slice(0, -1).split('|').map((text, i) => {
					const textAlign = alignments?.[i];
					return ['td', textAlign ? { style: { textAlign } } : {}, text.trim()];
				})]);

				if (previous?.[0] !== 'table' || oldlines > 0) {
					nodes.unshift(['table', {}], ['tbody', {}]);
				} else {
					container = previous[previous.length - 1];
				}

				break;
			}
		}

		if (bullet) {
			if (nodes.length) {
				nodes.unshift(['li', {}]);
			} else if (spaced) {
				nodes.unshift(['li', {}, ['p', {}, ...content]]);
			} else {
				nodes.unshift(['li', { '': index }, ...content]);
				inlines.add(index);
			}
			
			const type = bullet === '-' ? 'ul' : 'ol';

			if (oldlines > 1 || previous?.[0] !== type) {
				const start = type === 'ul' ? '1' : bullet.slice(0, -1);
				const list = [type, start === '1' ? {} : { start }];
				nodes.unshift(list);
				spaced = false;
				padding += `${bullet} `;
				stack.push([padding.length, list]);
			} else {
				container = previous;

				if (oldlines && !spaced) {
					const children = container.slice(2);
					children.push(nodes[0]);
					spaced = true;

					for (const item of children) {
						if (inlines.has(item[1][''])) {
							const content = item.splice(2);
							item.push(['p', {}, ...content]);
						}
					}
				}
			}
		}

		if (!nodes.length && content.length) {
			if (previous?.[0] === 'p' && !oldlines) {
				previous.push(['br'], ...content);
				continue;
			}

			nodes.unshift(['p', {}, ...content]);
		}

		for (const node of nodes) {
			container.push(node);
			container = node;
		}

		if (nodes.length) {
			container[1][''] = index;

			if (container[0] !== 'tr') {
				alignments = undefined;
			}
		}
	}

	for (const link of links) {
		const key = link[1];
		link[1] = { ...references[key] };
	}

	return stack[0][1];
}
