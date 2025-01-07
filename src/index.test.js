import { state, getImports } from '.';

beforeEach(() => {
	state.nodes = {
		'/parent': {
			'': {
				remote: ['15-30 Parent Remote Header', '/node#local'],
				other: ['30-45 Parent Other Header', '/node#local'],
				'': ['0-15 remote other'],
			},
		},
		'/node': {
			'/parent': {
				remote: ['15-30', 'local'],
			},
			'': {
				local: ['15-45 Node Local Header', '/child#'],
				nested: ['30-45#local Node Nested Header'],
				'': ['0-15 local'],
			},
		},
		'/child': {
			'/node': {
				local: ['15-45', ''],
			},
			'': {
				'': ['0-15 other'],
			},
		},
	};
});

// citations will render under each expanded heading, after its children, sparated by a line
describe('getImports', () => {
	// TODO: Monday
	// have getImports just accept path and return the root '' object
	// - children and citations can be found inside that
	// - use a separate function for the recursion, with the citations registry passed as a param
	// - have children and citations be references to the objects stored in the registry, not keys to access them
	/* {
		children: [...], // have their own children and citations arrays, along with name and heading
		citations: [...], // ones found before first headline
	} */

	it('gets locals', () => {
		const actual = getImports('/parent');

		expect(actual).toEqual({
			name: '',
			children: [
				{
					name: 'remote',
					heading: 'Parent Remote Header',
				},
				{
					name: 'other',
					heading: 'Parent Other Header',
				},
			],
		});
	});

	it('gets focused locals', () => {
		const actual = getImports('/parent', ['remote']);

		expect(actual).toEqual({
			children: [
				{
					name: 'remote',
					heading: 'Parent Remote Header',
				},
			],
		});
	});

	it('gets node imports', () => {
		const actual = getImports('/node');

		expect(actual).toEqual({
			name: '',
			children: [
				{
					name: 'local',
					heading: 'Node Local Header',
					citations: [
						{	
							name: 'remote',
							heading: 'Parent Remote Header',
						},
					],
					children: [
						{
							name: 'nested',
							heading: 'Node Nested Header',
						},
					],
				},
			],
		});
	});

	it('gets child imports', () => {
		const actual = getImports('/child');

		expect(actual).toEqual({
			name: '',
			citations: [
				{
					name: 'local',
					heading: 'Node Local Header',
					citations: [
						{
							name: 'remote',
							heading: 'Parent Remote Header',
						},
					],
				},
			],
		});
	});

	it('accepts custom registry', () => {
		const registry = {};
		const actual = getImports('/node', [], registry);
		expect(actual).toBe(registry['/node#']);

		expect(registry).toEqual({
			'/node#': {
				name: '',
				children: [
					registry['/node#local'],
				],
			},
			'/node#local': {	
				name: 'local',
				heading: 'Node Local Header',
				children: [
					registry['/node#nested'],
				],
				citations: [
					registry['/parent#remote'],
				]
			},
			'/node#nested': {
				name: 'nested',
				heading: 'Node Nested Header',
			},
			'/parent#': {
				children: [
					registry['/parent#remote'],
				],
			},
			'/parent#remote': {	
				name: 'remote',
				heading: 'Parent Remote Header',
			},
		});
	});

	it('skips circular locals', () => {
		const remoteEntry = {
			name: 'remote',
			heading: 'Parent Remote Header',
		};

		const registry = {
			'/parent#remote': remoteEntry,
		};

		const actual = getImports('/parent', ['remote', 'other'], registry);
		expect(actual).toBe(registry['/parent#']);
		expect(registry['/parent#remote']).toBe(remoteEntry);

		expect(registry).toEqual({
			'/parent#': {
				children: [
					registry['/parent#remote'],
					registry['/parent#other'],
				],
			},
			'/parent#remote': {
				name: 'remote',
				heading: 'Parent Remote Header',
			},
			'/parent#other': {
				name: 'other',
				heading: 'Parent Other Header',
			},
		});
	});
});
