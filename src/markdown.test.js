import parse from './markdown';

describe('parse', () => {
	it('paragraph', () => {
		const actual = parse('Paragraph');

		expect(actual).toEqual(['', {},
			['p', { '': 0 }, 'Paragraph'],
		]);
	});

	it('paragraph with br', () => {
		const actual = parse('Paragraph\nAdjacent');

		expect(actual).toEqual(['', {},
			['p', { '': 0 }, 'Paragraph', ['br'], 'Adjacent'],
		]);
	});

	it('paragraph separate', () => {
		const actual = parse('Paragraph\n\nAdjacent');

		expect(actual).toEqual(['', {},
			['p', { '': 0 }, 'Paragraph'],
			['p', { '': 11 }, 'Adjacent'],
		]);
	});

	it('headline', () => {
		const actual = parse('# Headline');

		expect(actual).toEqual(['', {},
			[1, { '': 0 }, 'Headline'],
		]);
	});

	it('headline primary', () => {
		const actual = parse('Headline\n===');

		expect(actual).toEqual(['', {},
			[1, { '': 0 }, 'Headline'],
		]);
	});

	it('headline secondary', () => {
		const actual = parse('Headline\n---');

		expect(actual).toEqual(['', {},
			[2, { '': 0 }, 'Headline'],
		]);
	});
	
	it('list', () => {
		const actual = parse('- Item');

		expect(actual).toEqual(['', {},
			['ul', {},
				['li', { '': 0 }, 'Item'],
			],
		]);
	});
	
	it('list grouped', () => {
		const actual = parse('- Item\n- Adjacent');

		expect(actual).toEqual(['', {},
			['ul', {},
				['li', { '': 0 }, 'Item'],
				['li', { '': 7 }, 'Adjacent'],
			],
		]);
	});

	it('list spaced', () => {
		const actual = parse('- Item\n\n- Adjacent');

		expect(actual).toEqual(['', {},
			['ul', {},
				['li', { '': 0 },
					['p', {}, 'Item'],
				],
				['li', { '': 8 },
					['p', {}, 'Adjacent'],
				],
			],
		]);
	});

	it('list separated', () => {
		const actual = parse('- Item\n\n\n- Adjacent');

		expect(actual).toEqual(['', {},
			['ul', {},
				['li', { '': 0 }, 'Item'],
			],
			['ul', {},
				['li', { '': 9 }, 'Adjacent'],
			],
		]);
	});
	
	it('list ordered', () => {
		const actual = parse('1. Item\n2. Adjacent');

		expect(actual).toEqual(['', {},
			['ol', {},
				['li', { '': 0 }, 'Item'],
				['li', { '': 8 }, 'Adjacent'],
			],
		]);
	});
	
	it('list offset', () => {
		const actual = parse('2. Item\n3. Adjacent');

		expect(actual).toEqual(['', {},
			['ol', { start: '2' },
				['li', { '': 0 }, 'Item'],
				['li', { '': 8 }, 'Adjacent'],
			],
		]);
	});
	
	it('preformatted', () => {
		const actual = parse('\tabc');

		expect(actual).toEqual(['', {},
			['pre', { '': 0 },
				['code', {}, 'abc'],
			],
		]);
	});
	
	it('preformatted spaces', () => {
		const actual = parse('    abc');

		expect(actual).toEqual(['', {},
			['pre', { '': 0 },
				['code', {}, 'abc'],
			],
		]);
	});
	
	it('preformatted grouped', () => {
		const actual = parse('\tabc\n\txyz');

		expect(actual).toEqual(['', {},
			['pre', { '': 0 },
				['code', {}, 'abc\nxyz'],
			],
		]);
	});
	
	it('list nested', () => {
		const actual = parse('- Item\n  - Child');

		expect(actual).toEqual(['', {},
			['ul', {},
				['li', { '': 0 },
					'Item',
					['ul', {},
						['li', { '': 9 }, 'Child'],
					],
				],
			],
		]);
	});
});

// statements: line prefix
// expressions: within text on line
// list: wrap around statements (sets indentation based on spaces before first character in text)
// - put all content that has the same indentation level within the list item
// - also include paragraph content that is directly below li as content for li, regardless of indentation
// - lis that exist at the parent's indentation will be nested as well
