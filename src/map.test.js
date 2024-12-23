import { getPath, clearNode, updateNode } from './map';

describe('getPath', () => {
	it('gets root path', () => {
		const actual = getPath(['root'], './file');
		expect(actual).toEqual('/file');
	});

	it('gets module path', () => {
		const actual = getPath(['root'], 'module');
		expect(actual).toEqual('module');
	});

	it('gets deep path', () => {
		const actual = getPath(['root'], './folder/file');
		expect(actual).toEqual('/folder/file');
	});

	it('parses shallow import', () => {
		const actual = getPath(['folder', 'file'], '../root');
		expect(actual).toEqual('/root');
	});

	it('parses sibling import', () => {
		const actual = getPath(['folder', 'file'], './sibling');
		expect(actual).toEqual('/folder/sibling');
	});
});

describe('clearNode', () => {
	it('clears unlinked node', () => {
		const map = {
			'/parent': {
				'': {
					main: [0, 0],
					'': [0, 0, 0],
				},
			},
			'/node': {
				'': {},
			},
		};

		const actual = clearNode(map, '/node');
		expect(actual).toEqual(undefined);

		expect(map).toEqual({
			'/parent': {
				'': {
					main: [0, 0],
					'': [0, 0, 0],
				},
			},
		});
	});
	
	it('clears linked node', () => {
		const map = {
			'/parent': {
				'': {
					main: [0, 0, '/node'],
					'': [0, 0, 0],
				},
			},
			'/node': {
				'/parent': {
					main: [0],
				},
				'': {
					main: [0, 0, '/child'],
					other: [0, 0],
				},
			},
		};

		const actual = clearNode(map, '/node');

		expect(actual).toEqual({
			main: ['/child'],
			'': [],
		});

		expect(map).toEqual({
			'/parent': {
				'': {
					main: [0, 0],
					'': [0, 0, 0],
				},
			},
			'/node': {
				'': actual,
			},
		});
	});
	
	it('clears unnecessary parent', () => {
		const map = {
			'/parent': {
				'': {
					main: ['/node'],
					'': [],
				},
			},
			'/node': {
				'/parent': {
					main: [0],
				},
				'': {},
			},
		};

		const actual = clearNode(map, '/node');
		expect(actual).toEqual(undefined);
		expect(map).toEqual({});
	});
});

// maybe index refs in separate object
// - greatly simplifies parsing, since it just needs to replace itself in map, with no modifications
// - allows function to stick to their own purpose
// - no messy siturations when files reference a file that hasn't been parsed, or has been deleted

// map (collection of parsed files)
// - non-empty string keys are for imports
// - entries under empty string key are locals, and empty string key in that is for exports
// - refs refer to locals, and locals arrays start with the starting character index and length of their content
/* {
	'/file': {
		'./sibling': {
			main: [...refs], // refs that rely on this import (name is its true name, not its alias)
			'': [...refs], // indicates an import all object
		},
		'': {
			var: [index, length, ...refs], // declares local variable, along with array of other variables it depends on
			'': [...refs], // refs that are exported from this file
		},
	},
} */

// refMap (index of relationships between files, derived from map if not yet built)
/* {
	'/sibling': {
		main: [...paths], // paths of files that import this export (should this be relative?)
	},
} */

describe('updateNode', () => {
	it('updates node at root', () => {
		const map = {
			'/file': {
				'': {
					main: [1, 2],
					'': [1],
				},
			},
		};

		updateNode(map, '/root', {
			'./file': {
				main: [1],
			},
			'': {
				local: [1, 2],
				'': [1],
			},
		});

		expect(map).toEqual({
			'/file': {
				'': {
					main: [1, 2, '/root'],
					'': [1],
				},
			},
			'/root': {
				'/file': {
					main: [1],
				},
				'': {
					local: [1, 2],
					'': [1],
				},
			},
		});
	});

	it('sets placeholders', () => {
		const map = {};

		updateNode(map, '/root', {
			'./file': {
				main: [1, 2],
			},
			'': {
				local: [1, 2],
				'': [1],
			},
		});

		expect(map).toEqual({
			'/file': {
				'': {
					main: ['/root'],
					'': [],
				},
			},
			'/root': {
				'/file': {
					main: [1, 2],
				},
				'': {
					local: [1, 2],
					'': [1],
				},
			},
		});
	});

	it('updates node in folder', () => {
		const map = {};

		updateNode(map, '/folder/file', {
			'../shallow': {
				main: [1]
			},
			'./deep': {
				main: [1]
			},
			'': {
				local: [1, 2],
				'': [1],
			}
		});

		expect(map).toEqual({
			'/shallow': {
				'': {
					main: ['/folder/file'],
					'': [],
				},
			},
			'/folder/deep': {
				'': {
					main: ['/folder/file'],
					'': [],
				},
			},
			'/folder/file': {
				'/shallow': {
					main: [1],
				},
				'/folder/deep': {
					main: [1],
				},
				'': {
					local: [1, 2],
					'': [1],
				},
			},
		});
	});
});
