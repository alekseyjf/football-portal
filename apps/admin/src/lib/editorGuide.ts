/**
 * Посібник редактора (`docs/editor-guide.md`) — у публічному репозиторії: форма посилається на розділ поруч з полем,
 * якого він стосується. Якір GitHub будує із заголовка (`### Де брати фото ✅` → `#де-брати-фото-`), тож заголовок
 * у посібнику не перейменовуємо.
 */
const EDITOR_GUIDE_URL = 'https://github.com/alekseyjf/football-portal/blob/master/docs/editor-guide.md';

/** «Де брати фото»: фотобанки обкладинки (M1.8.3a) і як підписати автора. */
export const EDITOR_GUIDE_PHOTOS_URL = `${EDITOR_GUIDE_URL}#${encodeURIComponent('де-брати-фото-')}`;
