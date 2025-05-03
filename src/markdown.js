// headings: \n\s{0,3}#{1,6} or \n\s={1,} or \n\s-{1,}
// list items: \n\s

function parseInline (text) {
	// TODO: process expressions in text (e.g. bold, strikethrough, ndash, etc)
	// - return array of children to spread onto parent element
	return [text];
}

export default function parse (string) {
	const lines = string.split(/(?=\n {0,3}(?:[^ ]|$))/);
	const fragment = ['', {}];
	let length = 0;
	let newlineCount = 0;
	let isListSpaced = false;
	let paragraph, preformatted, list;

	for (const line of lines) {
		const match = line.match(/(\n?(?: {0,3}(?! ))?)(?:(-|\d+[.)]) {1,4})?(#{1,6}(?= )|(?:=+|-+)(?= *$)| {4,}|\t|`{3,})?\s*(.*)\s*/);
		const [, newline, bullet = '', command = '', text] = match;
		const isPreformatted = /[ \t]/.test(command);
		const content = text && !isPreformatted ? parseInline(text) : [];
		const index = length + match.index + newline.length;
		let node;
		length += line.length;

		// - overwrite text varaible with new content
		// - or maybe store to content array that is spread onto parent

		switch (command[0]) {
			case '#': {
				node = [command.length,, ...content];
				break;
			}
			case '=': {
				if (paragraph) {
					paragraph[0] = 1;
					paragraph = undefined;
					continue;
				}

				content.push(command);
				break;
			}
			case '-': {
				if (paragraph) {
					paragraph[0] = 2;
					paragraph = undefined;
					continue;
				}

				node = ['hr'];
				break;
			}
		}

		if (isPreformatted) {
			if (!preformatted || bullet) {
				node = ['pre',,
					['code', {}, text],
				];

				preformatted = node;
			} else {
				preformatted[2][2] += `\n${text}`;
			}
		} else if (text) {
			preformatted = undefined;
		}

		if (bullet) {
			if (newlineCount === 1 && !isListSpaced) {
				isListSpaced = true;

				for (const item of list?.slice?.(2)) {
					const content = item.splice(2);
					item.push(['p', {}, ...content]);
				}
			}

			// li's can have pre (\t, 4 spaces, >)
			node = ['li', { '': index }, ...(node ? [node] : content)];

			if (isListSpaced) {
				const content = node.splice(2);
				node.push(['p', {}, ...content]);
			}

			if (list) {
				list.push(node);
			} else {
				if (bullet === '-') {
					list = ['ul', {}, node];
				} else {
					const start = bullet.slice(0, -1);
					list = ['ol', start === '1' ? {} : { start }, node];
				}

				fragment.push(list);
			}

			continue;
		} else if (text) {
			if (!node) {
				if (paragraph) {
					paragraph.push(['br'], ...content);
				} else if (content.length) {
					paragraph = ['p', { '': index }, ...content];
					fragment.push(paragraph);
				}

				continue;
			}

			node[1] = { '': index };
			fragment.push(node);
			newlineCount = 0;
		} else {
			newlineCount++;
		}

		if (newlineCount !== 1) {
			list = undefined;
		}

		paragraph = undefined;
		isListSpaced = false;
	}

	return fragment;
}
