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

function BooleanSelect ({ label, placeholder, value, inputs }, ...options) {
	const state = stew(() => {
		return stew({ index: findOption(value, ...inputs) });
	}, []);

	const { index } = state;

	for (const [i, option] of options.entries()) {
		option[1].selected = i === index;
	}

	return ['label', {},
		label,
		['select', {
			onchange: event => {
				state.index = event.target.selectedIndex - 1;
			}
		},
			['option', {
				selected: index === -1,
			}, placeholder || 'Select item...'],
			...options,
		],
		inputs[index],
	];
}

function RangeSelect ({ label, placeholder, value, inputs, rest }, ...options) {
	const state = stew(() => {
		return stew({ array: Array.isArray(value) ? value : [] });
	}, []);

	const { array } = state;

	return ['label', {},
		label,
		['ol', {},
			...array.entries().map((value, i) => {
				// TODO: handle cases where index is -1 (invalid items)
				const index = findOption(value, ...inputs);
				return ['li', {}, FormField(rest[index], value, ...names, i)];
			}),
		],
		['select', {
			onchange: event => {
				console.log('==== insert new item', event.target.selectedIndex - 1);
				// const newInput = inputs[selectedIndex - 1];
				// select[2][1].selected = true;
		
				// if (!newInput) {
				// 	return;
				// }
		
				// const clonedInput = [...newInput];
				// clonedInput[1] = { ...clonedInput[1] };
				// clonedInput[1].id += `[${list.length - 2}]`;
				// list.push(['li', {}, clonedInput]);
				event.target.selectedIndex = 0;
			}
		},
			['option', {
				selected: true,
			}, placeholder || 'Add item...'],
			...options,
		],
	];
}

function FormSelect (definition, value, ...names) {
	const [first, ...rest] = definition;
	const field = FormField(first, undefined, ...names);
	const inputs = [];

	if (!field.length) {
		return [];
	}

	const options = rest.map(definition => {
		const label = FormField(definition, undefined, ...names);
		const input = label.find(child => child[0] === 'input');
		inputs.push(input);
		return ['option', {}, label[2]];
	});

	const label = field[2];
	const [input] = field.splice(3, 1);
	const { type, placeholder } = input[1];
	const selectProps = {};
	const select = ['select', selectProps, ...options];
	delete field[1].for;

	switch (type) {
		case 'checkbox': {
			return [BooleanSelect, { label, placeholder, value, inputs }, ...options];
		}
		case 'number':
		case 'range': {
			return [RangeSelect, { label, placeholder, value, inputs, rest }, ...options];
		}
	}

	// TODO: create PropertySelect impulse for this
	const object = typeof value === 'object' && !Array.isArray(value) ? value : {};
	const list = ['ul', {}];
	const option = ['option', {}, placeholder || 'Add property...'];
	select.splice(2, 0, option);
	delete input[1].id;
	delete input[1].placeholder;
	field[1] = {};
			
	selectProps.onchange = ({ selectedIndex }) => {
		const name = input[1].value;
		const newInput = inputs[selectedIndex - 1];
		select[2][1].selected = true;

		if (!name || !newInput) {
			return;
		}

		delete input[1].value;
		const clonedInput = [...newInput];
		clonedInput[1] = { ...clonedInput[1] };
		clonedInput[1].id += `.${name}`;
		const label = ['label', { for: clonedInput[1].id }, name];
		list.push(['li', {}, label, clonedInput]);
	};

	for (const [name, value] of Object.entries(object)) {
		const index = findOption(value, ...inputs);
		const item = ['li', {}];

		if (index === -1) {
			item[2] = 'Invalid Item';
		} else {
			const field = FormField(rest[index], value, ...names, name);
			const [input] = field.splice(2, 1);

			field[2] = name;
			item[2] = field;
			item[3] = input;
		}

		list.push(item);
	}

	field.push(list, input, select);
	return field;
}

// TODO: maybe only run this the first time to create inputs, not whenever an update is triggered in form
// - should only need to run it initially, and whenever a select box adds new fields to the data
export function FormField (definition, value, ...names) {
	if (Array.isArray(definition)) {
		return FormSelect(definition, value, ...names);
	} else if (typeof definition === 'object') {
		const { '': name = names[names.length - 1], ...props } = definition;
		const object = typeof value === 'object' && !Array.isArray(value) ? value : {};
		const list = ['ul', {}];

		for (const [name, value] of Object.entries(props)) {
			list.push(FormField(value, object[name], ...names, name));
		}

		return names.length ? ['label', {}, name, list] : list;
	}

	let match = definition.match(/^\s*(?:([^*]+?)\s+)?(\**)(\S*?)\/(.*?)(?:\/([^/]*?))?(?:\/([^/]*?))?(\**)(?:\s+(.+))?\s*$/);

	if (!match) {
		const [, placeholder, persist, required, text] = definition.match(/^\s*(?:([^*]+?)\s+)?(\*?)(\*?)(?:\s*(.+))?\s*$/);
		match = [, placeholder, persist, 'checkbox', '',,, required, text];
	}

	let [, placeholder, persist, type, path, pattern, range, required, text] = match;
	const isLiteral = persist && required;
	persist = persist && !isLiteral;
	required = required && !isLiteral;

	if (pattern === undefined) {
		range = path;
		path = undefined;
	} else if (range === undefined) {
		range = pattern;
		pattern = path;
		path = undefined;
	}

	if (!type || isLiteral && type !== 'checkbox') {
		type = pattern !== undefined ? 'text' : 'number';
	}

	const id = names.reduce((id, name) => `${id}${typeof name === 'number' ? `[${name}]` : `${id ? '.' : ''}${name}`}`, '');
	const props = { id };
	const label = ['label', { for: id }, text];
	const input = ['input', props];

	if (type === 'textarea') {
		input[0] = 'textarea';
	} else {
		props.type = type;
	}

	if (isLiteral) {
		props.disabled = true;
		value = placeholder;
	} else if (placeholder && type !== 'checkbox') {
		props.placeholder = placeholder;
	}

	if (required) {
		props.required = true;
	} else if (persist) {
		const id = `.${props.id}`;
		label[1].for = id;
		props.id = id;
	}

	if (type === 'checkbox') {
		if (isLiteral) {
			props.checked = value === 'true';
		} else if (value === true) {
			props.checked = true;
		}

		label.push(input);
		return label;
	} else if ((value || value === 0) && typeof value !== 'object') {
		if (type === 'textarea') {
			input[2] = String(value);
		} else if (type !== 'checkbox') {
			const element = document.getElementById(id);
			props.value = element?.value || String(value);
		}
	}

	if (path) {
		// TODO: maybe render this as select
		// - it would need to fetch all JSON files in the given folder
		// - what URL pattern can be used to fetch files in folder server-side
		props.dataset = { path: `/${path}/` };
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

	label.push(input);
	return label;
}
