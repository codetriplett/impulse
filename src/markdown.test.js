import parse, { parseInline } from './markdown';

describe('parseInline', () => {
	// TODO: need to make sure table regex will skip over this format both at start of line and in table
	it('spoiler tag', () => {
		const actual = parseInline('||Item||');

		// TODO: test this with CSS
		// - this should work, since stew will clear the onlick attribute when clicked, and the new props are used
		/*
			span[onclick] {
				color: transparent;
				background: var(--font-color);
				user-select: none;
			} 
		*/
		expect(actual).toEqual([
			['span', { onclick: {} }, 'Item']
		]);
	});

	describe('links', () => {
		it('relative', () => {
			const actual = parseInline('[Label](/path)');

			expect(actual).toEqual([
				['a', { href: '/path' }, 'Label']
			]);
		});

		it('absolute', () => {
			const actual = parseInline('[Label](http://www.domain.com/path)');

			expect(actual).toEqual([
				['a', { href: 'http://www.domain.com/path' }, 'Label']
			]);
		});

		it('dotted', () => {
			const actual = parseInline('[Label](./path)', ['site', 'category', 'other']);

			expect(actual).toEqual([
				['a', { href: '/site/category/path' }, 'Label']
			]);
		});

		it('backtrack', () => {
			const actual = parseInline('[Label](../path)', ['site', 'category', 'other']);

			expect(actual).toEqual([
				['a', { href: '/site/path' }, 'Label']
			]);
		});

		it('title double quotes', () => {
			const actual = parseInline('[Label](/path "Title")');

			expect(actual).toEqual([
				['a', { href: '/path', title: 'Title' }, 'Label']
			]);
		});

		it('title single quotes', () => {
			const actual = parseInline('[Label](/path \'Title\')');

			expect(actual).toEqual([
				['a', { href: '/path', title: 'Title' }, 'Label']
			]);
		});

		it('reference', () => {
			const links = [];
			const actual = parseInline('[Label][key]', ['site'], links);
			const node = ['a', 'key', 'Label'];
			expect(actual).toEqual([node]);
			expect(links).toEqual([node]);
		});
	});
});

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
	
	describe('preformatted', () => {
		it('tab indentation', () => {
			const actual = parse('\tabc');

			expect(actual).toEqual(['', {},
				['pre', { '': 0 },
					['code', {}, 'abc'],
				],
			]);
		});
		
		it('space indentation', () => {
			const actual = parse('    abc');

			expect(actual).toEqual(['', {},
				['pre', { '': 0 },
					['code', {}, 'abc'],
				],
			]);
		});
		
		it('multiple lines', () => {
			const actual = parse('\tabc\n\txyz');

			expect(actual).toEqual(['', {},
				['pre', { '': 0 },
					['code', {}, 'abc\nxyz'],
				],
			]);
		});
		
		it('several newlines', () => {
			const actual = parse('\tabc\n\n\n\txyz');

			expect(actual).toEqual(['', {},
				['pre', { '': 0 },
					['code', {}, 'abc\n\n\nxyz'],
				],
			]);
		});
		
		it('tick wrapped', () => {
			const actual = parse('```\nabc\n```');

			expect(actual).toEqual(['', {},
				['pre', { '': 0 },
					['code', {}, 'abc'],
				],
			]);
		});
		
		it('nested ticks', () => {
			const actual = parse('````\n```\nabc\n```\n````');

			expect(actual).toEqual(['', {},
				['pre', { '': 0 },
					['code', {}, '```\nabc\n```'],
				],
			]);
		});
	});

	describe('list', () => {
		it('unordered', () => {
			const actual = parse('- Item');

			expect(actual).toEqual(['', {},
				['ul', {},
					['li', { '': 0 }, 'Item'],
				],
			]);
		});
		
		it('multiple items', () => {
			const actual = parse('- Item\n- Adjacent');

			expect(actual).toEqual(['', {},
				['ul', {},
					['li', { '': 0 }, 'Item'],
					['li', { '': 7 }, 'Adjacent'],
				],
			]);
		});

		it('in paragraphs', () => {
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

		it('separated', () => {
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
		
		it('ordered', () => {
			const actual = parse('1. Item\n2. Adjacent');

			expect(actual).toEqual(['', {},
				['ol', {},
					['li', { '': 0 }, 'Item'],
					['li', { '': 8 }, 'Adjacent'],
				],
			]);
		});
		
		it('offset start', () => {
			const actual = parse('2. Item\n3. Adjacent');

			expect(actual).toEqual(['', {},
				['ol', { start: '2' },
					['li', { '': 0 }, 'Item'],
					['li', { '': 8 }, 'Adjacent'],
				],
			]);
		});

		it('mixed', () => {
			const actual = parse('- Item\n\n1. Adjacent');

			expect(actual).toEqual(['', {},
				['ul', {},
					['li', { '': 0 }, 'Item'],
				],
				['ol', {},
					['li', { '': 8 }, 'Adjacent'],
				],
			]);
		});
		
		it('nested', () => {
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
	
	describe('table', () => {
		it('cell', () => {
			const actual = parse('|Item|');

			expect(actual).toEqual(['', {},
				['table', {},
					['tbody', {},
						['tr', { '': 0 },
							['td', {}, 'Item'],
						],
					],
				],
			]);
		});

		it('grid', () => {
			const actual = parse('|1|2|3|\n|A|B|C|');

			expect(actual).toEqual(['', {},
				['table', {},
					['tbody', {},
						['tr', { '': 0 },
							['td', {}, '1'],
							['td', {}, '2'],
							['td', {}, '3'],
						],
						['tr', { '': 8 },
							['td', {}, 'A'],
							['td', {}, 'B'],
							['td', {}, 'C'],
						],
					],
				],
			]);
		});
		
		it('with alignment', () => {
			const actual = parse('|---|:-:|--:|\n|1|2|3|\n|A|B|C|');

			expect(actual).toEqual(['', {},
				['table', {},
					['tbody', {},
						['tr', { '': 14 },
							['td', {}, '1'],
							['td', { style: { textAlign: 'center' } }, '2'],
							['td', { style: { textAlign: 'right' } }, '3'],
						],
						['tr', { '': 22 },
							['td', {}, 'A'],
							['td', { style: { textAlign: 'center' } }, 'B'],
							['td', { style: { textAlign: 'right' } }, 'C'],
						],
					],
				],
			]);
		});
		
		it('with header', () => {
			const actual = parse('|L|C|R|\n|---|:-:|--:|\n|1|2|3|\n|A|B|C|');

			expect(actual).toEqual(['', {},
				['table', {},
					['thead', {},
						['tr', { '': 0 },
							['th', {}, 'L'],
							['th', { style: { textAlign: 'center' } }, 'C'],
							['th', { style: { textAlign: 'right' } }, 'R'],
						],
					],
					['tbody', {},
						['tr', { '': 22 },
							['td', {}, '1'],
							['td', { style: { textAlign: 'center' } }, '2'],
							['td', { style: { textAlign: 'right' } }, '3'],
						],
						['tr', { '': 30 },
							['td', {}, 'A'],
							['td', { style: { textAlign: 'center' } }, 'B'],
							['td', { style: { textAlign: 'right' } }, 'C'],
						],
					],
				],
			]);
		});
		
		it('with multple alignments', () => {
			const actual = parse('|---|:-:|--:|\n|1|2|3|\n|:-:|--:|---|\n|A|B|C|');

			expect(actual).toEqual(['', {},
				['table', {},
					['tbody', {},
						['tr', { '': 14 },
							['td', {}, '1'],
							['td', { style: { textAlign: 'center' } }, '2'],
							['td', { style: { textAlign: 'right' } }, '3'],
						],
						['tr', { '': 36 },
							['td', { style: { textAlign: 'center' } }, 'A'],
							['td', { style: { textAlign: 'right' } }, 'B'],
							['td', {}, 'C'],
						],
					],
				],
			]);
		});
	});

	describe('link references', () => {
		it('upper definition', () => {
			const actual = parse('[key]: /path\n[Item][key]');

			expect(actual).toEqual(['', {},
				['p', { '': 13 },
					['a', { href: '/path' }, 'Item'],
				],
			]);
		});

		it('upper definition', () => {
			const actual = parse('[Item][key]\n[key]: /path');

			expect(actual).toEqual(['', {},
				['p', { '': 0 },
					['a', { href: '/path' }, 'Item'],
				],
			]);
		});
	});
});

// statements: line prefix
// expressions: within text on line
// list: wrap around statements (sets indentation based on spaces before first character in text)
// - put all content that has the same indentation level within the list item
// - also include paragraph content that is directly below li as content for li, regardless of indentation
// - lis that exist at the parent's indentation will be nested as well
