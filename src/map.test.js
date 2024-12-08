import { getPath, clearNode, updateMap } from './map';

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
			'/parent': ['md', {
				'': {
					main: [0],
				},
			}],
			'/node': ['md', {
				'': {},
			}],
		};

		const actual = clearNode(map, '/node');
		expect(actual).toEqual(undefined);

		expect(map).toEqual({
			'/parent': ['md', {
				'': {
					main: [0],
				},
			}],
		});
	});
	
	it('clears linked node', () => {
		const map = {
			'/parent': ['md', {
				'': {
					main: [0, '/node'],
				},
			}],
			'/node': ['md', {
				'/parent': {
					main: [0],
				},
				'': {
					main: [0, '/child'],
					other: [0],
				},
			}],
		};

		const actual = clearNode(map, '/node');

		expect(actual).toEqual({
			main: [-1, '/child'],
		});

		expect(map).toEqual({
			'/parent': ['md', {
				'': {
					main: [0],
				},
			}],
			'/node': ['', {
				'': actual,
			}],
		});
	});
	
	it('clears unnecessary parent', () => {
		const map = {
			'/parent': ['md', {
				'': {
					main: [-1, '/node'],
				},
			}],
			'/node': ['md', {
				'/parent': {
					main: [0],
				},
				'': {},
			}],
		};

		const actual = clearNode(map, '/node');
		expect(actual).toEqual(undefined);
		expect(map).toEqual({});
	});
});

describe('updateMap', () => {
	it('updates map at root', () => {
		const map = {
			'/file': ['md', {
				'': {
					main: [0],
				},
			}],
		};

		updateMap(map, '/root', ['md', {
			'./file': {
				main: [0],
			},
			'': {
				local: 0,
			},
		},
			[0, 0],
		]);

		expect(map).toEqual({
			'/file': ['md', {
				'': {
					main: [0, '/root'],
				},
			}],
			'/root': ['md', {
				'/file': {
					main: [0],
				},
				'': {
					local: [0],
				},
			},
				[0, 0],
			],
		});
	});

	it('sets placeholders', () => {
		const map = {};

		updateMap(map, '/root', ['md', {
			'./file': {
				main: [0],
			},
			'': {
				local: 0,
			},
		},
			[0, 0],
		]);

		expect(map).toEqual({
			'/file': ['', {
				'': {
					main: [-1, '/root'],
				},
			}],
			'/root': ['md', {
				'/file': {
					main: [0],
				},
				'': {
					local: [0],
				},
			},
				[0, 0],
			],
		});
	});

	it('updates map in folder', () => {
		const map = {};

		const actual = updateMap(map, '/folder/file', ['md', {
			'../shallow': {
				main: [0]
			},
			'./deep': {
				main: [1]
			},
			'': {
				local: 0,
			}
		},
			[0, 0],
			[1, 1],
		]);

		expect(map).toEqual({
			'/shallow': ['', {
				'': {
					main: [-1, '/folder/file'],
				},
			}],
			'/folder/deep': ['', {
				'': {
					main: [-1, '/folder/file'],
				},
			}],
			'/folder/file': ['md', {
				'/shallow': {
					main: [0],
				},
				'/folder/deep': {
					main: [1],
				},
				'': {
					local: [0],
				},
			},
				[0, 0],
				[1, 1],
			],
		});
	});
});
