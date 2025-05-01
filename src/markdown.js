// headings: \n\s{0,3}#{1,6} or \n\s={1,} or \n\s-{1,}
// list items: \n\s

export default function parse (string) {
	const lines = string.split(/(?=\n {0,3})/);
	const fragment = ['', {}];
	let length = 0;
	let paragraph, list;

	for (const line of lines) {
		const match = line.match(/(\n? {0,3})(#{1,6}|=+|-(?: |-*))?(\s*)(.*)\s*/);
		const [, newline, symbols, space, text] = match;
		const index = length + newline.length + match.index;
		let node;
		length += line.length;

		switch (symbols?.[0]) {
			case '#': {
				node = [symbols.length,, text];
				break;
			}
			case '=': {
				if (paragraph) {
					paragraph[0] = 1;
					continue;
				}

				break;
			}
			case '-': {
				if (paragraph) {
					paragraph[0] = 2;
					continue;
				}

				// li's can have pre (\t, 4 spaces, >)
				node = ['li', { '': index }, text];

				if (list) {
					list.push(node);
				} else {
					list = ['ul', {}, node];
					fragment.push(list);
				}

				continue;
			}
		}

		if (text) {
			if (!node) {
				if (paragraph) {
					paragraph.push(['br'], text);
					continue;
				}
				
				paragraph = ['p', { '': index }, text];
				fragment.push(paragraph);
				continue;
			}

			node[1] = { '': index };
			fragment.push(node);
		}

		paragraph = undefined;
		list = undefined;
	}

	return fragment;
}
