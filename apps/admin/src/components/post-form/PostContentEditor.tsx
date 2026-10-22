'use client';

import { useWatch, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { MarkdownContent } from '@football-portal/ui';
import { TabList, tabElementId, tabPanelElementId } from '@/components/TabList';
import { getPublicWebUrl } from '@/lib/publicWebUrl';
import { controlProps, fieldErrorId } from './formStyles';
import {
  TRANSLATION_FIELD_NAMES,
  translationFieldDeps,
  type PostFormLanguage,
  type PostFormValues,
} from './postFormSchema';
import type { ContentView } from './usePostFormTabs';

const PUBLIC_WEB_URL = getPublicWebUrl();

const CONTENT_VIEW_TABS = [
  { id: 'write', label: 'Write' },
  { id: 'preview', label: 'Preview' },
] as const;

/** Шпаргалка під полем; повністю — rules/content.md і посібник редактора. */
const MARKDOWN_HINTS = [
  '## Heading',
  '- list item',
  '> quote',
  '**bold**',
  '[link](https://…)',
  '![photo description](https://… "Photo: author")',
];

type ContentFieldName = (typeof TRANSLATION_FIELD_NAMES)[PostFormLanguage]['content'];

interface PostContentEditorProps {
  language: PostFormLanguage;
  view: ContentView;
  onViewChange: (view: ContentView) => void;
  register: UseFormRegister<PostFormValues>;
  control: Control<PostFormValues>;
  errors: FieldErrors<PostFormValues>;
}

/** Текст новини в Markdown (D25): поле й перегляд — тим самим рендерером, що й на сайті. */
export function PostContentEditor({
  language,
  view,
  onViewChange,
  register,
  control,
  errors,
}: PostContentEditorProps) {
  const fieldName = TRANSLATION_FIELD_NAMES[language].content;
  const error = errors[fieldName]?.message;
  const idPrefix = `${fieldName}-view`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-end justify-between gap-4">
        <label htmlFor={fieldName} className="text-sm font-medium text-gray-300">
          Text <span className="font-normal text-gray-500">(Markdown)</span>
        </label>
        <TabList
          label="Text view"
          idPrefix={idPrefix}
          tabs={CONTENT_VIEW_TABS}
          activeTab={view}
          onSelect={onViewChange}
        />
      </div>
      <div
        role="tabpanel"
        id={tabPanelElementId(idPrefix, 'write')}
        aria-labelledby={tabElementId(idPrefix, 'write')}
        hidden={view !== 'write'}
      >
        <textarea
          {...register(fieldName, { deps: translationFieldDeps(language) })}
          {...controlProps(fieldName, !!error)}
          lang={language}
          rows={14}
        />
      </div>
      <div
        role="tabpanel"
        id={tabPanelElementId(idPrefix, 'preview')}
        aria-labelledby={tabElementId(idPrefix, 'preview')}
        hidden={view !== 'preview'}
      >
        {/* Лише відкритий перегляд: інакше кожна літера в полі перебудовувала б розмітку всього тексту */}
        {view === 'preview' && (
          <ContentPreview control={control} fieldName={fieldName} language={language} />
        )}
      </div>
      {error && (
        <p id={fieldErrorId(fieldName)} className="text-xs text-red-400">
          {error}
        </p>
      )}
      <p className="text-xs leading-6 text-gray-500">
        {MARKDOWN_HINTS.map((hint) => (
          <code key={hint} className="mr-2 inline-block rounded bg-gray-800 px-1.5 leading-5 text-gray-400">
            {hint}
          </code>
        ))}
        A blank line starts a new paragraph.
      </p>
    </div>
  );
}

interface ContentPreviewProps {
  control: Control<PostFormValues>;
  fieldName: ContentFieldName;
  language: PostFormLanguage;
}

/** Як побачить читач; посилання на наші сторінки (`/uk/matches/…`) ведуть на сайт у новій вкладці. */
function ContentPreview({ control, fieldName, language }: ContentPreviewProps) {
  const source = useWatch({ control, name: fieldName });
  return (
    <div lang={language} className="min-h-80 rounded-lg border border-gray-700 px-4 py-3">
      {source.trim() ? (
        <MarkdownContent source={source} linkBaseUrl={PUBLIC_WEB_URL} />
      ) : (
        <p className="text-sm text-gray-500">Nothing to preview yet.</p>
      )}
    </div>
  );
}
