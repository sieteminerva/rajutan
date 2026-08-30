/**
 * Convert Number to text 1-16 only refers to semantic-ui el wide
 * @param {number} number
 * @returns {string}
 */
export function numberToText(number: number): string | undefined {
  const numberMap: Record<number, string> = {
    1: "one",
    2: "two",
    3: "three",
    4: "four",
    5: "five",
    6: "six",
    7: "seven",
    8: "eight",
    9: "nine",
    10: "ten",
    11: "eleven",
    12: "twelve",
    13: "thirteen",
    14: "fourteen",
    15: "fifteen",
    16: "sixteen",
  };

  if (number && typeof number !== "number") {
    throw Error("parameter must be a number");
  } else if (number && (number < 1 || number > 16)) {
    throw Error("number must be between 1 and 16 inclusive");
  } else if (!number) {
    return;
  } else {
    return numberMap[number];
  }
}

/**
 * Configuration options for a table cell
 */
export interface TableCellOptions {
  rowSpan?: number;
  colSpan?: number;
  color?: string;
  wide?: number | string;
  textAlign?: "left" | "center" | "right";
  verticalAlign?: "top" | "center" | "bottom";
  format?: "number" | "text" | "currency" | "status" | "image" | "date";
  currency?: string;
  locale?: string;
  prefix?: string;
  suffix?: string;
  formula?: string | ((cells: TableCellModel[], ci: number) => any);
  contentEditable?: boolean;
  spellcheck?: boolean;
  class?: string;
  header?: string;
}

/**
 * Raw cell data structure
 */
export interface TableCellData {
  text?: string | number | HTMLElement | null;
  options?: TableCellOptions;
  group?: string;
  subrowOfUid?: string;
  _uid?: string;
  subrowOf?: string;
}

/**
 * Cell value type
 */
export type TableCellValue = string | number | TableCellData | HTMLElement | null;

/**
 * Table cell model (internal representation)
 */
export interface TableCellModel {
  key: string;
  value: any;
  options: TableCellOptions;
  header?: string;
  text?: string;
  isGroup?: boolean;
  groupItems?: TableCellModel[];
}

/**
 * Row options
 */
export interface TableRowOptions {
  rowSpan?: number;
  disableEditing?: boolean;
  id?: string;
  class?: string;
}

/**
 * Row model (internal representation)
 */
export interface TableRowModel {
  rowIndex?: number;
  autoNumber?: number;
  cells: TableCellModel[];
  parentUid?: string;
  uid?: string;
  options?: TableRowOptions;
  _uid?: string;
  subrowOfUid?: string;
  data?: TableCellModel[];
}

/**
 * Footer options
 */
export interface TableFooterOptions {
  renderTotal?: any[] | null;
  formula?: string | ((cells: TableCellModel[], ci: number) => any);
  rowspan?: number;
  colspan?: number;
  color?: string;
  wide?: number | string;
  textAlign?: "left" | "center" | "right";
  verticalAlign?: "top" | "center" | "bottom";
  format?: "number" | "text" | "currency" | "status" | "image" | "date";
  currency?: string;
  locale?: string;
  prefix?: string;
  suffix?: string;
}

/**
 * Table configuration
 */
export interface TableConfig {
  size?: "small" | "large" | "compact" | "very compact" | null;
  type?: "basic" | "collapsing" | "striped" | "inverted" | "fixed" | "padded" | "celled" | null;
  color?: string | null;
  textAlign?: "center" | "left" | "right" | null;
  sortable?: boolean;
  selectable?: boolean;
  scrolling?: boolean;
  editable?: boolean | string;
  autoNumbering?: boolean | string;
  pageSize?: number | null;
  disableSubRow?: boolean;
  headerOptions?: TableCellOptions;
  bodyOptions?: TableCellOptions[];
  footerOptions?: TableFooterOptions;
  footer?: string | HTMLElement | TableCellData[] | null;
  className?: string;
  verticalAlign?: "top" | "center" | "bottom";
}

/**
 * Table data structure
 */
export interface TableData {
  header?: (string | number | TableCellData)[];
  body?: (string | number | TableCellData)[];
  footer?: string | HTMLElement | TableCellData[] | null;
}

/**
 * DOM Model structure
 */
export interface DOMModel {
  header: TableRowModel[];
  body: TableRowModel[];
  footer: TableRowModel[];
}

/**
 * Change event detail
 */
export interface ChangeEventDetail {
  type: "add" | "remove" | "edit" | "insert" | "page" | "sort" | "subrow";
  rowIndex?: number;
  globalIndex?: number;
  parentIndex?: number;
  page?: number;
}

/**
 * Normalized cell structure
 */
interface NormalizedCell {
  text: TableCellValue;
  options: TableCellOptions;
}

/**
 * Applies custom CSS classes to a given HTML table element based on the provided configuration.
 */
export function __applyTableClasses(table: HTMLTableElement, config: TableConfig): void {
  const classes: string[] = ["table"];

  if (config.className) classes.push(config.className);
  if (config.size) classes.push(`${config.size}`);
  if (config.type) classes.push(`${config.type}`);
  if (config.color) classes.push(`${config.color}`);
  if (config.sortable) classes.push("sortable");
  if (config.selectable) classes.push("selectable");
  if (config.scrolling) classes.push("scrolling");
  if (config.textAlign) classes.push(`${config.textAlign}`);
  if (config.verticalAlign) classes.push(`${config.verticalAlign}`);

  table.className = classes.join(" ").trim();
}

/**
 * Normalizes a cell value into a standard structure.
 */
export function __normalizeCell(cell: TableCellValue): NormalizedCell {
  if (cell == null) return { text: null, options: {} };
  if (cell instanceof HTMLElement) return { text: cell, options: {} };
  if (typeof cell === "object" && "text" in cell) {
    return { text: cell.text ?? null, options: cell.options || {} };
  }
  return { text: cell, options: {} };
}

/**
 * Apply options (styling + formatting) to a table cell.
 */
export function __applyCellOptions(
  el: HTMLTableCellElement,
  options: TableCellOptions = {},
  rawValue?: any
): HTMLTableCellElement {
  if (!el || typeof el !== "object") return el;

  if (options.rowSpan) el.rowSpan = options.rowSpan;
  if (options.colSpan) el.colSpan = options.colSpan;

  const cls: string[] = [];
  if (options.class) el.className = options.class;
  if (options.color) cls.push(options.color);
  if (options.wide) {
    const w = typeof options.wide === "number" ? numberToText(options.wide) : String(options.wide);
    if (w) cls.push(`${w} wide`);
  }
  if (options.textAlign) cls.push(`${options.textAlign} aligned`);
  if (options.verticalAlign) cls.push(`${options.verticalAlign} aligned`);

  if (cls.length) {
    el.className = (el.className ? el.className + " " : "") + cls.join(" ");
  } else if (!el.className || el.className === "" || el.className === undefined) {
    el.removeAttribute("class");
  }

  // --- Formatting ---
  if (rawValue !== undefined) {
    if (
      rawValue &&
      typeof rawValue === "object" &&
      "subrowOfUid" in rawValue &&
      Array.isArray((rawValue as any).data)
    ) {
      rawValue = (rawValue as any).data;
    }
    const display = __formatValue(rawValue, options);
    if (display instanceof HTMLElement) {
      el.innerHTML = "";
      el.appendChild(display);
    } else {
      el.textContent = display;
    }
  }
  return el;
}

/**
 * Apply formula on load time.
 */
export function __applyFormula(
  data: { header: any[]; body: any[][] },
  config: TableConfig
): { header: any[]; body: any[][] } {
  for (let rowIndex = 0; rowIndex < data.body.length; rowIndex++) {
    for (let colIndex = 0; colIndex < data.body[rowIndex].length; colIndex++) {
      if (config.bodyOptions?.[colIndex]?.formula) {
        data.body[rowIndex][colIndex] = __calculateRow(
          data.header,
          data.body[rowIndex],
          colIndex,
          config.bodyOptions[colIndex].formula as string
        );
      }
    }
  }
  return data;
}

/**
 * Calculate a single cell value based on formula.
 */
export function __calculateRow(
  headers: any[],
  rowData: any[],
  colIndex: number,
  formula: string
): any {
  const ARITHMETIC_REGEX = /^[\d\s\+\-\*\/\%\.\(\)]+$/;
  const expr = formula.replace(/=| /g, "");
  const value = expr.replace(/[a-zA-Z_][a-zA-Z0-9_]*/g, (name) => {
    const ci = __findColIndexByHeader(headers, name);
    return rowData[ci]?.text ? rowData[ci].text : rowData[ci];
  });
  if (!ARITHMETIC_REGEX.test(value)) {
    console.error("Formula validation failed: The formula contains unsafe characters after substitution.", value);
    rowData[colIndex] = null;
    return null;
  }
  try {
    const calculate = new Function(`return ${value}`);
    rowData[colIndex] = calculate();
  } catch {
    rowData[colIndex] = null;
  }
  return rowData[colIndex];
}

/**
 * Applies a mathematical formula to a cell, calculating its value based on other cell values.
 */
export function __applyRowFormula(
  cells: TableCellModel[],
  ci: number,
  formula: string | ((cells: TableCellModel[], ci: number) => any)
): any {
  if (typeof formula === "string") {
    const ARITHMETIC_REGEX = /^[\d\s\+\-\*\/\%\.\(\)]+$/;
    const expr = formula.replace(/=| /g, "");

    const value = expr.replace(/[a-zA-Z_][a-zA-Z0-9_]*/g, (headerTitle) => {
      const i = cells.findIndex((c) => c.header === headerTitle);
      const cellValue = cells[i] ? cells[i].value : null;
      return (typeof cellValue === "number" ? cellValue : Number(cellValue) || 0).toString();
    });

    if (!ARITHMETIC_REGEX.test(value)) {
      console.error("Formula validation failed: The formula contains unsafe characters after substitution.", value);
      cells[ci].value = null;
      return null;
    }

    try {
      const calculate = new Function(`return ${value}`);
      cells[ci].value = calculate();
    } catch (e) {
      console.error(`Error calculating formula "${formula}":`, e);
      cells[ci].value = null;
    }

    return cells[ci].value;
  }

  // Support function formula
  if (typeof formula === "function") {
    try {
      cells[ci].value = formula(cells, ci);
    } catch (e) {
      console.error(`Error calculating formula function:`, e);
      cells[ci].value = null;
    }
    return cells[ci].value;
  }

  return null;
}

/**
 * Find header column index by given title
 */
export function __findColIndexByHeader(headers: any[], title: string): number {
  return headers.findIndex((h) => {
    if (typeof h === "string") return h.toLowerCase() === title.toLowerCase();
    if (typeof h === "object" && h !== null) return h.text?.toLowerCase() === title.toLowerCase();
    return false;
  });
}

/**
 * Convert edited text back into the correct typed value based on format/type.
 */
export function __parseValue(text: any, type: string = "text"): any {
  if (text == null) return "";

  const trimmed = String(text).trim();

  switch (type) {
    case "number": {
      const cleaned = trimmed.replace(/,/g, "");
      const n = Number(cleaned);
      return Number.isNaN(n) ? trimmed : n;
    }
    case "boolean":
      return trimmed.toLowerCase() === "true" || trimmed === "1";
    case "object":
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed;
      }
    case "currency": {
      const cleaned = trimmed.replace(/[^0-9.-]+/g, "");
      const n = Number(cleaned);
      return Number.isNaN(n) ? trimmed : n;
    }
    case "status":
      return trimmed.toLowerCase() === "yes" || trimmed === "1" || trimmed.toLowerCase() === "true";
    case "date": {
      const d = new Date(trimmed);
      return isNaN(d.getTime()) ? trimmed : d.toISOString();
    }
    case "image":
      return trimmed;
    case "text":
    default:
      return trimmed;
  }
}

/**
 * Convert raw value into a display string (or element) based on options.format.
 */
export function __formatValue(rawValue: any, options: TableCellOptions = {}): string | HTMLElement {
  if (rawValue == null) return "";

  let display: string | HTMLElement = rawValue;

  // console.log({ display })

  switch (options.format) {
    case "number":
      display = Number(rawValue).toLocaleString();
      break;
    case "currency":
      display = Number(rawValue).toLocaleString(options.locale, {
        style: "currency",
        currency: options.currency || "USD",
        minimumFractionDigits: 2,
      });
      break;
    case "status":
      display = rawValue ? "YES" : "NO";
      break;
    case "image":
      if (typeof rawValue === "string") {
        const img = document.createElement("img");
        img.src = rawValue;
        img.alt = (options as any).alt || "";
        img.className = "cell-image";
        return img;
      }
      break;
    case "date":
      try {
        const d = new Date(rawValue);
        display = d.toLocaleDateString();
      } catch {
        display = String(rawValue);
      }
      break;
    case "text":
    default:
      display = String(rawValue);
  }

  if (options.prefix) display = options.prefix + " " + display;
  if (options.suffix) display = display + " " + options.suffix;

  return display;
}

export function __getRowData(row: TableRowModel | any[]): any[] {
  return Array.isArray(row) ? row : (row?.data ?? []);
}

/**
 * Count visible subrows for a parent UID inside the current page slice.
 */
export function __countVisibleSubRowsByUid(
  body: TableRowModel[],
  parentUid: string,
  { pageSize, currentPage, start = null, end = null }: { pageSize?: number; currentPage?: number; start?: number | null; end?: number | null }
): number {
  const s = start != null ? start : pageSize ? (currentPage! - 1) * pageSize : 0;
  const e = end != null ? end : pageSize ? Math.min(body.length, s + pageSize) : body.length;

  let count = 0;
  for (let i = s; i < e; i++) {
    const r = body[i];
    if (r && typeof r === "object" && r.subrowOfUid === parentUid) count++;
  }
  return count;
}

/**
 * Count all subrows for a parent UID (whole dataset)
 */
export function __countAllSubRowsByParentUid(body: TableRowModel[], parentUid: string): number {
  let count = 0;
  for (let i = 0; i < body.length; i++) {
    const r = body[i];
    if (r && typeof r === "object" && r.subrowOfUid === parentUid) count++;
  }
  return count;
}

export function __computeRowTotalValue(
  body: TableRowModel[],
  parentIndex: number,
  formulaIndex: number
): number | null {
  if (formulaIndex < 0) return null;

  const parentRow = body[parentIndex];
  if (!parentRow) return null;

  const parentUid = parentRow._uid;
  if (!parentUid) return null;

  function sumRow(row: TableRowModel, startIndex: number): number {
    const rowArr = __getRowData(row);
    let total = Number(rowArr?.[formulaIndex] ?? 0);

    for (let i = startIndex; i < body.length; i++) {
      const r = body[i];
      if (!r || typeof r !== "object") continue;

      if (r.subrowOfUid === row._uid) {
        total += sumRow(r, i + 1);
      } else if (!r.subrowOfUid || r.subrowOfUid === parentUid) {
        break;
      }
    }
    return total;
  }

  const total = sumRow(parentRow, parentIndex + 1);
  return Number.isFinite(total) ? total : null;
}

export function __getHeaderGroupNames(arr: any[], propertyName: string): string[] {
  const seen = new Set<string>();
  return arr.reduce((duplicates: string[], currentItem: any) => {
    const value = currentItem[propertyName];
    if (seen.has(value) && !duplicates.includes(value)) {
      duplicates.push(value);
    }
    seen.add(value);
    return duplicates;
  }, []);
}

/**
 * Fluent builder for creating table cell model objects.
 */
export function tcell(key: string): {
  header: (v: string) => any;
  value: (v: any) => any;
  rowspan: (n: number) => any;
  colspan: (n: number) => any;
  wide: (n: number | string) => any;
  align: (pos: "left" | "center" | "right") => any;
  valign: (pos: "top" | "center" | "bottom") => any;
  format: (f: TableCellOptions["format"]) => any;
  prefix: (p: string) => any;
  suffix: (s: string) => any;
  locale: (l: string) => any;
  currency: (c: string) => any;
  editable: (flag?: boolean) => any;
  spellcheck: (flag?: boolean) => any;
  class: (c: string) => any;
  color: (c: string) => any;
  option: (key: string, value: any) => any;
  options: (opts: TableCellOptions) => any;
  create: () => TableCellModel;
} {
  const _c: TableCellModel = { key, value: null, options: {} };

  return {
    header(v: string) {
      _c.header = v;
      return this;
    },
    value(v: any) {
      _c.value = v;
      return this;
    },
    rowspan(n: number) {
      _c.options.rowSpan = Number(n);
      return this;
    },
    colspan(n: number) {
      _c.options.colSpan = Number(n);
      return this;
    },
    wide(n: number | string) {
      _c.options.wide = n;
      return this;
    },
    align(pos: "left" | "center" | "right") {
      _c.options.textAlign = pos;
      return this;
    },
    valign(pos: "top" | "center" | "bottom") {
      _c.options.verticalAlign = pos;
      return this;
    },
    format(f: TableCellOptions["format"]) {
      _c.options.format = f;
      return this;
    },
    prefix(p: string) {
      _c.options.prefix = p;
      return this;
    },
    suffix(s: string) {
      _c.options.suffix = s;
      return this;
    },
    locale(l: string) {
      _c.options.locale = l;
      return this;
    },
    currency(c: string) {
      _c.options.currency = c;
      return this;
    },
    editable(flag = true) {
      _c.options.contentEditable = !!flag;
      return this;
    },
    spellcheck(flag = true) {
      _c.options.spellcheck = !!flag;
      return this;
    },
    class(c: string) {
      _c.options.class = c;
      return this;
    },
    color(c: string) {
      _c.options.color = c;
      return this;
    },
    option(key: string, value: any) {
      (_c.options as any)[key] = value;
      return this;
    },
    options(opts: TableCellOptions) {
      Object.assign(_c.options, opts);
      return this;
    },
    create(): TableCellModel {
      return { ..._c };
    },
  };
}

/**
 * Bind sort listener to header cells
 */
export function __bindSortListener(
  th: HTMLTableCellElement,
  colIndex: number,
  onSort: (colIndex: number, isAscending: boolean) => void
): void {
  let isAscending = true;
  th.style.cursor = "pointer";
  th.addEventListener("click", () => {
    isAscending = !isAscending;
    onSort(colIndex, isAscending);
  });
}
