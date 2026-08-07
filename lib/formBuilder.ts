import { PDFDocument, StandardFonts, rgb } from '@cantoo/pdf-lib';

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

/** Standard passport-photo box, 35 × 45 mm in points. */
const PHOTO_W = 99.2;
const PHOTO_H = 127.6;

export interface FormLogo {
  bytes: Uint8Array;
  mime: 'image/png' | 'image/jpeg';
}

export async function buildFormPdf(options: {
  title: string;
  fields: FormFieldSpec[];
  pageSize: keyof typeof PAGE_SIZES;
  orientation: Orientation;
  /** organization logo drawn top-left of the header */
  logo?: FormLogo | null;
  /** reserve an "affix photograph" box top-right (35×45 mm) */
  photoBox?: boolean;
  /** optional applicant photo drawn inside the photo box */
  photo?: FormLogo | null;
}): Promise<Uint8Array> {
  const { title, fields, pageSize, orientation, logo, photoBox, photo } = options;
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

  // ── Header: logo (left) + title + photo box (right) ──────────────────────
  const headerTop = y;
  let titleX = MARGIN;

  if (logo) {
    const img =
      logo.mime === 'image/png' ? await doc.embedPng(logo.bytes) : await doc.embedJpg(logo.bytes);
    const logoH = 44;
    const logoW = (img.width / img.height) * logoH;
    page.drawImage(img, { x: MARGIN, y: headerTop - logoH, width: logoW, height: logoH });
    titleX = MARGIN + logoW + 14;
  }

  if (title.trim()) {
    // keep the title clear of the photo box
    const titleY = logo ? headerTop - 28 : headerTop - 20;
    page.drawText(sanitize(title), { x: titleX, y: titleY, size: 20, font: bold });
  }

  if (photoBox) {
    const bx = width - MARGIN - PHOTO_W;
    const by = headerTop - PHOTO_H;
    page.drawRectangle({
      x: bx,
      y: by,
      width: PHOTO_W,
      height: PHOTO_H,
      borderColor: rgb(0.45, 0.5, 0.6),
      borderWidth: 1,
    });
    if (photo) {
      const img =
        photo.mime === 'image/png'
          ? await doc.embedPng(photo.bytes)
          : await doc.embedJpg(photo.bytes);
      // contain-fit inside the box
      const scale = Math.min(PHOTO_W / img.width, PHOTO_H / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      page.drawImage(img, { x: bx + (PHOTO_W - w) / 2, y: by + (PHOTO_H - h) / 2, width: w, height: h });
    } else {
      const lines = ['Affix recent', 'photograph', '(35 × 45 mm)'];
      lines.forEach((line, i) => {
        const lw = font.widthOfTextAtSize(line, 8);
        page.drawText(line, {
          x: bx + (PHOTO_W - lw) / 2,
          y: by + PHOTO_H / 2 + 10 - i * 11,
          size: 8,
          font,
          color: rgb(0.55, 0.58, 0.65),
        });
      });
    }
  }

  // fields begin below the tallest header element
  const headerBottom = Math.min(
    headerTop - (title.trim() || logo ? 44 : 0),
    photoBox ? headerTop - PHOTO_H - 8 : Infinity,
  );
  y = headerBottom;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: width - MARGIN, y },
    thickness: 1,
    color: rgb(0.35, 0.4, 0.95),
  });
  y -= 24;

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

  /** Field types short enough to sit two per row (space optimization). */
  const SHORT_TYPES: FormFieldType[] = ['number', 'date', 'time', 'phone', 'email', 'dropdown'];
  const isShort = (s: FormFieldSpec) => SHORT_TYPES.includes(s.type);

  /** Draw one short field (label + input) at a given column without moving y. */
  const drawShortField = (spec: FormFieldSpec, x: number, colWidth: number) => {
    const name = uniqueName(spec.label);
    const label = sanitize(spec.label.trim() || 'Untitled field') + (spec.required ? ' *' : '');
    page.drawText(label, { x, y: y - LABEL_SIZE, size: LABEL_SIZE, font: bold });
    const inputY = y - LABEL_SIZE - 8 - 22;
    if (spec.type === 'dropdown') {
      const dropdown = form.createDropdown(name);
      const opts = (spec.options.length ? spec.options : ['Option 1', 'Option 2']).map(sanitize);
      dropdown.addOptions(opts);
      if (spec.defaultValue && opts.includes(sanitize(spec.defaultValue))) {
        dropdown.select(sanitize(spec.defaultValue));
      }
      dropdown.addToPage(page, {
        x,
        y: inputY,
        width: colWidth,
        height: 22,
        borderColor: rgb(0.45, 0.5, 0.6),
        borderWidth: 1,
      });
      dropdown.setFontSize(INPUT_TEXT_SIZE);
      if (spec.required) dropdown.enableRequired();
    } else {
      const placeholder = PLACEHOLDERS[spec.type];
      if (placeholder) {
        const lw = bold.widthOfTextAtSize(label, LABEL_SIZE);
        page.drawText(placeholder, {
          x: x + lw + 8,
          y: y - LABEL_SIZE,
          size: LABEL_SIZE - 1,
          font,
          color: rgb(0.55, 0.58, 0.65),
        });
      }
      const field = form.createTextField(name);
      if (spec.defaultValue) field.setText(sanitize(spec.defaultValue));
      field.addToPage(page, {
        x,
        y: inputY,
        width: colWidth,
        height: 22,
        borderColor: rgb(0.45, 0.5, 0.6),
        borderWidth: 1,
      });
      field.setFontSize(INPUT_TEXT_SIZE);
      if (spec.required) field.enableRequired();
    }
  };

  for (let i = 0; i < fields.length; i++) {
    const spec = fields[i];
    const nextSpec = fields[i + 1];

    // Two consecutive short fields share one row — denser, professional layout.
    if (isShort(spec) && nextSpec && isShort(nextSpec)) {
      const gutter = 24;
      const colWidth = (fieldWidth - gutter) / 2;
      const blockHeight = LABEL_SIZE + 8 + 22 + 18;
      newPageIfNeeded(blockHeight); // whole row is atomic — never splits pages
      drawShortField(spec, MARGIN, colWidth);
      drawShortField(nextSpec, MARGIN + colWidth + gutter, colWidth);
      y -= blockHeight;
      i++;
      continue;
    }

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
        // Pre-measure how many rows the options need so the whole group is
        // atomic — a group never bleeds onto the next page.
        let rows = 1;
        let probeX = MARGIN;
        for (const opt of options) {
          const optWidth = 20 + font.widthOfTextAtSize(sanitize(opt), LABEL_SIZE) + 18;
          if (probeX + optWidth > width - MARGIN) {
            rows++;
            probeX = MARGIN;
          }
          probeX += optWidth;
        }
        newPageIfNeeded(LABEL_SIZE + 10 + rows * 24 + 10);
        page.drawText(label, { x: MARGIN, y: y - LABEL_SIZE, size: LABEL_SIZE, font: bold });
        y -= LABEL_SIZE + 10;
        const group = form.createRadioGroup(name);
        let x = MARGIN;
        for (const opt of options) {
          const optWidth = 20 + font.widthOfTextAtSize(sanitize(opt), LABEL_SIZE) + 18;
          if (x + optWidth > width - MARGIN) {
            x = MARGIN;
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

const PUNCT_MAP: Record<string, string> = {
  '—': '-',
  '–': '-',
  '‘': "'",
  '’': "'",
  '“': '"',
  '”': '"',
  '…': '...',
  '•': '-',
};

function sanitize(text: string): string {
  return (
    text
      .replace(/[—–‘’“”…•]/g, (c) => PUNCT_MAP[c])
      // eslint-disable-next-line no-control-regex
      .replace(/[^\n\x20-\x7E\xA0-\xFF]/g, '?')
  );
}
