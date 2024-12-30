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
					remote: ['15-45 Header'],
					'': ['0-15 remote'],
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
					remote: ['15-45 Header'],
					'': ['0-15 remote'],
				},
			},
		});
	});
	
	it('clears linked node', () => {
		const map = {
			'/parent': {
				'': {
					remote: ['15-45 Header', '/node#local'],
					'': ['0-15 remote'],
				},
			},
			'/node': {
				'/parent': {
					remote: ['15-45 Header', 'local'],
					'': ['0-14'],
				},
				'': {
					local: ['15-45 Header', '/child#'],
					'': ['0-15 local'],
				},
			},
		};

		const actual = clearNode(map, '/node');

		expect(actual).toEqual({
			local: ['', '/child#'],
			'': [''],
		});

		expect(map).toEqual({
			'/parent': {
				'': {
					remote: ['15-45 Header'],
					'': ['0-15 remote'],
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
					remote: ['', '/node#local'],
					'': [''],
				},
			},
			'/node': {
				'/parent': {
					remote: ['15-45 Header', 'local'],
					'': ['0-14'],
				},
				'': {
					local: ['15-45 Header'],
					'': ['0-15 local'],
				},
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
					main: ['1-2 File Header'],
					'': ['2-2'],
				},
			},
		};

		updateNode(map, '/root', {
			'./file': {
				main: ['0-1', 'local'],
			},
			'': {
				local: ['1-2 Root Header'],
				'': ['2-2'],
			},
		});

		expect(map).toEqual({
			'/file': {
				'': {
					main: ['1-2 File Header', '/root#local'],
					'': ['2-2'],
					// main: ['1-2', 'Main Header', '/root#local local#123'],
					// if multiple locals in file use it '/root#first#second first#123 second #123'
				},
			},
			'/root': {
				'/file': {
					main: ['0-1', 'local'],
				},
				'': {
					local: ['1-2 Root Header'],
					'': ['2-2'],
				},
			},
		});
	});
	
	it('adds variations', () => {
		const map = {
			'/file': {
				'': {
					main: ['1-2 File Header'],
					'': ['2-2'],
				},
			},
		};

		updateNode(map, '/root', {
			'./file': {
				main: ['0-1', 'local 123'],
			},
			'': {
				local: ['1-2 Root Header'],
				'': ['2-2'],
			},
		});

		expect(map).toEqual({
			'/file': {
				'': {
					main: ['1-2 File Header', '/root#local local#123'],
					'': ['2-2'],
					// main: ['1-2', 'Main Header', '/root#local local#123'],
					// if multiple locals in file use it '/root#first#second first#123 second #123'
				},
			},
			'/root': {
				'/file': {
					main: ['0-1', 'local 123'],
				},
				'': {
					local: ['1-2 Root Header'],
					'': ['2-2'],
				},
			},
		});
	});

	it('sets placeholders', () => {
		const map = {};

		updateNode(map, '/root', {
			'./file': {
				main: ['0-1', 'local'],
			},
			'': {
				local: ['1-2 Root Header'],
				'': ['2-2'],
			},
		});

		expect(map).toEqual({
			'/file': {
				'': {
					main: ['', '/root#local'],
					'': [''],
				},
			},
			'/root': {
				'/file': {
					main: ['0-1', 'local'],
				},
				'': {
					local: ['1-2 Root Header'],
					'': ['2-2'],
				},
			},
		});
	});

	it('updates node in folder', () => {
		const map = {};

		updateNode(map, '/folder/file', {
			'../shallow': {
				main: ['0-1', 'local']
			},
			'./deep': {
				main: ['0-1', 'local']
			},
			'': {
				local: ['1-2'],
				'': ['2-2'],
			}
		});

		expect(map).toEqual({
			'/shallow': {
				'': {
					main: ['', '/folder/file#local'],
					'': [''],
				},
			},
			'/folder/deep': {
				'': {
					main: ['', '/folder/file#local'],
					'': [''],
				},
			},
			'/folder/file': {
				'/shallow': {
					main: ['0-1', 'local'],
				},
				'/folder/deep': {
					main: ['0-1', 'local'],
				},
				'': {
					local: ['1-2'],
					'': ['2-2'],
				},
			},
		});
	});
});
