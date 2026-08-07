import {
  PDFCheckBox,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
} from '@cantoo/pdf-lib';
import { loadPdf } from './pdfLoad';

/**
 * "Connect forms to Excel" — fully client-side:
 * filled AcroForm PDFs are parsed with pdf-lib, each file becomes one row,
 * and the rows are written to a real .xlsx (SheetJS) or .csv on the device.
 */

export interface FormRow {
  /** source file name */
  file: string;
  /** field name → entered value */
  values: Record<string, string>;
}

/** Read every AcroForm field value from a filled PDF. */
export async function extractFormData(fileName: string, bytes: Uint8Array): Promise<FormRow> {
  const doc = await loadPdf(bytes, { updateMetadata: false });
  const form = doc.getForm();
  const values: Record<string, string> = {};

  for (const field of form.getFields()) {
    const name = field.getName();
    if (field instanceof PDFTextField) values[name] = field.getText() ?? '';
    else if (field instanceof PDFCheckBox) values[name] = field.isChecked() ? 'Yes' : 'No';
    else if (field instanceof PDFRadioGroup) values[name] = field.getSelected() ?? '';
    else if (field instanceof PDFDropdown) values[name] = field.getSelected().join(', ');
    else if (field instanceof PDFOptionList) values[name] = field.getSelected().join(', ');
  }

  if (Object.keys(values).length === 0) {
    throw new Error(`"${fileName}" has no fillable form fields.`);
  }
  return { file: fileName, values };
}

/** Stable column order: file name first, then fields in first-seen order. */
export function collectColumns(rows: FormRow[]): string[] {
  const cols: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row.values)) {
      if (!cols.includes(key)) cols.push(key);
    }
  }
  return cols;
}

function toTable(rows: FormRow[]): Record<string, string>[] {
  const cols = collectColumns(rows);
  return rows.map((row) => {
    const rec: Record<string, string> = { File: row.file };
    for (const col of cols) rec[col] = row.values[col] ?? '';
    return rec;
  });
}

/** Write responses to a real .xlsx and trigger a local download. */
export async function exportRowsToXlsx(rows: FormRow[], fileName = 'form-responses.xlsx') {
  const XLSX = await import('xlsx');
  const sheet = XLSX.utils.json_to_sheet(toTable(rows));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Responses');
  XLSX.writeFile(book, fileName);
}

/** CSV alternative (opens in Excel, Sheets, Numbers…). */
export async function exportRowsToCsv(rows: FormRow[]): Promise<Uint8Array> {
  const XLSX = await import('xlsx');
  const sheet = XLSX.utils.json_to_sheet(toTable(rows));
  const csv = XLSX.utils.sheet_to_csv(sheet);
  // BOM so Excel detects UTF-8
  return new TextEncoder().encode(`﻿${csv}`);
}
