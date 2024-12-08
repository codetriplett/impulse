export function getObject (parentObject, name, defaultObject) {
	let object = parentObject[name];

	if (!object) {
		object = defaultObject;
		parentObject[name] = object;
	}

	return object;
}
