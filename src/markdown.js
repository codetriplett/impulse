// headings: \n\s{0,3}#{1,6} or \n\s={1,} or \n\s-{1,}
// list items: \n\s

function parseInline (text) {
	// TODO: process expressions in text (e.g. bold, strikethrough, ndash, etc)
	// - return array of children to spread onto parent element
	return [text];
}

export default function parse (string) {
	const lines = string.split('\n');
	const stack = [[0, ['', {}]]];
	const inlines = new Set();
	let length = -1;
	let newlines = 0;
	let spaced = false;

	for (let line of lines) {
		let padding = line.match(/[ \t]*/)[0];
		length += padding.length + 1;

		if (padding === line) {
			newlines += 1;
			continue;
		}
		
		padding = padding.replace('\t', '    ');
		let whitespace = padding.length;
		let container;

		if (newlines > 1) {
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

		if (whitespace > 3) {
			const indentation = line[0] === '\t' ? 1 : 4;
			line = line.slice(indentation);
			length -= indentation;

			if (previous?.[0] === 'pre') {
				previous[2][2] += `\n${line}`;
			} else {
				container.push(['pre', { '': length },
					['code', {}, line],
				]);
			}

			continue;
		}

		if (newlines > 1) {
			previous = undefined;
		}

		line = line.slice(padding.length);
		const match = line.match(/(?:(-|\d+[.)]) {1,4})?(#{1,6}(?= )|(?:=+|-+)(?= *$)| {4,}|\t|`{3,})?\s*(.*)\s*/);
		const [, bullet = '', command = '', text] = match;
		const content = parseInline(text);
		let node, wrapper;

		switch (command[0]) {
			case '#': {
				node = [command.length,, ...content];
				break;
			}
			case '=': {
				if (previous?.[0] === 'p') {
					previous[0] = 1;
					continue;
				}

				content.push(command);
				break;
			}
			case '-': {
				if (previous?.[0] === 'p') {
					previous[0] = 2;
					continue;
				}

				node = ['hr'];
				break;
			}
		}

		if (bullet) {
			if (bullet === '-' && previous?.[0] !== 'ul') {
				wrapper = ['ul', {}];
			} else if (bullet !== '-' && previous?.[0] !== 'ol') {
				const start = bullet.slice(0, -1);
				wrapper = ['ol', start === '1' ? {} : { start }];
			} else {
				container = previous;

				if (newlines && !spaced) {
					spaced = true;

					for (const item of container.slice(2)) {
						if (inlines.has(item[1][''])) {
							const content = item.splice(2);
							item.push(['p', {}, ...content]);
						}
					}
				}
			}

			if (node) {
				node = ['li',, node];
			} else if (spaced) {
				node = ['li',, ['p', {}, ...content]];
			} else {
				node = ['li',, ...content];
				inlines.add(length);
			}
			
			padding += `${bullet} `;
		}

		if (!node) {
			if (previous?.[0] === 'p' && !newlines) {
				previous.push(['br'], ...content);
				continue;
			}

			node = ['p',, ...content];
		}

		if (wrapper) {
			stack.push([padding.length, wrapper]);
			container.push(wrapper);
			container = wrapper;
		}

		node[1] = { '': length };
		container.push(node);
		length += line.length;
		spaced = false;
		newlines = 0;
	}

	return stack[0][1];
}
