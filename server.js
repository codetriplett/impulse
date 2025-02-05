const { createServer } = require('http');
const { readFile } = require('fs');
const port = 8080;

const types = {
	html: 'text/html',
	css: 'text/css',
	mjs: 'text/javascript',
	js: 'text/javascript',
	json: 'application/json',
	md: 'text/plain',
	ico: 'image/x-icon'
};

const resources = {
	'favicon.ico': 'src/favicon.ico',
	'index.html': 'src/index.html',
	'index.css': 'src/index.css',
	'index.min.js': 'dist/index.js',
	'acorn.min.js': 'node_modules/acorn/dist/acorn.js',
	'acorn-jsx.min.js': 'node_modules/acorn-jsx/index.js',
	'acorn-jsx-xhtml.min.js': 'node_modules/acorn-jsx/xhtml.js',
	'stew.min.js': 'node_modules/@triplett/stew/dist/stew.min.js',
	'stew.min.js.LEGAL.txt': 'node_modules/@triplett/stew/dist/stew.min.js.LEGAL.txt',
};

function send (res, content, type = types.txt) {
	const utf8 = !/^image\/(?!svg)/.test(type);
	let status = 200;

	if (!(content instanceof Buffer) && typeof content !== 'string') {
		status = 404;
		content = 'Not found';
	}

	res.writeHead(status, {
		'Content-Length': Buffer.byteLength(content),
		'Content-Type': `${type}${utf8 ? '; charset=utf-8' : ''}`
	});

	res.end(content);
}

const regex = /^(?:\/+)?(.*?(?:\.([^/.?#]*)|\/*)?)(?:\?(.*?))?$/;

createServer(({ url, method }, res) => {
	let [, path = '', extension, query] = url.match(regex);

	if (extension) {
		path = resources[path] || `src/static/${path}`;
	} else {
		path = 'src/index.html';
		extension = 'html';
	}

	const type = types[extension];
	const options = !/^image\/(?!svg)/.test(type) ? ['utf8'] : [];

	readFile(`${__dirname}/${path}`, ...options, (err, content) => {
		send(res, content, type);
	});
}).listen(port, err => console.log(`server is listening on ${port}`));
