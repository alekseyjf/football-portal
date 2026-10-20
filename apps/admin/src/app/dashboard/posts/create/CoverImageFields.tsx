import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import type { CreatePostFormValues } from './createPostFormSchema';
import { inputClass } from './formStyles';

interface CoverImageFieldsProps {
  register: UseFormRegister<CreatePostFormValues>;
  errors: FieldErrors<CreatePostFormValues>;
  /** Адресу фото задано — показуємо опис і підпис: без обкладинки вони не зберігаються */
  hasCoverImage: boolean;
}

/** Обкладинка (D44): адреса фото, опис для незрячих кожною мовою, підпис автора фото. */
export function CoverImageFields({ register, errors, hasCoverImage }: CoverImageFieldsProps) {
  return (
    <fieldset className="space-y-4 border border-gray-800 rounded-xl p-4">
      <legend className="px-1 text-sm font-semibold text-gray-300">
        Cover image <span className="font-normal text-gray-500">(optional)</span>
      </legend>
      <div className="space-y-1.5">
        <label htmlFor="coverImageUrl" className="text-sm font-medium text-gray-300">
          Image URL
        </label>
        <input id="coverImageUrl" {...register('coverImageUrl')} placeholder="https://…" className={inputClass(!!errors.coverImageUrl)} />
        {errors.coverImageUrl && <p className="text-red-400 text-xs">{errors.coverImageUrl.message}</p>}
      </div>

      {hasCoverImage && (
        <>
          <p className="text-xs text-gray-500">
            To publish: describe the photo in every language of the post and credit its author.
          </p>
          <div className="space-y-1.5">
            <label htmlFor="coverImageAltEn" className="text-sm font-medium text-gray-300">
              Alt text — English
            </label>
            <input
              id="coverImageAltEn"
              {...register('coverImageAltEn')}
              placeholder="Arsenal players celebrate the winning goal"
              className={inputClass(!!errors.coverImageAltEn)}
            />
            {errors.coverImageAltEn && <p className="text-red-400 text-xs">{errors.coverImageAltEn.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="coverImageAltUk" className="text-sm font-medium text-gray-300">
              Alt text — Українська <span className="font-normal text-gray-500">(if the Ukrainian version is filled)</span>
            </label>
            <input
              id="coverImageAltUk"
              {...register('coverImageAltUk')}
              placeholder="Гравці «Арсенала» святкують переможний гол"
              className={inputClass(!!errors.coverImageAltUk)}
            />
            {errors.coverImageAltUk && <p className="text-red-400 text-xs">{errors.coverImageAltUk.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="coverImageCredit" className="text-sm font-medium text-gray-300">
              Credit <span className="font-normal text-gray-500">(the site adds “Photo:”)</span>
            </label>
            <input
              id="coverImageCredit"
              {...register('coverImageCredit')}
              placeholder="Stuart MacFarlane / Getty Images"
              className={inputClass(!!errors.coverImageCredit)}
            />
            {errors.coverImageCredit && <p className="text-red-400 text-xs">{errors.coverImageCredit.message}</p>}
          </div>
        </>
      )}
    </fieldset>
  );
}
