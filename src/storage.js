const {
	localStorage: localStorageOriginal,
	sessionStorage: sessionStorageOriginal,
} = window;

function overrideStorage (name) {
	const storage = window[name];
	const proxy = {};

	for (const [name, value] of Object.entries(storage)) {
		if (!name.startsWith(':')) {
			proxy[name] = value;
		}
	}

	Object.defineProperty(window, name, {
		value: proxy,
		writable: false,
	});

	for (const methodName of ['getItem', 'setItem', 'removeItem']) {
		const callback = (keyName, ...params) => {
			if (keyName.startsWith(':')) {
				throw new Error('Storage keys cannot start with :');
			}
	
			return storage[methodName](keyName, ...params);
		};

		Object.defineProperty(proxy, methodName, {
			get: () => callback,
			enumerable: false,
		});
	}
}

overrideStorage('localStorage');
overrideStorage('sessionStorage');

export const localStorage = {
	getItem: name => localStorageOriginal.getItem(`:${name}`),
	setItem: (name, value) => localStorageOriginal.setItem(`:${name}`, value),
	removeItem: name => localStorageOriginal.removeItem(`:${name}`),
	clear: () => {
		for (const name of localStorageOriginal) {
			if (name.startsWith(':')) {
				localStorageOriginal.removeItem(name);
			}
		}
	},
};
