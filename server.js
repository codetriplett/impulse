const { createServer } = require('http');
const { readFile } = require('fs');
const port = 8080;

const types = {
	html: 'text/html',
	css: 'text/css',
	js: 'application/javascript',
	ico: 'image/x-icon'
};

const resources = {
	'favicon.ico': 'src/favicon.ico',
	'index.html': 'src/index.html',
	'index.css': 'src/index.css',
	'index.min.js': 'dist/impulse.min.js',
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

createServer(({ url }, res) => {
	if (url === '/') {
		url = resources[0];
	}

	const regex = /^(?:\/+)?(.*?)(?:\.([^/.?#]*)|\/*)?(?:\?(.*?))?$/;
	let [, path = '', extension] = url.match(regex);
	const type = types[extension];
	const options = !/^image\/(?!svg)/.test(type) ? ['utf8'] : [];
	path += `.${extension}`;
	const resourcePath = resources[path];

	if (!resourcePath) {
		return send(res);
	}

	readFile(`${__dirname}/${resourcePath}`, ...options, (err, content) => {
		send(res, content, type);
	});
}).listen(port, err => console.log(`server is listening on ${port}`));
