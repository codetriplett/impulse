const { parseJS, parseMD, parse } = require('./parse');

describe('parseJS', () => {
	it('parses default import', () => {
		const actual = parseJS(
`import main from './file';
export const local = main;`);

		expect(actual).toEqual({
			'./file': {
				default: [0],
			},
			'': {
				local: [0, 0],
				'': [0],
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

describe.only('parseMD', () => {
	// refernce links are a part of the markdown syntax
	// - these should be stored in the area before the first heading, similar to JS files
	//   - cuts down on processing of entire file
	// - these are then used in MD as [Text][label]

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





		// and array where an object is expected is the same as { '': [] }
		/* ['md', {
			'./file': {
				main: [...refs], // refs that rely on this import
				'': [...refs], // refs that rely on an all (* as) import
			},
			'': [...refs], // refs that export
		},
			[0, 0, ...refs], // start and end index, and the other refs it depends on
		] */



		/* {
			// import
			'./file': {
				main: [0, 0, ...refs], // start and end index, followed by indexes of locals refs that rely on this import
				'': [0, 0, ...refs], // same as above, but for a '* as' type of import 
			}
			// locals/exports
			'': {
				'Label': [0, 0, ...refs], // start and end index, followed by indexes of other locals it relies on
				'': [0, 0, ...refs], // export. most of the time it is just used to mark which locals export. If left out, all locals export
			}
		} */
		// use start index as ref index
		// allow the space above the first headline hold a summary and metadata section for the whole file, imported with a name of just #


/* {
	'./file': {
		remote: [0, 1, '123 789', ...refs],
	},
	'': {
		local: [1, 2, 'Header', ...refs],
		'': [2, 2, '', ...refs],
	},
} */

	it('file reference', () => {
		const actual = parseMD(
`[file]: ./file
# Header {#local}
[File][file]`);

		expect(actual).toEqual({
			'./file': {
				'': ['0-14', 'local'],
			},
			'': {
				local: ['15-45 Header'],
				'': ['0-15 local'],
			},
		});
	});

	it('name reference from file', () => {
		const actual = parseMD(
`[file]: ./file
# Header {#local}
[File #main][file]`);

		expect(actual).toEqual({
			'./file': {
				main: ['0-14', 'local'],
				'': ['0-14'],
			},
			'': {
				local: ['15-51 Header'],
				'': ['0-15 local'],
			},
		});
	});

	it('variation reference from file', () => {
		const actual = parseMD(
`[file]: ./file
# Header {#local}
[File #main123][file]`);

		expect(actual).toEqual({
			'./file': {
				main: ['0-14', 'local 123'], // stored as '/file#local local#123' in map
				'': ['0-14'],
			},
			'': {
				local: ['15-54 Header'],
				'': ['0-15 local'], // locals after range here denote exports, since locals can reference the metadata sections with just a local #
			},
		});
	});

	it('name reference', () => {
		const actual = parseMD(
`[main]: ./file#main
# Header {#local}
[File][main]`);

		expect(actual).toEqual({
			'./file': {
				main: ['0-19', 'local'],
			},
			'': {
				local: ['20-50 Header'],
				'': ['0-20 local'],
			},
		});
	});

	it('variation reference from name', () => {
		const actual = parseMD(
`[main]: ./file#main
# Header {#local}
[File #123][main]`);

		expect(actual).toEqual({
			'./file': {
				main: ['0-19', 'local 123'],
			},
			'': {
				local: ['20-55 Header'],
				'': ['0-20 local'],
			},
		});
	});

	it('default override from name', () => {
		const actual = parseMD(
`[main]: ./file#main
# Header {#local}
[File #][main]`);

		expect(actual).toEqual({
			'./file': {
				main: ['0-19', 'local'],
			},
			'': {
				local: ['20-52 Header'],
				'': ['0-20 local'],
			},
		});
	});

	it('name override from name', () => {
		const actual = parseMD(
`[main]: ./file#main
# Header {#local}
[File #other][main]`);

		expect(actual).toEqual({
			'./file': {
				main: ['0-19'],
				other: ['0-19', 'local'],
			},
			'': {
				local: ['20-57 Header'],
				'': ['0-20 local'],
			},
		});
	});
	
	it('variation override from name', () => {
		const actual = parseMD(
`[main]: ./file#main
# Header {#local}
[File #other123][main]`);

		expect(actual).toEqual({
			'./file': {
				main: ['0-19'],
				other: ['0-19', 'local 123'],
			},
			'': {
				local: ['20-60 Header'],
				'': ['0-20 local'],
			},
		});
	});

	it('variation reference', () => {
		const actual = parseMD(
`[main123]: ./file#main123
# Header {#local}
[File][main123]`);

		expect(actual).toEqual({
			'./file': {
				main: ['0-25', 'local 123'],
			},
			'': {
				local: ['26-59 Header'],
				'': ['0-26 local'],
			},
		});
	});

	it('default override from variation', () => {
		const actual = parseMD(
`[main123]: ./file#main123
# Header {#local}
[File #][main123]`);

		expect(actual).toEqual({
			'./file': {
				main: ['0-25', 'local 123'],
			},
			'': {
				local: ['26-61 Header'],
				'': ['0-26 local'],
			},
		});
	});

	it('name override from variation', () => {
		const actual = parseMD(
`[main123]: ./file#main123
# Header {#local}
[File #other][main123]`);

		expect(actual).toEqual({
			'./file': {
				main: ['0-25'],
				other: ['0-25', 'local'],
			},
			'': {
				local: ['26-66 Header'],
				'': ['0-26 local'],
			},
		});
	});

	it('variation override from variation', () => {
		const actual = parseMD(
`[main123]: ./file#main123
# Header {#local}
[File #other123][main123]`);

		expect(actual).toEqual({
			'./file': {
				main: ['0-25'],
				other: ['0-25', 'local 123'],
			},
			'': {
				local: ['26-69 Header'],
				'': ['0-26 local'],
			},
		});
	});
	
	it('multiple name references', () => {
		const actual = parseMD(
`[main]: ./file#main
# First Header {#first}
[File][main]
# Second Header {#second}
[File][main]`);

		expect(actual).toEqual({
			'./file': {
				main: ['0-19', 'first', 'second'],
			},
			'': {
				first: ['20-57 First Header'],
				second: ['57-95 Second Header'],
				'': ['0-20 first second'],
			},
		});
	});

	it('multiple variation references', () => {
		const actual = parseMD(
`[main]: ./file#main
# Header {#local}
[File #123][main]
[File #789][main]`);

		expect(actual).toEqual({
			'./file': {
				main: ['0-19', 'local 123 789'],
			},
			'': {
				local: ['20-73 Header'],
				'': ['0-20 local'],
			},
		});
	});






// 	it('parses main reference', () => {
// 		const actual = parseMD(
// `[main]: ./file#main
// # Header {#local}
// [File Main #123][main]`);

// 		expect(actual).toEqual({
// 			'./file': {
// 				main: ['0-19', 'local 123'],
// 			},
// 			'': {
// 				local: ['20-60 Header'],
// 				'': ['0-20 local'],
// 			},
// 		});
// 	});

// 	// TODO: have this and the others above first check if main123 exists explicitely in file, otherwise use main
// 	it('parses variation reference', () => {
// 		const actual = parseMD(
// `[main123]: ./file#main123
// # Header {#local}
// [File Main 123 #main123][main123]`);

// 		expect(actual).toEqual({
// 			'./file': {
// 				main: ['0-25', 'local 123'],
// 			},
// 			'': {
// 				local: ['26-77 Header'],
// 				'': ['0-26 local'],
// 			},
// 		});
// 	});







	
// 	it('parses named reference', () => {
// 		const actual = parseMD(
// `[other]: ./file#other
// # Header {#local}
// [Other Label][other]`);

// 		expect(actual).toEqual({
// 			'./file': {
// 				other: [0, 21, 22],
// 			},
// 			'': {
// 				'local': [22, 60],
// 				'': [0, 22, 22],
// 			},
// 		});
// 	});

// 	it('parses aliased reference', () => {
// 		const actual = parseMD(
// `[alias]: ./file#another
// # Header {#local}
// [Alias Label][alias]`);

// 		expect(actual).toEqual({
// 			'./file': {
// 				another: [0, 23, 24],
// 			},
// 			'': {
// 				'local': [24, 62],
// 				'': [0, 24, 24],
// 			},
// 		});
// 	});

// 	it('parses local reference', () => {
// 		const actual = parseMD(
// `[local]: #local
// # Header {#local}
// [Local Label][local]`);

// 		expect(actual).toEqual({
// 			'.': {
// 				local: [0, 15, 16],
// 			},
// 			'': {
// 				'local': [16, 54],
// 				'': [0, 16, 16],
// 			}
// 		});
// 	});

// 	it('parses reference in top section', () => {
// 		const actual = parseMD(
// `[main]: ./file#
// [Meta Label][main]
// # Header {#local}`);

// 		expect(actual).toEqual({
// 			'./file': {
// 				'': [0, 15, 0],
// 			},
// 			'': {
// 				'local': [35, 52],
// 				'': [0, 35, 35],
// 			},
// 		});
// 	});

// 	it('parses multiple headers', () => {
// 		const actual = parseMD(
// `[main]: ./file#
// # Header {#first}
// [Main Label][main]
// # Header {#second}
// [Main Label][main]`);

// 		expect(actual).toEqual({
// 			'./file': {
// 				'': [0, 15, 16, 53],
// 			},
// 			'': {
// 				'first': [16, 53],
// 				'second': [53, 90],
// 				'': [0, 16, 16, 53],
// 			},
// 		});
// 	});
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
