export const site = function ({ category }, content) {
	return ['', null,
		['div', { className: 'header' }, `${category} Header`],
		content,
	];
};
export default [site, {
	category: '// Category',
}, `.header {
	height: 60px;
	color: white;
	background: dimgray;
}`, '/other.css', '/other.mjs'];