```
/other.css
/other.mjs
{
	category: '// Category',
}
.header {
	height: 60px;
	color: white;
	background: dimgray;
}
```

# Site {#site}

```
function ({ category, '': content }) {
	return ['', null,
		['div', { className: 'header' }, `${category} Header`],
		content,
	];
}
```
