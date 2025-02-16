export function FormField (value, ...names) {
	if (Array.isArray(value)) {
		const [first, ...rest] = value;
		const field = FormField(first, ...names);

		if (field[0][1].type === 'checkbox') {
			const [, label] = field;
			const id = label[1].for
			const select = ['select', { id }];

			for (const value of rest) {
				const [label, input] = FormField(value);
				const { type, placeholder } = input[1];

				if (!placeholder) {
					continue;
				}

				const props = { value: placeholder };

				if (type === 'number') {
					props.dataset = { type };
				}

				const option = ['option', props, label[2]];
				select.push(option);
			}

			return [label, select];
		}

		// TODO: add select box with onchange that inserts the correct field(s)
		// - look at cms project for existing code
		return;
	} else if (typeof value === 'object') {
		const elements = [];

		for (const [name, value] of Object.entries(value)) {
			elements.push(...FormField(value, ...names, name));
		}

		return elements;
	}

	let match = value.match(/^\s*(?:(.+?)\s+)?(.*?)\/(.*?)(?:\/([^/]*?))?(?:\/([^/]*?))?(?:\s+(.+))?\s*$/);

	if (!match) {
		match = [,, 'checkbox',,,, value.trim()];
	}

	let [, placeholder, type, path, pattern, range, text] = match;

	if (pattern === undefined) {
		range = path;
		path = undefined;
	} else if (range === undefined) {
		range = pattern;
		pattern = path;
		path = undefined;
	}

	if (!type) {
		type = pattern !== undefined ? 'text' : range.indexOf('T') !== -1 ? 'datetime-local' : range.indexOf('-') !== -1 ? 'date' : 'number';
	}

	const id = names.join('.');
	const props = { id, type };
	const label = ['label', { for: id }, text];
	const input = ['input', props];

	if (type === 'checkbox') {
		return [input, label];
	}

	if (placeholder) {
		props.placeholder = placeholder;
	}

	if (pattern) {
		props.pattern = pattern;
	}

	if (range) {
		const [, min, step, max] = range.match(/^(?:(.*?)\.\.)?(?:(.*?)\.\.)?(.*?)$/);

		if (max) {
			props[type === 'text' ? 'maxlength' : 'max'] = max;
		}

		if (min) {
			props[type === 'text' ? 'minlength' : 'min'] = min;
		}

		if (step && step !== '1' && type !== 'text') {
			props.step = step;
		}
	}

	if (path) {
		props.dataset = { path: `/${path}/` };
	}

	return [label, input];
}
