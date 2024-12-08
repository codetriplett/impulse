const { parse } = require('./impulse');

describe('parse', () => {
	it('parses default import', () => {
		const actual = parse(
`[other]: ./file#other
# Header {#local}
[Other Label][other]`
		, 'md');

		expect(actual).toEqual({
			'./file': {
				other: ['local']
			},
		});
	});
});
