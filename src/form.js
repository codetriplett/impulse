// TODO: decide if this is needed
// - The built-in form validation should be enough
// - When populating form, cast all non-objects to strings
//   - for references, check that the path matches in the '' prop
//   - for objects given as options, check the '' prop for its id (required when more than one object options is in schema)
export function checkInput (input, value) {
	const { type, min, max, pattern, minlength, maxlength } = input[1];

	if (type === 'number') {
		return (min === undefined || value >= min) && (max === undefined || value <= max);
	}
}

function parseTypes (value) {
	switch (typeof value) {
		case 'boolean': {
			return ['checkbox'];
		}
		case 'number': {
			return ['number', 'range']
		}
		case 'string': {
			if (/^\d+-\d\d-\d\dT\d\d:\d\d$/.test(value)) {
				return ['datetime-local'];
			} else if (/^\d+-\d\d-\d\d$/.test(value)) {
				return ['date'];
			}

			break;
		}
	}

	return [];
}

// TODO: work out way to allow neseted option/array/object definitions
// - for now, only simple inputs are allowed
export function findOption (value, ...options) {
	if (value === undefined) {
		return -1;
	} else if (Array.isArray(value)) {
		// look for first array it finds
		// - too complicated to test each value of each one to find the best match
		return;
	}

	let path;

	if (typeof value === 'object') {
		// TODO: also load schema of matched component and fill in overrides
		const { '': url, ...overrides } = value;

		if (url === undefined) {
			// look for first object it finds without an id (otherwise first one with id)
			// - too complicated to test each property of each one to find the best match
			return;
		} else if (url[0] !== '/') {
			// look for first object it finds that matches the id (otherwise first one without an id)
			return;
		}

		const lastSlashIndex = url.lastIndexOf('/');
		path = url.slice(0, lastSlashIndex + 1);
		value = url.slice(lastSlashIndex);
	}

	const types = parseTypes(value);

	const filteredOptions = options.filter(option => {
		const [tagName, { type, dataset }] = option;
		return (types.indexOf(type) !== -1 || type === 'text' || tagName === 'textarea') && dataset?.path === path;
	});

	// TODO: find first one that matches the min/max or pattern requirements (otherwise choose the first one)

	const option = filteredOptions[0];
	return options.indexOf(option);
}

export function FormField (definition, value, ...names) {
	if (Array.isArray(definition)) {
		const [first, ...rest] = definition;
		const field = FormField(first, undefined, ...names);
		const inputs = [];

		if (field[1]?.[0] === 'label') {
			field.reverse();
		}

		const options = rest.map(definition => {
			const [label, input] = FormField(definition);
			const { type, placeholder, disabled } = input?.[1] || {};
			const props = {};

			if (disabled) {
				props.value = placeholder;

				if (type === 'number' || type === 'range') {
					props.dataset = { type: /^true|false$/.test(placeholder) ? 'boolean' : 'number' };
				}
			}

			inputs.push(input);
			return ['option', props, label[2]];
		});

		const [label, input] = field;
		const select = ['select', {}, ...options];

		switch (input?.[1]?.type) {
			case 'checkbox': {
				const index = findOption(value, ...inputs);

				if (index !== -1) {
					const input = inputs[index];
					options[index][1].selected = true;

					if (!input[1].disabled) {
						const field = FormField(rest[index], value, ...names);
						const input = field[field[0][0] === 'label' ? 1 : 0];
						return [label, select, input];
					}
				} else {
					select[1].id = label[1].for;
				}

				return [label, select];
			}
			case 'number':
			case 'range': {
				const array = Array.isArray(value) ? value : [];
				const list = ['ol', {}];
				label[1] = {};
				select[1].dataset = { type: 'array' };

				for (const [i, value] of array.entries()) {
					const index = findOption(value, ...inputs);
					const item = ['li', {}];

					if (index === -1) {
						item[2] = 'Invalid Item';
					} else {
						const field = FormField(rest[index], value, ...names, i);
						item[2] = field[field[0][0] === 'label' ? 1 : 0];
					}

					list.push(item);
				}

				const option = ['option', {}, 'Add new item...'];
				select.splice(2, 0, option);
				return [label, list, select];
			}
			default: {
				// TODO: similar to above, but set dataset: { type: 'object' }
				// - also put input element from definition before select element
				break;
			}
		}

		// TODO: add select box with onchange that inserts the correct field(s)
		// - look at cms project for existing code
		return [];
	} else if (typeof definition === 'object') {
		const object = typeof value === 'object' && !Array.isArray(value) ? value : {};
		const elements = [];

		for (const [name, value] of Object.entries(definition)) {
			elements.push(...FormField(value, object[name], ...names, name));
		}

		return elements;
	}

	let match = definition.match(/^\s*(?:(.+?)\s+)?(\S*?)\/(.*?)(?:\/([^/]*?))?(?:\/([^/]*?))?(\*?)?(?:\s+(.+))?\s*$/);

	if (!match) {
		match = [,, 'checkbox', '',,,, definition.trim()];
	}

	let [, placeholder, type, path, pattern, range, required, text] = match;
	const isLiteral = type === '*';

	if (pattern === undefined) {
		range = path;
		path = undefined;
	} else if (range === undefined) {
		range = pattern;
		pattern = path;
		path = undefined;
	}

	if (!type || isLiteral) {
		type = pattern !== undefined ? 'text' : 'number';
	}

	const id = names.reduce((id, name) => `${id}${typeof name === 'number' ? `[${name}]` : `${id ? '.' : ''}${name}`}`, '');
	const props = { id };
	const label = ['label', { for: id }, text];
	const input = ['input', props];

	if ((value || value === 0) && typeof value !== 'object') {
		if (type === 'textarea') {
			input[2] = String(value);
		} else if (type !== 'checkbox') {
			props.value = String(value);
		}
	}

	if (type === 'textarea') {
		input[0] = 'textarea';
	} else {
		props.type = type;
	}

	if (isLiteral) {
		props.disabled = true;
	}

	if (placeholder) {
		props.placeholder = placeholder;
	}

	if (type === 'checkbox') {
		if (value === true) {
			input[1].checked = true;
		}

		return [input, label];
	}

	if (pattern) {
		props.pattern = pattern;
	}

	if (required) {
		props.required = true;
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
