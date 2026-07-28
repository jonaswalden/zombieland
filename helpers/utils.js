const objectUtils = {
	pick: objectPick,
};

export {
	objectUtils as object,
};

function objectPick (source, ...keys) {
	return Object.fromEntries(
		keys.map(key => [ key, source[key] ])
	);
}
