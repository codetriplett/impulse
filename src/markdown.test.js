import parse, { parseInline } from './markdown';

describe('parseInline', () => {
	it('spoiler tag', () => {
		const actual = parseInline('||Item||');

		expect(actual).toEqual([
			['span', {
				onclick: {
					style: {
						color: 'transparent',
					},
				},
			}, 'Item']
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

	describe('headline', () => {
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
		
		it('one hash', () => {
			const actual = parse('# Headline');

			expect(actual).toEqual(['', {},
				[1, { '': 0 }, 'Headline'],
			]);
		});
		
		it('six hashes', () => {
			const actual = parse('###### Headline');

			expect(actual).toEqual(['', {},
				[6, { '': 0 }, 'Headline'],
			]);
		});
		
		it('with link', () => {
			const actual = parse('# Headline {#lmno}', '#');

			expect(actual).toEqual(['', {},
				[1, { '': 0, id: 'lmno' },
					['a', { href: '#lmno' }, 'Headline'],
				],
			]);
		});
		
		it('without custom prefix link', () => {
			const actual = parse('# Headline', '#');

			expect(actual).toEqual(['', {},
				[1, { '': 0 }, 'Headline'],
			]);
		});
		
		it('with custom prefix link', () => {
			const actual = parse('# Headline', '#thing');

			expect(actual).toEqual(['', {},
				[1, { '': 0, id: 'thing1' },
					['a', { href: '#thing1' }, 'Headline'],
				],
			]);
		});

		it('hash tag', () => {
			const actual = parse('#lmno');

			expect(actual).toEqual(['', {},
				['p', { '': 0 }, '#lmno'],
			]);
		});
		
		it('extra hashes', () => {
			const actual = parse('####### Headline');

			expect(actual).toEqual(['', {},
				['p', { '': 0 }, '####### Headline'],
			]);
		});
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
		
		it('definition list', () => {
			const actual = parse('Item\n: Child');

			expect(actual).toEqual(['', {},
				['dl', {},
					['dt', { '': 0 }, 'Item'],
					['dd', { '': 5 }, 'Child'],
				],
			]);
		});
		
		it('definition multiple', () => {
			const actual = parse('Item\n: Child\n: Adjacent');

			expect(actual).toEqual(['', {},
				['dl', {},
					['dt', { '': 0 }, 'Item'],
					['dd', { '': 5 }, 'Child'],
					['dd', { '': 13 }, 'Adjacent'],
				],
			]);
		});
		
		it('definition spaced', () => {
			const actual = parse('Item\n\n: Child\n\n: Adjacent');

			expect(actual).toEqual(['', {},
				['dl', {},
					['dt', { '': 0 }, 'Item'],
					['dd', { '': 6 },
						['p', {}, 'Child'],
					],
					['dd', { '': 15 },
						['p', {}, 'Adjacent'],
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

		it('ignores spoiler', () => {
			const actual = parse('||Item||');

			expect(actual).toEqual(['', {},
				['p', { '': 0 },
					['span', {
						onclick: {
							style: {
								color: 'transparent',
							},
						},
					}, 'Item'],
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

	describe('id', () => {
		it('paragraph', () => {
			const actual = parse('Item {#lmno}');

			expect(actual).toEqual(['', {},
				['p', { '': 0, id: 'lmno' }, 'Item'],
			]);
		});

		it('headline', () => {
			const actual = parse('# Headline {#lmno}');

			expect(actual).toEqual(['', {},
				[1, { '': 0, id: 'lmno' }, 'Headline'],
			]);
		});
		
		it('list', () => {
			const actual = parse('{#lmno}\n- Item');

			expect(actual).toEqual(['', {},
				['ul', { id: 'lmno' },
					['li', { '': 8 }, 'Item'],
				],
			]);
		});

		it('list item', () => {
			const actual = parse('- Item {#lmno}');

			expect(actual).toEqual(['', {},
				['ul', {},
					['li', { '': 0, id: 'lmno' }, 'Item'],
				],
			]);
		});

		it('table', () => {
			const actual = parse('{#lmno}\n|1|2|3|\n|A|B|C|');

			expect(actual).toEqual(['', {},
				['table', { id: 'lmno' },
					['tbody', {},
						['tr', { '': 8 },
							['td', {}, '1'],
							['td', {}, '2'],
							['td', {}, '3'],
						],
						['tr', { '': 16 },
							['td', {}, 'A'],
							['td', {}, 'B'],
							['td', {}, 'C'],
						],
					],
				],
			]);
		});

		it('table row', () => {
			const actual = parse('|Item|{#lmno}');

			expect(actual).toEqual(['', {},
				['table', {},
					['tbody', {},
						['tr', { '': 0, id: 'lmno' },
							['td', {}, 'Item'],
						],
					],
				],
			]);
		});
	});

	describe('range', () => {
		it('ignores before', () => {
			const actual = parse('# Before\n# Heading\n# After', '', 9);

			expect(actual).toEqual(['', {},
				[1, { '': 9 }, 'Heading'],
				[1, { '': 19 }, 'After'],
			]);
		});

		it('ignores after', () => {
			const actual = parse('# Before\n# Heading\n# After', '', 9, 19);

			expect(actual).toEqual(['', {},
				[1, { '': 9 }, 'Heading'],
			]);
		});

		it('includes heading path', () => {
			const actual = parse('# Before\n# Heading {#lmno}', '/path#', 9);

			expect(actual).toEqual(['', {},
				[1, { '': 9, id: 'lmno' },
					['a', { href: '/path#lmno' }, 'Heading'],
				],
			]);
		});

		it('includes link definitions', () => {
			const actual = parse('[lmno]: /lmno\n# Before\n# Heading\n[Lmno][lmno]', '', 23);

			expect(actual).toEqual(['', {},
				[1, { '': 23 }, 'Heading'],
				['p', { '': 33 },
					['a', { href: '/lmno' }, 'Lmno'],
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
