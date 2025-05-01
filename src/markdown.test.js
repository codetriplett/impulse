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
	
	it('list several', () => {
		const actual = parse('- Item\n- Adjacent');

		expect(actual).toEqual(['', {},
			['ul', {},
				['li', { '': 0 }, 'Item'],
				['li', { '': 7 }, 'Adjacent'],
			],
		]);
	});
});
