import { checkInput, findOption, FormField } from './form';

/*

/ Boolean

/.. Any Number
/0.. Any Positive Number
/..0 Any Negative Number
/0..5 Number Between 0 and 5

// Any String
/\w+/ Any String with pattern
//0..5 Any String with minlength and maxlength
/\w+/0..5 Any String with pattern, minlength, and maxlength

/path/\w+/ Reference (saves as { '': '/path/name', ...overrides })

path/path/\w+/

*/

describe('checkInput', () => {
	it('accepts number within free range', () => {
		const actual = checkInput([, { type: 'number' }], 2);
		expect(actual).toEqual(true);
	});

	it('accepts number within strict range', () => {
		const actual = checkInput([, { type: 'number', min: 0, max: 4 }], 2);
		expect(actual).toEqual(true);
	});
	
	it('rejects number below range', () => {
		const actual = checkInput([, { type: 'number', min: 2, max: 4 }], 0);
		expect(actual).toEqual(false);
	});
	
	it('rejects number above range', () => {
		const actual = checkInput([, { type: 'number', min: 0, max: 2 }], 4);
		expect(actual).toEqual(false);
	});
});

describe('findOption', () => {
	it('finds checkbox input', () => {
		const actual = findOption(true, [, {}], [, { type: 'checkbox' }]);
		expect(actual).toEqual(1);
	});

	it('finds number input', () => {
		const actual = findOption(123, [, {}], [, { type: 'number' }]);
		expect(actual).toEqual(1);
	});

	it('finds text input', () => {
		const actual = findOption('abc', [, {}], [, { type: 'text' }]);
		expect(actual).toEqual(1);
	});

	it('finds textarea input', () => {
		const actual = findOption('abc', [, {}], ['textarea', {}]);
		expect(actual).toEqual(1);
	});

	it('finds reference input', () => {
		const actual = findOption({ '': '/folder/file' }, [, {}], [, { type: 'text', dataset: { path: '/folder/' }}]);
		expect(actual).toEqual(1);
	});

	it('rejects undefined', () => {
		const actual = findOption(undefined, [, {}], [, { type: 'text' }]);
		expect(actual).toEqual(-1);
	});
});

describe('FormField', () => {
	describe('number', () => {
		it('unpopulated', () => {
			const actual = FormField('/ Label', undefined, 'group', 'name');

			expect(actual).toEqual([
				['label', { for: 'group.name' }, 'Label'],
				['input', { type: 'number', id: 'group.name' }],
			]);
		});

		it('populated', () => {
			const actual = FormField('/ Label', 123, 'group', 'name');

			expect(actual).toEqual([
				['label', { for: 'group.name' }, 'Label'],
				['input', { type: 'number', id: 'group.name', value: '123' }],
			]);
		});

		it('range longhand', () => {
			const actual = FormField('/.. Label', undefined, 'group', 'name');

			expect(actual).toEqual([
				['label', { for: 'group.name' }, 'Label'],
				['input', { type: 'number', id: 'group.name' }],
			]);
		});

		it('max shorthand', () => {
			const actual = FormField('/4 Label', undefined, 'group', 'name');

			expect(actual).toEqual([
				['label', { for: 'group.name' }, 'Label'],
				['input', { type: 'number', id: 'group.name', max: '4' }],
			]);
		});

		it('max', () => {
			const actual = FormField('/..4 Label', undefined, 'group', 'name');

			expect(actual).toEqual([
				['label', { for: 'group.name' }, 'Label'],
				['input', { type: 'number', id: 'group.name', max: '4' }],
			]);
		});

		it('min', () => {
			const actual = FormField('/0.. Label', undefined, 'group', 'name');

			expect(actual).toEqual([
				['label', { for: 'group.name' }, 'Label'],
				['input', { type: 'number', id: 'group.name', min: '0' }],
			]);
		});

		it('step', () => {
			const actual = FormField('/..2.. Label', undefined, 'group', 'name');

			expect(actual).toEqual([
				['label', { for: 'group.name' }, 'Label'],
				['input', { type: 'number', id: 'group.name', step: '2' }],
			]);
		});

		it('min and max', () => {
			const actual = FormField('/0..4 Label', undefined, 'group', 'name');

			expect(actual).toEqual([
				['label', { for: 'group.name' }, 'Label'],
				['input', { type: 'number', id: 'group.name', min: '0', max: '4' }],
			]);
		});

		it('min and step', () => {
			const actual = FormField('/0..2.. Label', undefined, 'group', 'name');

			expect(actual).toEqual([
				['label', { for: 'group.name' }, 'Label'],
				['input', { type: 'number', id: 'group.name', min: '0', step: '2' }],
			]);
		});

		it('step and max', () => {
			const actual = FormField('/..2..4 Label', undefined, 'group', 'name');

			expect(actual).toEqual([
				['label', { for: 'group.name' }, 'Label'],
				['input', { type: 'number', id: 'group.name', step: '2', max: '4' }],
			]);
		});

		it('min, step, and max', () => {
			const actual = FormField('/0..2..4 Label', undefined, 'group', 'name');

			expect(actual).toEqual([
				['label', { for: 'group.name' }, 'Label'],
				['input', { type: 'number', id: 'group.name', min: '0', step: '2', max: '4' }],
			]);
		});

		it('custom type', () => {
			const actual = FormField('date/2000-01-01..7..2020-01-01 Label', undefined, 'group', 'name');

			expect(actual).toEqual([
				['label', { for: 'group.name' }, 'Label'],
				['input', { type: 'date', id: 'group.name', min: '2000-01-01', step: '7', max: '2020-01-01' }],
			]);
		});

		it('custom type reference number', () => {
			const actual = FormField('date/path//2020-01-01 Label', undefined, 'group', 'name');

			expect(actual).toEqual([
				['label', { for: 'group.name' }, 'Label'],
				['input', { type: 'date', id: 'group.name', max: '2020-01-01', dataset: { path: '/path/' } }],
			]);
		});
	});

	describe('text', () => {
		it('unpopulated', () => {
			const actual = FormField('// Label', undefined, 'group', 'name');

			expect(actual).toEqual([
				['label', { for: 'group.name' }, 'Label'],
				['input', { type: 'text', id: 'group.name' }],
			]);
		});

		it('populated', () => {
			const actual = FormField('// Label', 'abc', 'group', 'name');

			expect(actual).toEqual([
				['label', { for: 'group.name' }, 'Label'],
				['input', { type: 'text', id: 'group.name', value: 'abc' }],
			]);
		});

		it('pattern', () => {
			const actual = FormField('/\\w*/ Label', undefined, 'group', 'name');

			expect(actual).toEqual([
				['label', { for: 'group.name' }, 'Label'],
				['input', { type: 'text', id: 'group.name', pattern: '\\w*' }],
			]);
		});

		it('maxlength', () => {
			const actual = FormField('//4 Label', undefined, 'group', 'name');

			expect(actual).toEqual([
				['label', { for: 'group.name' }, 'Label'],
				['input', { type: 'text', id: 'group.name', maxlength: '4' }],
			]);
		});

		it('textarea unpopulated', () => {
			const actual = FormField('textarea// Label', undefined, 'group', 'name');

			expect(actual).toEqual([
				['label', { for: 'group.name' }, 'Label'],
				['textarea', { id: 'group.name' }],
			]);
		});

		it('textarea populated', () => {
			const actual = FormField('textarea// Label', 'abc', 'group', 'name');

			expect(actual).toEqual([
				['label', { for: 'group.name' }, 'Label'],
				['textarea', { id: 'group.name' }, 'abc'],
			]);
		});
		
		it('reference', () => {
			const actual = FormField('/path/\\w*/ Label', undefined, 'group', 'name');

			expect(actual).toEqual([
				['label', { for: 'group.name' }, 'Label'],
				['input', { type: 'text', id: 'group.name', pattern: '\\w*', dataset: { path: '/path/' } }],
			]);
		});
	});

	describe('other', () => {
		it('sets placeholder', () => {
			const actual = FormField('Enter Value // Field Name', undefined, 'group', 'name');

			expect(actual).toEqual([
				['label', { for: 'group.name' }, 'Field Name'],
				['input', { type: 'text', id: 'group.name', placeholder: 'Enter Value' }],
			]);
		});

		it('sets as required', () => {
			const actual = FormField('//* Label', undefined, 'group', 'name');

			expect(actual).toEqual([
				['label', { for: 'group.name' }, 'Label'],
				['input', { type: 'text', id: 'group.name', required: true }],
			]);
		});
		
		it('checkbox unpopulated', () => {
			const actual = FormField('Label', undefined, 'group', 'name');

			expect(actual).toEqual([
				['input', { type: 'checkbox', id: 'group.name' }],
				['label', { for: 'group.name' }, 'Label'],
			]);
		});

		it('checkbox populated', () => {
			const actual = FormField('Label', true, 'group', 'name');

			expect(actual).toEqual([
				['input', { type: 'checkbox', id: 'group.name', checked: true }],
				['label', { for: 'group.name' }, 'Label'],
			]);
		});

		it('object unpopulated', () => {
			const actual = FormField({
				number: '/ Number',
				text: '// Text',
			}, undefined, 'group');

			expect(actual).toEqual([
				['label', { for: 'group.number' }, 'Number'],
				['input', { type: 'number', id: 'group.number' }, ],
				['label', { for: 'group.text' }, 'Text'],
				['input', { type: 'text', id: 'group.text' }, ],
			]);
		});

		it('object populated', () => {
			const actual = FormField({
				number: '/ Number',
				text: '// Text',
			}, {
				number: 123,
				text: 'abc',
			}, 'group');

			expect(actual).toEqual([
				['label', { for: 'group.number' }, 'Number'],
				['input', { type: 'number', id: 'group.number', value: '123' }, ],
				['label', { for: 'group.text' }, 'Text'],
				['input', { type: 'text', id: 'group.text', value: 'abc' }],
			]);
		});
	});

	// 'Label': checkbox
	// ['Label', ...]: radio buttons showing each option
	// - display form options if non-literal is selected

	// '/ Label': number input
	// ['/ Label', ...]: select box where selection creates a new array item

	// '// Label': string input
	// ['// Label', ...]: select box where selection creates a new property in an object
	// - key must stick to pattern and range
	// - not sure what the use would be for this, but it makes the most sense for the format
	// - essentially, the type sets the key format of object/array

	describe('select', () => {
		it('unpopulated', () => {
			const actual = FormField(['Label',
				'123 */ Number',
				'abc *// Text',
			], undefined, 'group', 'name');

			expect(actual).toEqual([
				['label', {}, 'Label'],
				['select', { onchange: expect.any(Function) },
					['option', {}, 'Select item...'],
					['option', {}, 'Number'],
					['option', {}, 'Text'],
				],
				['', {}],
			]);
		});

		it('populated with literal', () => {
			const actual = FormField(['Label',
				'/ Number',
				'abc *// Text',
			], 'abc', 'group', 'name');

			expect(actual).toEqual([
				['label', {}, 'Label'],
				['select', { onchange: expect.any(Function) },
					['option', {}, 'Select item...'],
					['option', {}, 'Number'],
					['option', { selected: true }, 'Text'],
				],
				['input', { type: 'text', id: 'group.name', placeholder: 'abc', disabled: true, value: 'abc' }],
			]);
		});

		it('populated with non-literal', () => {
			const actual = FormField(['Label',
				'/ Number',
				'// Text',
			], 'abc', 'group', 'name');

			expect(actual).toEqual([
				['label', {}, 'Label'],
				['select', { onchange: expect.any(Function) },
					['option', {}, 'Select item...'],
					['option', {}, 'Number'],
					['option', { selected: true }, 'Text'],
				],
				['input', { type: 'text', id: 'group.name', value: 'abc'}]
			]);
		});

		it('set', () => {
			const actual = FormField(['Label',
				'123 */ Number',
				'abc *// Text',
			], undefined, 'group', 'name');

			const select = actual[1];
			const { onchange } = select[1];
			onchange({ selectedIndex: 2 });

			expect(actual).toEqual([
				['label', {}, 'Label'],
				['select', { onchange: expect.any(Function) },
					['option', {}, 'Select item...'],
					['option', {}, 'Number'],
					['option', {}, 'Text'],
				],
				['input', { type: 'text', id: 'group.name', placeholder: 'abc', disabled: true, value: 'abc' }],
			]);
		});
		
		it('changed to literal', () => {
			const actual = FormField(['Label',
				'123 */ Number',
				'// Text',
			], 'abc', 'group', 'name');

			const select = actual[1];
			const { onchange } = select[1];
			onchange({ selectedIndex: 1 });

			expect(actual).toEqual([
				['label', {}, 'Label'],
				['select', { onchange: expect.any(Function) },
					['option', {}, 'Select item...'],
					['option', {}, 'Number'],
					['option', { selected: true }, 'Text'],
				],
				['input', { type: 'number', id: 'group.name', placeholder: '123', disabled: true, value: '123' }],
			]);
		});
		
		it('changed to non-literal', () => {
			const actual = FormField(['Label',
				'/ Number',
				'abc *// Text',
			], 'abc', 'group', 'name');

			const select = actual[1];
			const { onchange } = select[1];
			onchange({ selectedIndex: 1 });

			expect(actual).toEqual([
				['label', {}, 'Label'],
				['select', { onchange: expect.any(Function) },
					['option', {}, 'Select item...'],
					['option', {}, 'Number'],
					['option', { selected: true }, 'Text'],
				],
				['input', { type: 'number', id: 'group.name' }],
			]);
		});
		
		it('cleared', () => {
			const actual = FormField(['Label',
				'/ Number',
				'// Text',
			], 'abc', 'group', 'name');

			const select = actual[1];
			const { onchange } = select[1];
			onchange({ selectedIndex: 0 });

			expect(actual).toEqual([
				['label', {}, 'Label'],
				['select', { onchange: expect.any(Function) },
					['option', {}, 'Select item...'],
					['option', {}, 'Number'],
					['option', { selected: true }, 'Text'],
				],
				['', {}],
			]);
		});
	});

	describe('array', () => {
		it('unpopulated', () => {
			const actual = FormField(['/ Label',
				'/ Number',
				'// Text',
			], undefined, 'group');

			expect(actual).toEqual([
				['label', {}, 'Label'],
				['ol', {}],
				['select', { onchange: expect.any(Function) },
					['option', {}, 'Add item...'],
					['option', {}, 'Number'],
					['option', {}, 'Text'],
				],
			]);
		});

		it('populated', () => {
			const actual = FormField(['/ Label',
				'/ Number',
				'// Text',
			], [123, 'abc'], 'group');

			expect(actual).toEqual([
				['label', {}, 'Label'],
				['ol', {},
					['li', {},
						['input', { type: 'number', id: 'group[0]', value: '123' }],
					],
					['li', {},
						['input', { type: 'text', id: 'group[1]', value: 'abc' }],
					],
				],
				['select', { onchange: expect.any(Function) },
					['option', {}, 'Add item...'],
					['option', {}, 'Number'],
					['option', {}, 'Text'],
				],
			]);
		});

		it('added', () => {
			const actual = FormField(['/ Label',
				'/ Number',
				'// Text',
			], undefined, 'group');

			const select = actual[2];
			const { onchange } = select[1];
			onchange({ selectedIndex: 2 });

			expect(actual).toEqual([
				['label', {}, 'Label'],
				['ol', {},
					['li', {},
						['input', { type: 'text', id: 'group[0]' }],
					],
				],
				['select', { onchange: expect.any(Function) },
					['option', { selected: true }, 'Add item...'],
					['option', {}, 'Number'],
					['option', {}, 'Text'],
				],
			]);
		});
	});

	describe('object builder', () => {
		it('unpopulated', () => {
			const actual = FormField(['// Label',
				'/ Number',
				'// Text',
			], undefined, 'group');

			expect(actual).toEqual([
				['label', {}, 'Label'],
				['ul', {}],
				['input', { type: 'text' }],
				['select', { onchange: expect.any(Function) },
					['option', {}, 'Add property...'],
					['option', {}, 'Number'],
					['option', {}, 'Text'],
				],
			]);
		});

		it('populated', () => {
			const actual = FormField(['// Label',
				'/ Number',
				'// Text',
			], {
				number: 123,
				text: 'abc',
			}, 'group');

			expect(actual).toEqual([
				['label', {}, 'Label'],
				['ul', {},
					['li', {},
						['label', { for: 'group.number' }, 'number'],
						['input', { type: 'number', id: 'group.number', value: '123' }],
					],
					['li', {},
						['label', { for: 'group.text' }, 'text'],
						['input', { type: 'text', id: 'group.text', value: 'abc' }],
					],
				],
				['input', { type: 'text' }],
				['select', { onchange: expect.any(Function) },
					['option', {}, 'Add property...'],
					['option', {}, 'Number'],
					['option', {}, 'Text'],
				],
			]);
		});

		it('added', () => {
			const actual = FormField(['// Label',
				'/ Number',
				'// Text',
			], undefined, 'group');

			const input = actual[2];
			const select = actual[3];
			const { onchange } = select[1];
			input[1].value = 'text';
			onchange({ selectedIndex: 2 });

			expect(actual).toEqual([
				['label', {}, 'Label'],
				['ul', {},
					['li', {},
						['label', { for: 'group.text' }, 'text'],
						['input', { type: 'text', id: 'group.text' }],
					],
				],
				['input', { type: 'text' }],
				['select', { onchange: expect.any(Function) },
					['option', { selected: true }, 'Add property...'],
					['option', {}, 'Number'],
					['option', {}, 'Text'],
				],
			]);
		});

		it('requires name', () => {
			const actual = FormField(['// Label',
				'/ Number',
				'// Text',
			], undefined, 'group');

			const input = actual[2];
			const select = actual[3];
			const { onchange } = select[1];
			onchange({ selectedIndex: 2 });

			expect(actual).toEqual([
				['label', {}, 'Label'],
				['ul', {}],
				['input', { type: 'text' }],
				['select', { onchange: expect.any(Function) },
					['option', { selected: true }, 'Add property...'],
					['option', {}, 'Number'],
					['option', {}, 'Text'],
				],
			]);
		});
	});

	// it('array', () => {
	// 	const actual = FormField(['/.. Label'], 'group', 'name');

	// 	expect(actual).toEqual([
	// 	]);
	// });
});

// anf
// gordon fan