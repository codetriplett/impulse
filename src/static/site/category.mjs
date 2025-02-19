export const category = function ({ page, '': content }) {
	return ['div', { className: 'category' },
		['div', { className: 'navigation' }, `${page} Nav`],
		['div', null, content],
	];
};
export default [category, {
	// page: '// Page',

	boolean: '* Boolean',
	number: '/2..4* Number',
	string: '/\\d+-\\d+/ String',
	fallback: 'xyz *// Fallback',
	literal: 'abc *//* Fallback',
}, `.category {
	display: flex;
}
.navigation {
	flex: 0 0 120px;
	background: lightgray;
}`, '/site/other.css', '/site/other.mjs'];