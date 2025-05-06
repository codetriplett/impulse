// headings: \n\s{0,3}#{1,6} or \n\s={1,} or \n\s-{1,}
// list items: \n\s

function parseInline (text) {
	// TODO: process expressions in text (e.g. bold, strikethrough, ndash, etc)
	// - return array of children to spread onto parent element
	return [text];
}

export default function parse (content) {
	const lines = content.split('\n');
	const stack = [[0, ['', {}]]];
	const inlines = new Set();
	let string = '';
	let index = -1;
	let newlines = 0;
	let ticks = 0;
	let spaced = false;

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
		const match = string.match(/(?:(-|\d+[.)]) {1,4})?(#{1,6}(?= )|(?:=+|-+)(?= *$)|\|)?\s*(.*)\s*/);
		const [, bullet = '', command = '', text] = match;
		const content = parseInline(text);
		const nodes = [];

		switch (command[0]) {
			case '#': {
				nodes.unshift([command.length,, ...content]);
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
			case '-': {
				if (previous?.[0] === 'p' && oldlines === 0) {
					previous[0] = 2;
					continue;
				}

				nodes.unshift(['hr']);
				break;
			}
			case '|': {
				// TODO: process row into current tbody
				// - convert existing tbody to thead if line is an alignment row and thead doesn't yet exist
				// - store alignments in a variable for later use
				const count = 1; // take this from the row properties [count, ...alignments];
				const cells = text.split('|').slice(0, count).map(text => ['td', {}, text.trim()]);
				nodes.unshift(['tr',, ...cells]);

				if (previous?.[0] !== 'table' || oldlines > 0) {
					nodes.unshift(['table', {}], ['tbody', {}]);
				} else {
					container = previous[previous.length - 1]
				}

				break;
			}
		}

		if (bullet) {
			if (nodes.length) {
				nodes.unshift(['li',,]);
			} else if (spaced) {
				nodes.unshift(['li',, ['p', {}, ...content]]);
			} else {
				nodes.unshift(['li',, ...content]);
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
						if (!item[1] || inlines.has(item[1][''])) {
							const content = item.splice(2);
							item.push(['p', {}, ...content]);
						}
					}
				}
			}
		}

		if (!nodes.length) {
			if (previous?.[0] === 'p' && !oldlines) {
				previous.push(['br'], ...content);
				continue;
			}

			nodes.unshift(['p',, ...content]);
		}

		for (const node of nodes) {
			container.push(node);
			container = node;
		}

		container[1] = { '': index };
	}

	return stack[0][1];
}
