import path from 'node:path';

export default function isPath (pathname) {
	pathname = pathname.replaceAll(path.sep, '/');
	return pathname === encodeURI(pathname) &&
		!!path.extname(pathname);
}
