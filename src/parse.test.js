const { parseJS, parseMD, parse } = require('./parse');

describe('parseJS', () => {
	it('parses default import', () => {
		const map = {};

		const actual = parseJS(`
			import main from './file';
		`, map, ['root']);

		expect(actual).toEqual({
			'/file': {
				default: 'main',
			},
		});

		expect(map).toEqual({
			'/file': {
				default: new Set(['/root']),
			},
		});
	});
	
	it('parses named import', () => {
		const map = {};

		const actual = parseJS(`
			import { other } from './file';
		`, map, ['root']);

		expect(actual).toEqual({
			'/file': {
				other: 'other',
			},
		});

		expect(map).toEqual({
			'/file': {
				other: new Set(['/root']),
			},
		});
	});
	
	it('parses aliased import', () => {
		const map = {};

		const actual = parseJS(`
			import { another as alias } from './file';
		`, map, ['root']);

		expect(actual).toEqual({
			'/file': {
				another: 'alias',
			},
		});

		expect(map).toEqual({
			'/file': {
				another: new Set(['/root']),
			},
		});
	});
	
	it('parses dense import', () => {
		const map = {};

		const actual = parseJS(`
			import main, { other, another as alias } from './file';
		`, map, ['root']);

		expect(actual).toEqual({
			'/file': {
				default: 'main',
				other: 'other',
				another: 'alias',
			},
		});

		expect(map).toEqual({
			'/file': {
				default: new Set(['/root']),
				other: new Set(['/root']),
				another: new Set(['/root']),
			},
		});
	});
	
	it('parses fragmented imports', () => {
		const map = {};

		const actual = parseJS(`
			import main from './file';
			import { other } from './file';
			import { another as alias } from './file';
		`, map, ['root']);

		expect(actual).toEqual({
			'/file': {
				default: 'main',
				other: 'other',
				another: 'alias',
			},
		});

		expect(map).toEqual({
			'/file': {
				default: new Set(['/root']),
				other: new Set(['/root']),
				another: new Set(['/root']),
			},
		});
	});
	
	it('parses multiple imports', () => {
		const map = {};

		const actual = parseJS(`
			import main from './file';
			import alternate from './alternate';
		`, map, ['root']);

		expect(actual).toEqual({
			'/file': {
				default: 'main',
			},
			'/alternate': {
				default: 'alternate',
			}
		});

		expect(map).toEqual({
			'/file': {
				default: new Set(['/root']),
			},
			'/alternate': {
				default: new Set(['/root']),
			},
		});
	});

	it('parses module import', () => {
		const map = {};

		const actual = parseJS(`
			import main from 'module';
		`, map, ['root']);

		expect(actual).toEqual({
			'module': {
				default: 'main',
			},
		});

		expect(map).toEqual({
			'module': {
				default: new Set(['/root']),
			},
		});
	});

	it('parses deep import', () => {
		const map = {};

		const actual = parseJS(`
			import main from './folder/file';
		`, map, ['root']);

		expect(actual).toEqual({
			'/folder/file': {
				default: 'main',
			},
		});

		expect(map).toEqual({
			'/folder/file': {
				default: new Set(['/root']),
			},
		});
	});

	it('parses shallow import', () => {
		const map = {};

		const actual = parseJS(`
			import main from '../root';
		`, map, ['folder', 'file']);

		expect(actual).toEqual({
			'/root': {
				default: 'main',
			},
		});

		expect(map).toEqual({
			'/root': {
				default: new Set(['/folder/file']),
			},
		});
	});

	it('parses sibling import', () => {
		const map = {};

		const actual = parseJS(`
			import main from './sibling';
		`, map, ['folder', 'file']);

		expect(actual).toEqual({
			'/folder/sibling': {
				default: 'main',
			},
		});

		expect(map).toEqual({
			'/folder/sibling': {
				default: new Set(['/folder/file']),
			},
		});
	});

	it('parses JSX', () => {
		const map = {};

		const actual = parseJS(`
			import main from './file';
			const paragraph = <p>Paragraph</p>;
		`, map, ['root']);

		expect(actual).toEqual({
			'/file': {
				default: 'main',
			},
		});

		expect(map).toEqual({
			'/file': {
				default: new Set(['/root']),
			},
		});
	});

	it.skip('parses TS', () => {
		const map = {};

		const actual = parseJS(`
			import main from './file';
			const text: string = 'abc';
		`, map, ['root']);

		expect(actual).toEqual({
			'/file': {
				default: 'main',
			},
		});

		expect(map).toEqual({
			'/file': {
				default: new Set(['/root']),
			},
		});
	});
});

describe('parseMD', () => {
	// refernce links are a part of the markdown syntax
	// - these should be stored in the area before the first heading, similar to JS files
	//   - cuts down on processing of entire file
	// - these are then used in MD as [Text][label]
	it.only('parses default reference', () => {
		const actual = parse(
`[main]: ./file
# Header {#local}
[Main Label][main]`
		, 'md');

		/*
			// this goal should be a condensed set of links and line references that can be used to focus imports/exports in editor
			[
				[startIndex, finishIndex, ...references]
				// references are things that this section depends on
				// string references are imports (e.g. ./file#name or ./file for default)
				// integer references are for sections of current file (index is for this curren array)
			]

			map = {
				'./file': {
					imports: {
						'./other': {
							// array of which vars/exports in file use this import
							default: [...localRefIndexes]
						}
					},
					locals: [
						// indexes of block or expression, as well as index of other local it depends on
						// - these can be local reference links for MD, or variables for JS
						[startIndex, finishIndex, ...localRefIndexes],
					],
					exports: {
						// index of local to use as export, and a list of other files that import it
						local: [localRefIndex, ...subscriberStrings]
					}
				}
			};

			// subscribe strings are the only values that are updated after the file has been parsed
			// - subscriber stirngs are added whenever another file is parsed that imports on of these exports
			// - when modifying or deleting, it should backtrack through it direct import files and clear the subscriber string first

			// imports hold the specific locals from imported files that are referenced, and a list of all locals from this file that use them
			// - this allows traversing up the tree
			// - look at imports of files that were imported, and find which ones the specific imports needs to continue traversing
			// - need to first look at exports to see which local ref is used for it

			// locals are used to show a focused subside of the file that relates to the imports from the active file in editor
			// - can also limit it to content needed for a specific 

			// exports hold the start and finish index of their content, then a list of files that reference it
			// - this allows traversing further down the tree
			// - look at the imports of each file in list to find its locals entries, and continue for the files there

			// keep track of all visited nodes with traversing in either direction to prevent endless reference loops

			// TODO: friday (traversal helpers)
			// - rework the helpers that find imports/exports by level to accomodate the new map structure
			// - both can now use map, instead of one of them using individual nodes
		*/

		expect(actual).toEqual(['md', {
			'./file': {
				main: [0],
			},
			'': {
				local: 0,
			},
		},
			[0, 0],
		]);
	});

	it('parses named reference', () => {
		const map = {};

		const actual = parseMD(`
[other]: ./file#other
# Header {#local}
[Other Label][other]
		`, map, ['root']);

		expect(actual).toEqual({
			'/file': {
				other: ['local']
			},
		});
		
		expect(map).toEqual({
			'/file': {
				other: {
					'/root': ['local'],
				}
			},
			'/root': {
				local: {},
			},
		});
	});

	it('parses aliased reference', () => {
		const map = {};

		const actual = parseMD(`
[alias]: ./file#another
# Header {#local}
[Alias Label][alias]
		`, map, ['root']);

		expect(actual).toEqual({
			'/file': {
				another: ['local'],
			},
		});
		
		expect(map).toEqual({
			'/file': {
				another: {
					'/root': ['local'],
				}
			},
			'/root': {
				local: {},
			},
		});
	});
	
	it('parses tag', () => {
		const map = {};

		const actual = parseMD(`
# Header {#local}
#tag
		`, map, ['root']);

		expect(actual).toEqual({
			'/': {
				tag: ['local'],
			},
		});
		
		expect(map).toEqual({
			'/': {
				tag: {
					'/root': ['local'],
				}
			},
			'/root': {
				local: {},
			},
		});
	});

	// allow for #tags, which are global to project
	// - these are similar to external modules in JS
	// - these are allowed throughout content, not just in header
});

describe('parse', () => {
	it('parses default reference', () => {
		const actual = parse(
`[main]: ./file
# Header {#local}
[Main Label][main]`
		, 'md');

		/*
			// this goal should be a condensed set of links and line references that can be used to focus imports/exports in editor
			[
				[startIndex, finishIndex, ...references]
				// references are things that this section depends on
				// string references are imports (e.g. ./file#name or ./file for default)
				// integer references are for sections of current file (index is for this curren array)
			]

			map = {
				'./file': {
					imports: {
						'./other': {
							// array of which vars/exports in file use this import
							default: [...localRefIndexes]
						}
					},
					locals: [
						// indexes of block or expression, as well as index of other local it depends on
						// - these can be local reference links for MD, or variables for JS
						[startIndex, finishIndex, ...localRefIndexes],
					],
					exports: {
						// index of local to use as export, and a list of other files that import it
						local: [localRefIndex, ...subscriberStrings]
					}
				}
			};

			// subscribe strings are the only values that are updated after the file has been parsed
			// - subscriber stirngs are added whenever another file is parsed that imports on of these exports
			// - when modifying or deleting, it should backtrack through it direct import files and clear the subscriber string first

			// imports hold the specific locals from imported files that are referenced, and a list of all locals from this file that use them
			// - this allows traversing up the tree
			// - look at imports of files that were imported, and find which ones the specific imports needs to continue traversing
			// - need to first look at exports to see which local ref is used for it

			// locals are used to show a focused subside of the file that relates to the imports from the active file in editor
			// - can also limit it to content needed for a specific 

			// exports hold the start and finish index of their content, then a list of files that reference it
			// - this allows traversing further down the tree
			// - look at the imports of each file in list to find its locals entries, and continue for the files there

			// keep track of all visited nodes with traversing in either direction to prevent endless reference loops

			// TODO: friday (traversal helpers)
			// - rework the helpers that find imports/exports by level to accomodate the new map structure
			// - both can now use map, instead of one of them using individual nodes
		*/

		expect(actual).toEqual(['md', {
			'./file': {
				main: [0],
			},
			'': {
				local: 0,
			},
		},
			[0, 0],
		]);
	});

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
			'': ['local'],
		});
	});

	it('parses aliased reference', () => {
		const actual = parse(`
[alias]: ./file#another
# Header {#local}
[Alias Label][alias]
		`, 'md');

		expect(actual).toEqual({
			'./file': {
				another: ['local'],
			},
			'': ['local'],
		});
	});
	
	it('parses tag', () => {
		const actual = parse(`
# Header {#local}
#tag
		`, 'md');

		expect(actual).toEqual({
			'/': {
				tag: ['local'],
			},
			'': ['local'],
		});
	});
});
