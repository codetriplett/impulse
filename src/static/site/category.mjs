export const category = function ({ page }, content) {
	return ['div', { className: 'category' },
		['div', { className: 'navigation' }, `${page} Nav`],
		content,
	];
};
export default [category, {
	page: '// Page',
	boolean: 'Boolean',
	number: '/3 Number',
	string: '// String',
	object: {
		boolean: 'Boolean',
		number: '/3 Number',
		string: '// String',
	},
	select: ['Select',
		'Boolean',
		'/3 Number',
		'// String',
	],
	array: ['/3 Array',
		'Boolean',
		'/3 Number',
		'// String',
	],

	// boolean: '* Boolean',
	// number: '/2..4* Number',
	// string: '/\\d+-\\d+/ String',
	// fallback: 'xyz *// Fallback',
	// literal: 'abc *//* Fallback',
}, `.category {
	display: flex;
	gap: 16px;
}
.navigation {
	flex: 0 0 120px;
	color: black;
	background: lightgray;
}
main {
	flex: 1 0 0;
}`, '/site/other.css', '/site/other.mjs'];