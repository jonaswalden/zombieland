import path from 'node:path';

export default function isPath (pathname) {
	pathname = pathname.replaceAll('\\', '/');
	return pathname === encodeURI(pathname) &&
		!!path.extname(pathname);
}
