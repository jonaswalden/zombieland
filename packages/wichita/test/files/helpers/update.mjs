export const memory = [];

export default function update (source) {
	const entry = 'update from ' + source;
	document.title += ', ' + entry;
	memory.push(entry);
}
