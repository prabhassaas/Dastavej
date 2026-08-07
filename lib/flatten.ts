import { loadPdf } from './pdfLoad';

/**
 * Bake a filled AcroForm's field values into the page content and remove
 * the interactive widgets, so the result can no longer be edited — the
 * "flatten" step of a sign-and-lock workflow. Uses pdf-lib's built-in
 * form flattening; throws a readable error if the PDF has no form fields.
 */
export async function flattenFormPdf(bytes: Uint8Array): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  const form = doc.getForm();
  const fields = form.getFields();
  if (fields.length === 0) {
    throw new Error('This PDF has no fillable form fields to flatten.');
  }
  form.flatten();
  return doc.save();
}
