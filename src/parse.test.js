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

	// TODO: allow parsing headlines without ids
	// - store with integer key
	// - also store the parent headline of each as part of the range section (e.g. '15-50#parent Headline' or '15-50# Headline' for H1s
	// - use the parent along wiht the start index to sort the healines in the side panel



	// TODO: have first item in each array be for the range (and optional heading), and rest be for local references
	// - refs for '' give the exports, for other locals give the parent node, and for imports mark which ones use that import
	// - updateNode will append these internal refs has hashes on info string, and will use the rest of the array for external refs
	//   - in this case, imports probably can either remain as internal refs (less processing), or just as a string
	it('file reference', () => {
		const actual = parseMD(
`[file]: ./file
# Header {#local}
[File][file]`);

		expect(actual).toEqual({
			'./file': {
				'': ['local'],
			},
			'': {
				local: '15-45 Header',
				'': '0-15 local',
			},
		});
	});

	it('name reference', () => {
		const actual = parseMD(
`[main]: ./file#remote
# Header {#local}
[File][main]`);

		expect(actual).toEqual({
			'./file': {
				remote: ['local'],
			},
			'': {
				local: '22-52 Header',
				'': '0-22 local',
			},
		});
	});

	// MAYBE: don't use special treatment for tags that have number prefix and/or suffix
	// - creates some confusion around when these are allowed and what they are used for
	// - complicates map structure as well (requires adding breakdowns of variations after hashPath in string)
	// - complicates how to render mentions panel
	// - it might be better to have JS process the tables and lists under headlines for data instead of having to annotate it
	// GOAL: writing notes should be as simple as possible, just stick to links to directly reference snips under headlines

	it('inline file reference', () => {
		const actual = parseMD(
`# Header {#local}
[File](./file)`);

		expect(actual).toEqual({
			'./file': {
				'': ['local'],
			},
			'': {
				local: '0-32 Header',
				'': '0-0 local',
			},
		});
	});

	it('inline snip reference', () => {
		const actual = parseMD(
`# Header {#local}
[File](./file#remote)`);

		expect(actual).toEqual({
			'./file': {
				remote: ['local'],
			},
			'': {
				local: '0-39 Header',
				'': '0-0 local',
			},
		});
	});

	it('multiple references', () => {
		const actual = parseMD(
`[main]: ./file#remote
# First Header {#first}
[File][main]
# Second Header {#second}
[File][main]`);

		expect(actual).toEqual({
			'./file': {
				remote: ['first', 'second'],
			},
			'': {
				first: '22-59 First Header',
				second: '59-97 Second Header',
				'': '0-22 first second',
			},
		});
	});

	it('nameless header', () => {
		const actual = parseMD(
`[file]: ./file
# Header
[File][file]`);

		expect(actual).toEqual({
			'./file': {
				'': ['0'],
			},
			'': {
				0: '15-36 Header',
				'': '0-15',
			},
		});
	});

	it('skips duplicate name', () => {
		const actual = parseMD(
`[file]: ./file
# First Header {#local}
[File][file]
# Second Header {#local}
[File][file]`);

		expect(actual).toEqual({
			'./file': {
				'': ['local', '0'],
			},
			'': {
				local: '15-52 First Header',
				0: '52-89 Second Header',
				'': '0-15 local',
			},
		});
	});

	it('anchors to parent', () => {
		const actual = parseMD(
`[file]: ./file
# Parent Header {#parent}
[File][file]
## Child Header {#child}
[File][file]`);

		expect(actual).toEqual({
			'./file': {
				'': ['parent', 'child'],
			},
			'': {
				parent: '15-54 Parent Header',
				child: '54-91#parent Child Header',
				'': '0-15 parent child',
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
