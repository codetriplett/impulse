```
/site/other.css
/site/other.mjs
{
	page: '// Page',
}
.category {
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
}
```

# Category {#category}

```
function ({ page }, content) {
	return ['div', { className: 'category' },
		['div', { className: 'navigation' }, `${page} Nav`],
		content,
	];
}
```
