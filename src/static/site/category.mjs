export const category = function ({ page, '': content }) {
	return ['div', { className: 'category' },
		['div', { className: 'navigation' }, `${page} Nav`],
		['div', null, content],
	];
}
export default [category, {
	page: '(\w*) Page',
}, '/site/category.css']