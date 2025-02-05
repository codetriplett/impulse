```
/site/category.mjs
/site/category.css
{
	page: '(\w*) Page',
}
.category {
	display: flex;
}
.navigation {
	flex: 0 0 120px;
	background: lightgray;
}
```

# Category {#category}

```
function ({ page, '': content }) {
	return ['div', { className: 'category' },
		['div', { className: 'navigation' }, `${page} Nav`],
		['div', null, content],
	];
}
```
