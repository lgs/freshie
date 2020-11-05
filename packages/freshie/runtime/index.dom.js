import Router from 'freshie/router';

export var router;
var target, render, hydrate;
var ERRORS = { /* <ERRORS> */ };

// var hasSW = ('serviceWorker' in navigator);
// var root = document.body;

function request(params) {
	var { pathname, search } = location;
	var USP = new URLSearchParams(search);
	var query = Object.fromEntries(USP);
	return { pathname, search, query, params };
}

function run(Tags, params, ctx, req) {
	ctx = ctx || {};
	params = params || {};
	var draw = hydrate || render;
	var i=0, loaders=[], views=[];
	var props = { params };

	for (; i < Tags.length; i++) {
		views.push(Tags[i].default);
		if (Tags[i].preload) loaders.push(Tags[i].preload);
	}

	if (loaders.length) {
		req = req || request(params);
		Promise.all(
			loaders.map(f => f(req, ctx))
		).then(list => {
			if (ctx.redirect) {
				// TODO? Could `new URL` and origin match
				// but wouldn't guarantee same `base` path
				if (/^(https?:)?\/\//.test(ctx.redirect)) {
					location.href = ctx.redirect; // meh
				} else {
					router.route(ctx.redirect, true);
				}
			} else {
				Object.assign(props, ...list);
				draw(views, props, target);
				hydrate = false;
			}
		}).catch(err => {
			ctx.error = err;
			ErrorPage(params, ctx);
		});
	} else {
		draw(views, props, target);
		hydrate = false;
	}
}

function toError(code) {
	var key = String(code);
	return ERRORS[key] || ERRORS[key[0] + 'xx'] || ERRORS['xxx'];
}

function ErrorPage(params, ctx) {
	var err = ctx.error || {};
	ctx.status = ctx.status || err.statusCode || err.status || 500;
	toError(ctx.status)().then(arr => run(arr, params, ctx));
}

// TODO: accept multiple layouts
// TODO: attach manifest/files loader
function define(pattern, importer) {
	// let files = [];
	let toFiles = Promise.resolve();

	// if (!hasSW && window.__rmanifest) {
	// 	if (files = window.__rmanifest[pattern]) {
	// 		// console.log('~> files', pattern, files);
	// 		toFiles = Promise.all(files.map(preload));
	// 	}
	// }

	router.on(pattern, (params) => {
		var ctx = {};

		Promise.all([
			importer(), //=> Components
			toFiles, //=> Assets
		]).then(arr => {
			run(arr[0], params, ctx);
		}).catch(err => {
			ctx.error = err;
			ErrorPage(params, ctx);
		})
	});
}

function is404(url) {
	ErrorPage({ url }, { status: 404 });
}

export function start(options) {
	options = options || {};

	render = options.render;
	hydrate = options.hydrate || render;
	// TODO: options.target
	target = document.body;

	router = Router(options.base || '/', is404);
	/* <ROUTES> */

	// INIT
	if (document.readyState !== 'loading') router.listen();
	else addEventListener('DOMContentLoaded', router.listen);
}
