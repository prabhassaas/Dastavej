import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/**
 * Client-side fillable-form generator. Builds a real AcroForm PDF with
 * pdf-lib — the resulting file can be filled in Acrobat, browsers and most
 * PDF viewers, and saved with the entered data stored inside the PDF.
 */

export type FormFieldType =
  | 'text'
  | 'multiline'
  | 'number'
  | 'date'
  | 'time'
  | 'email'
  | 'phone'
  | 'checkbox'
  | 'dropdown'
  | 'radio';

export interface FormFieldSpec {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  /** default / placeholder value for value-typed fields */
  defaultValue: string;
  /** options for dropdown / radio */
  options: string[];
}

export const FIELD_TYPES: { value: FormFieldType; label: string; hint: string }[] = [
  { value: 'text', label: 'Text', hint: 'Single-line text input' },
  { value: 'multiline', label: 'Paragraph', hint: 'Multi-line text area' },
  { value: 'number', label: 'Number / Count', hint: 'Numeric entry' },
  { value: 'date', label: 'Date (calendar)', hint: 'DD/MM/YYYY' },
  { value: 'time', label: 'Time (clock)', hint: 'HH:MM' },
  { value: 'email', label: 'Email', hint: 'name@example.com' },
  { value: 'phone', label: 'Phone', hint: '+00 00000 00000' },
  { value: 'checkbox', label: 'Checkbox', hint: 'Yes / no tick box' },
  { value: 'dropdown', label: 'Dropdown', hint: 'Pick one from a list' },
  { value: 'radio', label: 'Multiple choice', hint: 'Radio button group' },
];

/** Conventional page sizes, points (1pt = 1/72 inch), portrait [w, h]. */
export const PAGE_SIZES: Record<string, [number, number]> = {
  A4: [595.28, 841.89],
  Letter: [612, 792],
  Legal: [612, 1008],
  A3: [841.89, 1190.55],
  A5: [419.53, 595.28],
  Tabloid: [792, 1224],
};

export type Orientation = 'portrait' | 'landscape';

const MARGIN = 54;
const LABEL_SIZE = 10;
const INPUT_TEXT_SIZE = 11;

const PLACEHOLDERS: Partial<Record<FormFieldType, string>> = {
  date: 'DD/MM/YYYY',
  time: 'HH:MM',
  email: 'name@example.com',
  phone: '+00 00000 00000',
};

export async function buildFormPdf(options: {
  title: string;
  fields: FormFieldSpec[];
  pageSize: keyof typeof PAGE_SIZES;
  orientation: Orientation;
}): Promise<Uint8Array> {
  const { title, fields, pageSize, orientation } = options;
  const [pw, ph] = PAGE_SIZES[pageSize] ?? PAGE_SIZES.A4;
  const [width, height] = orientation === 'landscape' ? [ph, pw] : [pw, ph];

  const doc = await PDFDocument.create();
  doc.setTitle(title || 'Form');
  doc.setCreator('Dastavej — client-side PDF editor');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const form = doc.getForm();

  let page = doc.addPage([width, height]);
  let y = height - MARGIN;

  const newPageIfNeeded = (needed: number) => {
    if (y - needed < MARGIN) {
      page = doc.addPage([width, height]);
      y = height - MARGIN;
    }
  };

  // Title block
  if (title.trim()) {
    page.drawText(sanitize(title), { x: MARGIN, y: y - 20, size: 20, font: bold });
    y -= 32;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: width - MARGIN, y },
      thickness: 1,
      color: rgb(0.35, 0.4, 0.95),
    });
    y -= 24;
  }

  const usedNames = new Set<string>();
  const uniqueName = (label: string) => {
    const base = (label.trim() || 'field').replace(/[^\w-]+/g, '_').slice(0, 48);
    let name = base;
    let n = 2;
    while (usedNames.has(name)) name = `${base}_${n++}`;
    usedNames.add(name);
    return name;
  };

  const fieldWidth = width - MARGIN * 2;

  for (const spec of fields) {
    const name = uniqueName(spec.label);
    const label = sanitize(spec.label.trim() || 'Untitled field') + (spec.required ? ' *' : '');

    switch (spec.type) {
      case 'checkbox': {
        newPageIfNeeded(30);
        const box = form.createCheckBox(name);
        box.addToPage(page, {
          x: MARGIN,
          y: y - 16,
          width: 14,
          height: 14,
          borderColor: rgb(0.45, 0.5, 0.6),
          borderWidth: 1.2,
        });
        if (spec.defaultValue.toLowerCase() === 'yes' || spec.defaultValue === 'true') box.check();
        if (spec.required) box.enableRequired();
        page.drawText(label, { x: MARGIN + 22, y: y - 13, size: LABEL_SIZE + 1, font });
        y -= 34;
        break;
      }
      case 'radio': {
        const options = spec.options.length ? spec.options : ['Option 1', 'Option 2'];
        newPageIfNeeded(30 + 24);
        page.drawText(label, { x: MARGIN, y: y - LABEL_SIZE, size: LABEL_SIZE, font: bold });
        y -= LABEL_SIZE + 10;
        const group = form.createRadioGroup(name);
        let x = MARGIN;
        for (const opt of options) {
          const optWidth = 20 + font.widthOfTextAtSize(sanitize(opt), LABEL_SIZE) + 18;
          if (x + optWidth > width - MARGIN) {
            x = MARGIN;
            newPageIfNeeded(26);
            y -= 24;
          }
          group.addOptionToPage(sanitize(opt), page, {
            x,
            y: y - 14,
            width: 13,
            height: 13,
            borderColor: rgb(0.45, 0.5, 0.6),
            borderWidth: 1.2,
          });
          page.drawText(sanitize(opt), { x: x + 18, y: y - 11, size: LABEL_SIZE, font });
          x += optWidth;
        }
        if (spec.required) group.enableRequired();
        y -= 34;
        break;
      }
      case 'dropdown': {
        newPageIfNeeded(LABEL_SIZE + 8 + 24 + 14);
        page.drawText(label, { x: MARGIN, y: y - LABEL_SIZE, size: LABEL_SIZE, font: bold });
        y -= LABEL_SIZE + 8;
        const dropdown = form.createDropdown(name);
        const options = (spec.options.length ? spec.options : ['Option 1', 'Option 2']).map(sanitize);
        dropdown.addOptions(options);
        if (spec.defaultValue && options.includes(sanitize(spec.defaultValue))) {
          dropdown.select(sanitize(spec.defaultValue));
        }
        dropdown.addToPage(page, {
          x: MARGIN,
          y: y - 22,
          width: Math.min(fieldWidth, 260),
          height: 22,
          borderColor: rgb(0.45, 0.5, 0.6),
          borderWidth: 1,
        });
        dropdown.setFontSize(INPUT_TEXT_SIZE);
        if (spec.required) dropdown.enableRequired();
        y -= 22 + 18;
        break;
      }
      default: {
        // All text-flavored inputs: text, multiline, number, date, time, email, phone.
        const inputHeight = spec.type === 'multiline' ? 64 : 22;
        newPageIfNeeded(LABEL_SIZE + 8 + inputHeight + 14);
        page.drawText(label, { x: MARGIN, y: y - LABEL_SIZE, size: LABEL_SIZE, font: bold });
        const placeholder = PLACEHOLDERS[spec.type];
        if (placeholder) {
          const lw = bold.widthOfTextAtSize(label, LABEL_SIZE);
          page.drawText(placeholder, {
            x: MARGIN + lw + 8,
            y: y - LABEL_SIZE,
            size: LABEL_SIZE - 1,
            font,
            color: rgb(0.55, 0.58, 0.65),
          });
        }
        y -= LABEL_SIZE + 8;
        const field = form.createTextField(name);
        if (spec.type === 'multiline') field.enableMultiline();
        if (spec.defaultValue) field.setText(sanitize(spec.defaultValue));
        field.addToPage(page, {
          x: MARGIN,
          y: y - inputHeight,
          width: spec.type === 'number' ? Math.min(fieldWidth, 180) : fieldWidth,
          height: inputHeight,
          borderColor: rgb(0.45, 0.5, 0.6),
          borderWidth: 1,
        });
        field.setFontSize(INPUT_TEXT_SIZE);
        if (spec.required) field.enableRequired();
        y -= inputHeight + 18;
      }
    }
  }

  // Footer with generation date on every page
  const stamp = `Created with Dastavej on ${new Date().toLocaleDateString()}`;
  for (const p of doc.getPages()) {
    p.drawText(stamp, {
      x: MARGIN,
      y: 24,
      size: 7.5,
      font,
      color: rgb(0.6, 0.62, 0.68),
    });
  }

  form.updateFieldAppearances(font);
  return doc.save();
}

function sanitize(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[^\n\x20-\x7E\xA0-\xFF]/g, '?');
}
