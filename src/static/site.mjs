export const site = function ({ category, '': content }) {
	return ['', null,
		['div', { className: 'header' }, `${category} Header`],
		content,
	];
}
export default [site, {
	category: '(\w*) Category',
}, '/site.css']