import { FormField } from './form';

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

describe('FormField', () => {
	it('checkbox', () => {
		const actual = FormField('Label', 'group', 'name');

		expect(actual).toEqual([
			['input', { type: 'checkbox', id: 'group.name' }],
			['label', { for: 'group.name' }, 'Label'],
		]);
	});

	it('number', () => {
		const actual = FormField('/ Label', 'group', 'name');

		expect(actual).toEqual([
			['label', { for: 'group.name' }, 'Label'],
			['input', { type: 'number', id: 'group.name' }],
		]);
	});

	it('number with range longhand', () => {
		const actual = FormField('/.. Label', 'group', 'name');

		expect(actual).toEqual([
			['label', { for: 'group.name' }, 'Label'],
			['input', { type: 'number', id: 'group.name' }],
		]);
	});

	it('number with max shorthand', () => {
		const actual = FormField('/4 Label', 'group', 'name');

		expect(actual).toEqual([
			['label', { for: 'group.name' }, 'Label'],
			['input', { type: 'number', id: 'group.name', max: '4' }],
		]);
	});

	it('number with max', () => {
		const actual = FormField('/..4 Label', 'group', 'name');

		expect(actual).toEqual([
			['label', { for: 'group.name' }, 'Label'],
			['input', { type: 'number', id: 'group.name', max: '4' }],
		]);
	});

	it('number with min', () => {
		const actual = FormField('/0.. Label', 'group', 'name');

		expect(actual).toEqual([
			['label', { for: 'group.name' }, 'Label'],
			['input', { type: 'number', id: 'group.name', min: '0' }],
		]);
	});

	it('number with step', () => {
		const actual = FormField('/..2.. Label', 'group', 'name');

		expect(actual).toEqual([
			['label', { for: 'group.name' }, 'Label'],
			['input', { type: 'number', id: 'group.name', step: '2' }],
		]);
	});

	it('number with min and max', () => {
		const actual = FormField('/0..4 Label', 'group', 'name');

		expect(actual).toEqual([
			['label', { for: 'group.name' }, 'Label'],
			['input', { type: 'number', id: 'group.name', min: '0', max: '4' }],
		]);
	});

	it('number with min and step', () => {
		const actual = FormField('/0..2.. Label', 'group', 'name');

		expect(actual).toEqual([
			['label', { for: 'group.name' }, 'Label'],
			['input', { type: 'number', id: 'group.name', min: '0', step: '2' }],
		]);
	});

	it('number with step and max', () => {
		const actual = FormField('/..2..4 Label', 'group', 'name');

		expect(actual).toEqual([
			['label', { for: 'group.name' }, 'Label'],
			['input', { type: 'number', id: 'group.name', step: '2', max: '4' }],
		]);
	});

	it('number with min, step, and max', () => {
		const actual = FormField('/0..2..4 Label', 'group', 'name');

		expect(actual).toEqual([
			['label', { for: 'group.name' }, 'Label'],
			['input', { type: 'number', id: 'group.name', min: '0', step: '2', max: '4' }],
		]);
	});

	it('custom number type', () => {
		const actual = FormField('date/2000-01-01..7..2020-01-01 Label', 'group', 'name');

		expect(actual).toEqual([
			['label', { for: 'group.name' }, 'Label'],
			['input', { type: 'date', id: 'group.name', min: '2000-01-01', step: '7', max: '2020-01-01' }],
		]);
	});

	it('custom number type reference number', () => {
		const actual = FormField('date/path//2020-01-01 Label', 'group', 'name');

		expect(actual).toEqual([
			['label', { for: 'group.name' }, 'Label'],
			['input', { type: 'date', id: 'group.name', max: '2020-01-01', dataset: { path: '/path/' } }],
		]);
	});

	it('text', () => {
		const actual = FormField('// Label', 'group', 'name');

		expect(actual).toEqual([
			['label', { for: 'group.name' }, 'Label'],
			['input', { type: 'text', id: 'group.name' }],
		]);
	});

	it('text with pattern', () => {
		const actual = FormField('/\\w*/ Label', 'group', 'name');

		expect(actual).toEqual([
			['label', { for: 'group.name' }, 'Label'],
			['input', { type: 'text', id: 'group.name', pattern: '\\w*' }],
		]);
	});

	it('text with maxlength', () => {
		const actual = FormField('//4 Label', 'group', 'name');

		expect(actual).toEqual([
			['label', { for: 'group.name' }, 'Label'],
			['input', { type: 'text', id: 'group.name', maxlength: '4' }],
		]);
	});
	
	it('reference', () => {
		const actual = FormField('/path/\\w*/ Label', 'group', 'name');

		expect(actual).toEqual([
			['label', { for: 'group.name' }, 'Label'],
			['input', { type: 'text', id: 'group.name', pattern: '\\w*', dataset: { path: '/path/' } }],
		]);
	});

	it.skip('sets placeholder', () => {
		const actual = FormField('Enter Value // Field Name', 'group', 'name');

		expect(actual).toEqual([
			['label', { for: 'group.name' }, 'Field Name'],
			['input', { type: 'text', id: 'group.name', placeholder: 'Enter Value' }],
		]);
	});

	it('object', () => {
		const actual = FormField({
			number: '/ Number',
			text: '// Text',
		}, 'group');

		expect(actual).toEqual([
			['label', { for: 'group.number' }, 'Number'],
			['input', { type: 'number', id: 'group.number' }, ],
			['label', { for: 'group.text' }, 'Text'],
			['input', { type: 'text', id: 'group.text' }, ],
		]);
	});

	it('option', () => {
		const actual = FormField(['Label',
			'123 / Number',
			'abc // Text',
		], 'group', 'name');

		expect(actual).toEqual([
			['label', { for: 'group.name' }, 'Label'],
			['select', { id: 'group.name'},
				['option', { value: '123', dataset: { type: 'number' } }, 'Number'],
				['option', { value: 'abc' }, 'Text'],
			],
		]);
	});

	// it('array', () => {
	// 	const actual = FormField(['/.. Label'], 'group', 'name');

	// 	expect(actual).toEqual([
	// 	]);
	// });
});

// anf
// gordon fan