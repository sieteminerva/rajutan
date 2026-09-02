import type { iActionProperty, iBuilderConfig, iBuilderRegistry } from "../../interface";
import { Builder } from "../Base";
import {
  __applyTableClasses,
  __normalizeCell,
  __applyCellOptions,
  __applyFormula,
  __applyRowFormula,
  __findColIndexByHeader,
  __parseValue,
  __formatValue,
  __getRowData,
  __countVisibleSubRowsByUid,
  __computeRowTotalValue,
  __getHeaderGroupNames,
  tcell,
  __bindSortListener,
  __calculateRow,
  type TableRowModel,
  type TableConfig,
  type TableData,
  type DOMModel,
  type TableCellData,
  type TableCellModel,
  type TableCellOptions,
  type TableFooterOptions,
} from "./Table.helper";
// import "./Table.css";
/**
 * Table element type keys for the builder's selector system.
 * These correspond to the structural parts of a table component.
 */
export type TableElementType =
  | "@container"
  | "@table"
  | "@table>thead"
  | "@table>tbody"
  | "@table>tfoot"
  | "@table>tfoot>pagination"
  | "@table>tfoot>pagination>item"
  | "@table>tfoot>pagination>prev"
  | "@table>tfoot>pagination>next"
  | "@table>tfoot>add-row"
  | "@table>trow"
  | "@table>trow>th"
  | "@table>trow>cell"
  | "@table>trow>total"
  | "@table>tbody>actions"
  | "@table>tbody>actions>edit"
  | "@table>tbody>actions>remove"
  | "@table>tbody>actions>add"
  | "@table>icon";

/**
 * Configuration interface for the Table builder.
 * Extends the base builder configuration with table-specific options.
 */
export interface iTableConfig extends iBuilderConfig<TableElementType> {
  container?: string | HTMLElement | null;
  size?: "small" | "large" | "compact" | "very compact" | null;
  type?: "basic" | "collapsing" | "striped" | "inverted" | "fixed" | "padded" | "celled" | null;
  color?: string | null;
  textAlign?: "left" | "center" | "right" | null;
  sortable?: boolean;
  selectable?: boolean;
  editable?: boolean;
  renderAsCard?: boolean;
  autoNumbering?: boolean;
  pageSize?: number;
  disableSubRow?: boolean;
  headerOptions?: TableCellOptions;
  bodyOptions?: TableCellOptions[];
  footerOptions?: TableFooterOptions;
  autoFreezeAt?: number | null;
  className?: string;
  namespace?: string | null;
}

export class TableBuilder extends Builder<TableElementType, iTableConfig> {
  readonly builderId: keyof iBuilderRegistry = "table";
  readonly name: keyof iBuilderRegistry = "table";
  readonly stylesheet: string = "./Table.css";

  // Instance State Variables
  private currentPage = 1;
  private pageRows: any[] = [];
  private _uidCounter = 0;
  private _generateRowUID = () => `row_${++this._uidCounter}`;
  private _isRowTotalRendered = false;
  private _totalColumns: number | null = null;

  // Element References
  private table!: HTMLTableElement;
  private thead!: HTMLElement | null;
  private tbody!: HTMLElement | null;
  private tfoot!: HTMLElement | null;

  // Data Storage
  private data!: TableData;

  // DOM Model
  private domModel: DOMModel = { header: [], body: [], footer: [] };

  constructor(config: Partial<iTableConfig> = {}) {
    super();

    const defaultSelectors: Record<TableElementType, iActionProperty> = {
      "@container": { tagName: "div", className: "table-container" },
      "@table": { tagName: "table", className: "table" },
      "@table>thead": { tagName: "thead" },
      "@table>tbody": { tagName: "tbody" },
      "@table>tbody>actions": { tagName: "div", className: "actions-set", wrapper: "td.actions" },
      "@table>tbody>actions>edit": { tagName: "button", className: "edit-btn", icon: "edit" },
      "@table>tbody>actions>remove": { tagName: "button", className: "remove-btn", icon: "trash" },
      "@table>tbody>actions>add": { tagName: "button", className: "add-btn", icon: "plus square" },
      "@table>tfoot": { tagName: "tfoot" },
      "@table>tfoot>pagination": { tagName: "div", className: "pagination menu" },
      "@table>tfoot>pagination>item": { tagName: "a", className: "item" },
      "@table>tfoot>pagination>prev": { tagName: "a", className: "item prev", icon: "arrow left" },
      "@table>tfoot>pagination>next": { tagName: "a", className: "item next", icon: "arrow right" },
      "@table>tfoot>add-row": { tagName: "button", className: "add-row-btn", icon: "plus" },
      "@table>trow": { tagName: "tr" },
      "@table>trow>th": { tagName: "th" },
      "@table>trow>cell": { tagName: "td" },
      "@table>trow>total": { tagName: "div", className: "cell grand" },
      "@table>icon": { tagName: "i", className: "icon" },
    };

    const defaultConfig: Required<iTableConfig> = {
      themeId: "default",
      container: null,
      size: null,
      type: null,
      color: null,
      textAlign: null,
      sortable: false,
      selectable: false,
      editable: true,
      renderAsCard: false,
      autoFreezeAt: null,
      autoNumbering: true,
      pageSize: 8,
      disableSubRow: false,
      headerOptions: {},
      bodyOptions: [],
      footerOptions: {},
      className: "",
      selectors: defaultSelectors,
      namespace: null,
      emit: null,
    };

    this.config = this.resolveConfig(defaultConfig, config);
  }

  /**
   * Public entry point for materializing the table component from input data.
   * Transforms the incoming payload into a DOM fragment while preserving the shared builder lifecycle.
   */
  public prepare(content: any, _config: Required<iTableConfig>): HTMLElement | Record<string, any | HTMLElement> {

    const container = this.render("@container")!;
    // Reset internal state
    this.currentPage = 1;
    this.pageRows = [];
    this._uidCounter = 0;
    this._generateRowUID = () => `row_${++this._uidCounter}`;
    this._isRowTotalRendered = false;
    this._totalColumns = null;
    this.domModel = { header: [], body: [], footer: [] };

    this.data = content;

    // Jika perlu memastikan properti header/body/footer ada tanpa menghilangkan Proxy:
    if (!this.data.header) this.data.header = [];
    if (!this.data.body) this.data.body = [];
    if (!this.data.footer) this.data.footer = null;

    // console.log(this.data /* Proxy(Object) */)

    // Create main table element using render
    this.table = this.render("@table", this.data) as HTMLTableElement;

    if (this.table) {
      __applyTableClasses(this.table, this.config);
    }

    this.renderTable()

    container?.appendChild(this.table)

    this.hierarchy.update();

    return container;
  }

  private renderTable() {
    // Step 1: Process the raw data to create an internal DOM model.
    this.domModel = this.resolvePayload(this.data);

    this.thead = this.render("@table>thead", this.domModel.header)!;
    this.tbody = this.render("@table>tbody", this.domModel.body)!;
    this.tfoot = this.render("@table>tfoot", this.domModel.footer)!;

    this.table.replaceChildren(this.thead, this.tbody, this.tfoot)


    this._applyFreezeColumns(this.table)
    // Step 3: Return the fully rendered table element.

    return this.table;
  }

  /**
   * Runtime event-binding hook.
   * Triggered at the very end of the creation lifecycle to lock persistent browser
   * click/drag/swipe interactive listeners onto the completed DOM structure.
   */
  public initialize(el?: HTMLElement, _payload?: any): void {
    const table = el?.firstElementChild as HTMLElement;
    if (!table) return;

    if (this._totalColumns! > 5 && !this._isRowTotalRendered && this.config.renderAsCard) table.classList.add("stacked");

    table?.addEventListener("click", (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // 1. Cari elemen terdekat yang punya attribute [data-action]
      const actionEl = target.closest<HTMLElement>("[data-action]");
      if (!actionEl) return;

      const action = actionEl.dataset.action;

      // 2. Fallback cerdas untuk pembacaan rowIndex:
      // Ambil dari dataset actionEl sendiri, jika tidak ada, ambil dari parent <tr data-global-index="...">
      const parentTr = actionEl.closest<HTMLTableRowElement>("tr[data-global-index]");
      const rawRowIndex = actionEl.dataset.rowIndex ?? parentTr?.dataset.globalIndex;
      const rowIndex = rawRowIndex !== undefined ? Number(rawRowIndex) : NaN;

      switch (action) {
        case "remove":
          if (!isNaN(rowIndex)) {
            this.removeRow(rowIndex);
          }
          break;

        case "edit": {
          // Jika parentTr tidak ketemu via closest, gunakan selector fallback
          const tr = parentTr ?? this.tbody?.querySelector<HTMLTableRowElement>(`tr[data-global-index="${rowIndex}"]`);
          if (!tr) return;

          const editing = tr.classList.toggle("editing");
          actionEl.classList.toggle("active", editing);

          // Dipanggil 1x saja secara bersih
          this.toggleEdit(tr, editing);

          if (editing) {
            const firstCell = tr.cells.item(0);
            if (firstCell instanceof HTMLElement) {
              firstCell.focus();
            }
          }
          break;
        }

        case "add":
          this.addRow();
          break;

        case "add-subrow":
          if (!isNaN(rowIndex)) {
            this.insertSubRow([], rowIndex);
          }
          break;

        case "previous":
          if (this.currentPage > 1) {
            this.switchPage(this.currentPage - 1);
          }
          break;

        case "next":
          this.switchPage(this.currentPage + 1);
          break;

        case "page": {
          const page = Number(actionEl.textContent);
          if (!isNaN(page) && page !== this.currentPage) {
            this.switchPage(page); // Let switchPage handle the UI re-render/active class update
          }
          break;
        }
      }
    });

    if (this.config.renderAsCard) {
      el!.style.overflowX = "hidden";
      el!.style.width = "100%";
    }
    // console.log(el)
    // console.log("[TableBuilder2 Lifecycle] Table component initialized successfully.");
  }


  toJson() {
    const data = this.getData();
    return data.body.map(row =>
      data.header.reduce((obj, header, index) => {
        obj[header] = row[index];
        return obj;
      }, {} as Record<string, string>)
    );
  }

  getData({ includeMeta = false }: { includeMeta?: boolean } = {}): { header: any[]; body: any[]; footer: any[] } {
    const header = this.data.header!.slice();
    const body = this.data.body!.map((r) => {
      if (!includeMeta) {
        return Array.isArray(r)
          ? r.map((v) => (v && typeof v === "object" && v.text ? v.text : v)).slice()
          : (r as any).data && Array.isArray((r as any).data)
            ? (r as any).data.map((dv: TableCellData) => (dv && dv.text ? dv.text : dv)).slice()
            : [];
      } else {
        if (Array.isArray(r)) return r.slice();
        return includeMeta ? { subrowOfUid: (r as any).subrowOfUid, data: (r as any).data.slice() } : (r as any).data.slice();
      }
    });
    const footer = this.data.footer ? (this.data.footer as TableCellData[]).slice() : [];
    return { header, body, footer };
  }


  public addRow(inputRowData: TableCellData[] | null = null): void {
    // Step 1: Determine the number of columns based on the header length.
    // This ensures that new rows have the correct number of cells, even if inputRowData is shorter.
    // If inputRowData is null or shorter than the header, fill missing cells with empty strings.
    const cols = Math.max(0, this.data.header!.length);
    const newRow = Array.isArray(inputRowData)
      ? inputRowData.slice(0, cols).concat(Array(Math.max(0, cols - inputRowData.length)).fill(""))
      : Array(cols).fill("");
    this.data.body!.push(newRow as any);

    // console.log("newly added row", this.data.body)

    if (this.config.pageSize) {
      // Step 2: If pagination is enabled, calculate the total number of pages
      // and set the current page to the last page to ensure the new row is visible.
      const pages = Math.ceil(this.data.body!.length / this.config.pageSize);
      this.currentPage = pages;
    }

    // Step 3: Determine the global index of the newly added row.
    const newGlobalIndex = this.data.body!.length - 1;

    this.renderTable()
    this._openRowForEditByGlobalIndex(newGlobalIndex);
    // Step 6: Emit a "change" event to notify listeners about the row addition.
    // this._emitChange({ type: "add", rowIndex: newGlobalIndex });
  }

  public toggleEdit(tr: HTMLTableRowElement, editable: boolean): void {
    // toggles contenteditable on data columns (td[data-col-index])
    // Step 1: Identify the index of any column that has a formula defined in bodyOptions.
    // Cells in this column are typically not directly editable.
    const formulaIndex = (this.config.bodyOptions || []).findIndex((opt) => !!opt?.formula);
    // Step 2: Get the global index of the row from its dataset.
    const g = Number(tr.dataset.globalIndex ?? tr.sectionRowIndex);
    // Step 3: Get the unique identifier of the row from its dataset.
    // const uid = tr.dataset.uid;

    // Step 4: Iterate over all table data cells (<td>) within the current row.
    tr.querySelectorAll("td").forEach((td) => {
      // Step 5: Get the column index of the current cell.
      // const ci = Number(td.dataset.colIndex);
      const ci = td.cellIndex - 1;
      // Disable spellcheck on each cell
      td.spellcheck = false;
      // Step 6: Skip cells that are not meant to be editable:
      // - Action buttons column (has class 'action').
      // - Row total column (has class 'row-total').
      // - Cells without a 'data-col-index' (e.g., auto-numbering column).
      // - Cells with a 'data-col-index' of -1 (which might indicate a special column).
      // - Cells that correspond to a formula column (as their values are computed).
      if (
        td.classList.contains("actions") ||
        td.classList.contains("row-total") ||
        td.dataset.colIndex === undefined ||
        ci === Number(-1) ||
        ci === formulaIndex
      ) {
        return;
      }

      // Step 7: If enabling editing for the row.
      if (editable) {
        // Step 7a: Retrieve the original raw value of the cell. If not available,
        // try to get it from the main data body or default to an empty string.
        const rawVal = td.dataset.originalValue ?? __getRowData((this.data.body as any[])[g])[ci] ?? "";
        // Step 7b: Set the cell's inner HTML to the raw value, wrapped in a div for consistent styling.
        td.innerHTML = `<div class="cell">${rawVal == null ? "" : String(rawVal)}</div>`;

        td.contentEditable = "true";

        // Step 7d: Focus the cell to allow immediate editing.
        td.focus();
      } else {
        // Step 8: If disabling editing for the row (committing changes).
        // Step 8a: Get the edited text content from the cell, trimming whitespace.
        const editedText = td.firstChild?.textContent == null ? "" : td.firstChild?.textContent.trim();
        // Step 8b: Determine the format of the cell (defaulting to 'text').
        const format = td.dataset.format || "text";
        // Step 8c: Parse the edited text into its final typed value based on the format.
        const finalVal = __parseValue(editedText, format);

        // Step 8d: Update the underlying data model with the final value.
        // Handles both simple array rows and sub-row objects.
        const row = this.data.body![g];
        if (Array.isArray(row)) {
          row[ci] = finalVal;
        } else if (row && (row as TableCellData).subrowOfUid != null && Array.isArray((row as any).data)) {
          (row as any).data[ci] = finalVal;
        }

        // Step 8e: Store the final value as the original raw value for subsequent edits.
        td.dataset.originalValue = finalVal;

        // Step 8f: Reformat the display value of the cell and update its inner HTML.
        const display = __formatValue(finalVal, (td as any).__cellOptions!) || {};
        td.innerHTML = `<div class="cell">${display}</div>`;
        // Step 8g: Disable contentEditable;
        td.contentEditable = "false";
      }
    });




    // Step 9: If editing was disabled, re-render the entire table to update
    // any dependent calculations (like footer totals, row totals) and emit a change event.
    if (!editable) {
      // console.log("newly edited row", this.data.body?.[g])
      this.renderTable();
      // this._emitChange({ type: "edit" });
    }
  }

  public removeRow(globalIndex: number): void {
    if (globalIndex < 0 || globalIndex >= this.data.body!.length) return;

    const target = this.data.body?.[globalIndex];
    const parentUid = target && (target as any)._uid;

    // if parent has uid, remove all subrows that reference it first
    // Step 1: If the row to be removed is a parent, remove all its sub-rows first.
    if (parentUid) {
      // remove from the end to avoid reindexing issues
      for (let i = this.data.body!.length - 1; i > globalIndex; i--) {
        const r = this.data.body?.[i];
        if (r && typeof r === "object" && r.subrowOfUid === parentUid) {
          this.data.body!.splice(i, 1);
        }
      }
    }

    // Step 2: Remove the target row itself from the data model.
    // finally remove the parent
    this.data.body!.splice(globalIndex, 1);

    // Step 3: Adjust pagination if the table is paginated.
    // adjust pagination
    if (this.config.pageSize) {
      const pages = Math.max(1, Math.ceil(this.data.body!.length / this.config.pageSize));
      if (this.currentPage > pages) this.currentPage = pages;
    }

    // Step 4: Re-render the table to reflect the removal.
    this.renderTable();
    // Step 5: Emit a "change" event to notify listeners about the row removal.
    // this._emitChange({ type: "remove", rowIndex: globalIndex });
  }

  public insertSubRow(inputRowData: any[] | null = null, parentIndex: number): void {
    const cols = Math.max(0, this.data.header!.length);
    const normalized = Array.isArray(inputRowData)
      ? inputRowData.slice(0, cols).concat(Array(Math.max(0, cols - inputRowData.length)).fill(""))
      : Array(cols).fill("");

    // Step 1: Ensure parent has uid and get its UID.
    // ensure parent has uid
    const parent = this.data.body?.[parentIndex];
    if (!parent) throw new Error("insertSubRow: invalid parentIndex");
    if (!(parent as TableCellData)._uid) (parent as TableCellData)._uid = this._generateRowUID();
    const parentUid = (parent as TableCellData)._uid;

    const newSubRow = { subrowOfUid: parentUid, data: normalized, _uid: this._generateRowUID() };
    // Step 2: Find the correct insertion index for the new sub-row.
    // find insert index after existing subrows for that parent
    let insertIndex = parentIndex + 1;
    while (insertIndex < this.data.body!.length && (this.data.body?.[insertIndex] as TableCellData).subrowOfUid === parentUid) {
      insertIndex++;
    }

    // Step 3: Insert the new sub-row into the data model.
    this.data.body!.splice(insertIndex, 0, newSubRow);

    // console.log("newly added subrow", this.data.body)
    // Step 4: Re-render the table to display the new sub-row.
    this.renderTable();
    // Step 5: Open the newly inserted sub-row for editing.
    this._openRowForEditByGlobalIndex(insertIndex);

    // Step 6: Emit a "change" event to notify listeners about the sub-row addition.
    // this._emitChange({ type: "add-subrow", parentIndex, rowIndex: insertIndex });
  }

  public switchPage(pageNumber: number): void {
    const pages = this.config.pageSize ? Math.max(1, Math.ceil(this.data.body!.length / this.config.pageSize)) : 1;
    if (pageNumber < 1 || pageNumber > pages) return;
    this.currentPage = pageNumber;
    this.renderTable();
    // this._emitChange({ type: "pagechange", pageNumber: this.currentPage, pageRows: this.pageRows });
  }

  sort(propertyName: string): void {
    this.domModel.body.sort((a: any, b: any) => a[propertyName] - b[propertyName]);
  }

  /**
   * Template hook for atomic data injection into specific element types.
   * This is called by the base render() method for each element created.
   */
  protected template(typeKey: TableElementType, el: HTMLElement, payload: any, selector: iActionProperty): void {

    switch (typeKey) {


      case "@table>tbody":
        // Use indexed loop to keep rowIdx as a clean number type
        for (let rowIdx = 0; rowIdx < payload.length; rowIdx++) {
          const rowModel = payload[rowIdx];
          // Step 3: Render framework row element wrapper
          const tr = this.render("@table>trow", { useCell: true, ...rowModel }) as HTMLTableRowElement;

          if (tr) el.appendChild(tr);
        }

        break;

      case "@table>thead":
        for (const row of payload) {
          const tr = this.render("@table>trow", row) as HTMLTableRowElement;
          el.appendChild(tr)
        }

        break;

      case "@table>tfoot":
        for (const row of payload) {
          const tr = this.render("@table>trow", row) as HTMLTableRowElement;
          el.appendChild(tr)
        }
        break;

      case "@table>trow":
        el.dataset.globalIndex = String(payload.rowIndex);
        if (payload.uid) el.dataset.uid = payload.uid;

        // Step 5: Check sub-row status
        const rawRow = this.data.body![payload.rowIndex as number];
        const isSubRow = rawRow && typeof rawRow === "object" && rawRow.subrowOfUid != null;
        if (isSubRow) el.classList.add("subrow");

        if (payload.cells) {
          if (payload.useCell) {
            // Step 4: Set data attributes safely
            el.dataset.globalIndex = String(payload.rowIndex);
            if (payload.uid) el.dataset.uid = payload.uid;

            // Step 5: Check sub-row status
            const rawRow = this.data.body![payload.rowIndex as number];
            const isSubRow = rawRow && typeof rawRow === "object" && rawRow.subrowOfUid != null;
            if (isSubRow) el.classList.add("subrow");

            // console.log(payload.cells)
            // Step 6: Render each cell
            for (let ci = 0; ci < payload.cells.length; ci++) {
              let cell = payload.cells[ci];
              if (this._totalColumns! > 5 && !this.config.renderAsCard) {
                if (ci === 2) cell.options.class = (cell.options.class ? cell.options.class + " " : "") + "freeze".trim()
              }
              let td = this.render("@table>trow>cell", { index: ci, ...cell }) as HTMLTableCellElement; // Keep framework tracking wrapper intact
              // Efficient indexing insertion honoring your custom runner markup
              el.insertBefore(td, el.children[ci] || null);
            }
          } else {
            for (let ci = 0; ci < payload.cells.length; ci++) {
              const cell = payload.cells[ci];
              // Step 7: Create a new <th> element for the current cell.
              const th = this.render("@table>trow>th", { index: ci, ...cell }) as HTMLTableCellElement;
              el.appendChild(th);
            }
          }
        }
        break;

      case "@table>trow>th":
        // console.log({ payload })
        if (payload.options) __applyCellOptions(el as HTMLTableCellElement, payload.options);
        const ColIndex = payload.index - (this.config.autoNumbering ? 1 : 0);
        el.dataset.colIndex = String(ColIndex);
        if (payload.value) {
          if (typeof payload.value === "string" || payload.text) {
            el.innerHTML = payload.value || payload.text;
          } else if (payload?.value instanceof HTMLElement) {
            el.append(payload.value);
          } else {
            el.innerHTML = ""; // empty cell
          }
        }
        break;

      case "@table>trow>cell":
        const cell = document.createElement("div");
        cell.className = "cell";

        // console.log({ payload })
        if (payload.value) {
          const formattedValue = __formatValue(payload.value, payload.options || {});
          // Step 8: Framework-aware cell content rendering
          if (payload.value instanceof HTMLElement) {
            el.appendChild(payload.value);
          } else if (formattedValue instanceof HTMLElement) {
            el.appendChild(formattedValue);
          } else {
            cell.textContent = payload.value
            el.appendChild(cell);
          }
        }

        if (payload.options) __applyCellOptions(el as HTMLTableCellElement, payload.options);
        // Step 10: Attach tracking metadata directly to DOM
        const relativeColIndex = payload.index - (this.config.autoNumbering ? 1 : 0);
        el.dataset.colIndex = String(relativeColIndex);

        el.dataset.header = (payload.header ? payload.header : payload.key === "autoNumber" ? "#" : payload.key).toLowerCase();
        el.dataset.format = (payload.options && payload.options.format) || typeof payload.value === "object" && payload.value instanceof Element ? "Element" : typeof payload.value;
        if (!(payload.value instanceof Element)) el.dataset.originalValue = payload.value != null ? payload.value.toString() : "";
        (el as any).__cellOptions = payload.options || {};
        break;

      case "@table>icon":
        el.className = el.className + " " + payload
        break;

      case "@table>tfoot>add-row":
        (el as HTMLButtonElement).type = "button";
        if (["small", "very compact"].includes(this.config.size!)) el.classList.add("mini");
        const addRowIcon = this.render("@table>icon", selector.icon) as HTMLElement;
        const span = document.createElement("span");
        span.textContent = "Add Row";
        span.style.marginLeft = "0.3em";
        el.append(addRowIcon, span)
        el.setAttribute("aria-label", "Add Row");
        el.setAttribute("data-action", "add");
        break;

      case "@table>tfoot>pagination":
        if (this.config.size === "small" || this.config.size === "very compact") el.classList.add("mini");
        const totalPages = Math.max(1, Math.ceil(payload.body.length / this.config.pageSize!));

        const prev = this.render("@table>tfoot>pagination>prev", null)
        el.appendChild(prev!);

        for (let i = 1; i <= totalPages; i++) {
          const item = this.render("@table>tfoot>pagination>item", i);

          el.appendChild(item!);
        }

        const next = this.render("@table>tfoot>pagination>next", totalPages)
        el.appendChild(next!);
        break;

      case "@table>tfoot>pagination>prev":
        const previousArrow = this.render("@table>icon", selector.icon) as HTMLElement;
        el.appendChild(previousArrow)
        el.setAttribute("aria-label", "Previous page");
        el.setAttribute("data-action", "previous");
        el.addEventListener("click", () => this.switchPage(this.currentPage - 1));
        el.style.pointerEvents = this.currentPage <= 1 ? "none" : "";
        break;

      case "@table>tfoot>pagination>next":
        const nextArrow = this.render("@table>icon", selector.icon) as HTMLElement;
        el.appendChild(nextArrow)
        el.setAttribute("aria-label", "Next page");
        el.setAttribute("data-action", "next");
        el.addEventListener("click", () => this.switchPage(this.currentPage - 1));
        el.style.pointerEvents = this.currentPage >= payload ? "none" : "";
        break;

      case "@table>tfoot>pagination>item":
        el.textContent = String(payload);
        if (this.currentPage === payload) el.classList.add("active")
        el.setAttribute("aria-label", "Selected page");
        el.setAttribute("data-action", "page");
        break;

      case "@table>tbody>actions":
        if (!payload.isSubRow) {
          const addBtn = this.render("@table>tbody>actions>add", payload) as HTMLButtonElement;
          el.appendChild(addBtn);
        }
        const editBtn = this.render("@table>tbody>actions>edit", payload) as HTMLButtonElement;
        el.appendChild(editBtn)
        const removeBtn = this.render("@table>tbody>actions>remove", payload) as HTMLButtonElement;
        el.appendChild(removeBtn)
        if (["small", "very compact"].includes(this.config.size!)) {
          el.querySelectorAll("button").forEach((b) => b.classList.add("mini"));
        }
        break;

      case "@table>tbody>actions>edit":
        const editIcon = this.render("@table>icon", selector.icon) as HTMLElement;
        (el as HTMLButtonElement).type = "button";
        el.appendChild(editIcon)
        el.setAttribute("aria-label", "Edit row");
        el.setAttribute("data-action", "edit");
        if (payload?.rowUid) el.dataset.rowUid = payload.rowUid;
        break;

      case "@table>tbody>actions>remove":
        const removeIcon = this.render("@table>icon", selector.icon) as HTMLElement;
        (el as HTMLButtonElement).type = "button";
        el.appendChild(removeIcon)
        el.setAttribute("aria-label", "Remove row");
        el.setAttribute("data-action", "remove");
        if (payload?.rowUid) el.dataset.rowUid = payload.rowUid;
        break;

      case "@table>tbody>actions>add":
        const addIcon = this.render("@table>icon", selector.icon) as HTMLElement;
        (el as HTMLButtonElement).type = "button";
        el.appendChild(addIcon)
        el.setAttribute("aria-label", "Add Subrow");
        el.setAttribute("data-action", "add-subrow");
        if (payload?.rowUid) el.dataset.rowUid = payload.rowUid;
        break;


      case "@table>trow>total":
        for (const p of payload) {
          // console.log({ payload })
          const title = document.createElement("div");
          title.className = "title"
          title.textContent = p.title;
          const value = document.createElement("div");
          value.className = "value"
          value.textContent = p.value;
          el.append(title, value);
        }
        break;
    }
  }

  // =========================================================================
  // Private Methods - Data Processing
  // =========================================================================

  private resolvePayload(data: TableData): DOMModel {
    // Calculate total columns
    this._totalColumns = this._countRenderedColumns();

    // Check if has subrow
    const hasSubRow = this._hasSubRows();

    // Create header model
    const headerModel = this._createHeaderDomModel(data.header!);

    // Create body model
    const bodyModel = this._createBodyDomModel(data.body!);

    // Create footer model
    const footerModel = this._createFooterDomModel(data.footer);

    this._insertMetadataRowUids(data);

    const domModel = {
      header: headerModel,
      body: bodyModel,
      footer: footerModel!,
    };


    // Step 4: Apply auto-numbering column insertion if configured.
    if (this.config.autoNumbering) {
      this._applyInsertionAutoNumbering(domModel);
    }

    // Step 5: Apply action buttons column insertion if configured.
    if (this.config.editable) {
      this._applyInsertionActionButtons(domModel);
    }

    // Step 6: Apply footer render total insertion if configured.
    if (this.config.footerOptions?.renderTotal) {
      this._applyInsertionFooterRenderTotal(domModel, this.config);
    }

    // Step 7: Apply row-total column insertion if sub-rows exist in the data.
    if (hasSubRow) {
      this._applyInsertionRowTotalColumns(domModel);
    }

    // Step 8: Apply pagination controls insertion if configured.
    if (this.config.pageSize) {
      this._applyInsertionPagination(domModel);
    }

    // Step 9: Recompute the total column count from the final header layout so that
    // freezing/stacking thresholds and downstream consumers always use the exact rendered width.
    this._totalColumns = this._countRenderedColumns(domModel);

    return domModel;
  }

  private _createHeaderDomModel(headerInput: any[]): TableRowModel[] {
    const headerOptions = this.config.headerOptions
    const normalized = (headerInput || []).map((h, i) => {
      if (h == null) return { text: "", options: {}, group: null, sourceIndex: i };
      if (h instanceof HTMLElement) return { text: h, options: {}, group: null, sourceIndex: i };
      if (typeof h === "object") {
        return { text: h.text ?? "", options: h.options ?? {}, group: h.group ?? null, sourceIndex: i };
      }
      return { text: String(h), options: {}, group: null, sourceIndex: i };
    });

    // Step 1: Normalize header input and detect if any groups are present.
    const hasGroup = normalized.some((n) => n.group != null);

    if (!hasGroup) {
      return [
        // Step 2: If no groups, create a single header row.
        {
          cells: normalized.map((cell) =>
            tcell(`col${cell.sourceIndex}`).value(cell.text).options(headerOptions, cell.options).create()
          ),
        },
      ];
    }

    // Step 3: If grouped headers exist, process them into two rows.
    const groups = [];
    for (const cell of normalized) {
      if (cell.group) {
        const last = groups[groups.length - 1];
        if (last && !last.isStandalone && last.name === cell.group) {
          last.span += 1;
          last.items.push(cell);
        } else {
          groups.push({ name: cell.group, span: 1, items: [cell], isStandalone: false });
        }
      } else {
        groups.push({ name: cell.text, span: 1, items: [cell], isStandalone: true });
      }
    }

    // Step 4: Initialize top and bottom rows for grouped headers.
    const topRow = { rowIndex: 0, cells: [] as TableCellModel[] };
    const bottomRow = { rowIndex: 1, cells: [] as TableCellModel[] };

    for (const g of groups) {
      // Step 5: Populate top and bottom rows based on group type (standalone or grouped).
      if (g.isStandalone) {
        const child = g.items[0];
        topRow.cells.push(
          tcell(`col${child.sourceIndex}`)
            .value(child.text)
            .rowspan("2")
            .options(headerOptions, child.options)
            .create()
        );
      } else {
        topRow.cells.push(
          tcell(`group-${g.name}-${topRow.cells.length}`)
            .value(g.name)
            .class("parent-title")
            .colspan(g.span)
            .options(headerOptions)
            .create()
        );
        g.items.forEach((child) => {
          bottomRow.cells.push(
            tcell(`col${child.sourceIndex}`)
              .value(child.text)
              .class("child-title")
              .options(headerOptions, child.options)
              .create()
          );
        });
      }
    }
    return [topRow, bottomRow];
  }

  private _createBodyDomModel(bodyInput: any[]): TableRowModel[] {
    // console.log("_createBodyDomModel > bodyInput:", bodyInput);
    const pageSize = this.config.pageSize;
    const bodyOptions = this.config.bodyOptions;
    const start = pageSize ? (this.currentPage - 1) * pageSize : 0;
    const end = pageSize ? Math.min(bodyInput.length, start + pageSize) : bodyInput.length;

    const body = [];
    this.pageRows = [];

    let displayIndex = 0;
    for (let i = 0; i < start; i++) {
      const raw = bodyInput[i];
      const isSubRow = raw && typeof raw === "object" && raw.subrowOfUid != null;
      if (!isSubRow) displayIndex += 1;
    }

    for (let i = start; i < end; i++) {
      // Step 1: Get the raw row data and determine if it's a sub-row.
      const raw = bodyInput[i];
      const isSubRow = raw && typeof raw === "object" && raw.subrowOfUid != null;
      const normalizedRow = isSubRow ? raw.data : raw;

      // Step 2: Ensure the raw row has a unique UID and store its data for the current page.
      if (!raw._uid) raw._uid = this._generateRowUID();
      const uid = raw._uid;

      this.pageRows.push(Array.isArray(normalizedRow) ? normalizedRow : []);

      const cells = [];
      const dataColsCount = Math.max(0, (this.data.header || []).length);

      // Step 3: Process each cell in the row.
      for (let ci = 0; ci < dataColsCount; ci++) {
        const rawCell = Array.isArray(normalizedRow) ? normalizedRow[ci] : undefined;
        const norm = __normalizeCell(rawCell);
        const headerTitle = typeof this.data.header?.[ci] === "string" ? this.data.header[ci] : (this.data.header?.[ci] as TableCellData).text; // <= this will be used to generate and calculate footer render total
        // Step 3a: Create a tcell object for the current cell.
        const model = tcell(`col${ci}`).header(headerTitle as string).value(norm.text).options({ ...(bodyOptions?.[ci] || {}), ...norm.options }).create();
        (model as any).proxy = normalizedRow[ci];
        (model as any).columnIndex = ci;

        cells.push(model);
        // apply calculation for the row using formula if defined
        if (bodyOptions && bodyOptions[ci] && bodyOptions[ci].formula) {
          __applyRowFormula(cells, ci, bodyOptions[ci].formula as string);
          // normalizedRow[ci] = cells[ci].value;
          const computedValue = cells[ci].value;
          if (normalizedRow[ci] !== computedValue) {
            // Menembak proxy setter HANYA jika nilainya berubah secara riil
            Reflect.set(normalizedRow, ci, computedValue);
          }
        }
      }

      const autoNumber = isSubRow ? 0 : ++displayIndex;

      // Step 4: Construct and add the BodyRowModel to the body array.
      body.push({
        autoNumber,
        rowIndex: i,
        uid: uid,
        parentUid: raw.subrowOfUid || null,
        cells,
        data: normalizedRow,
        rowOptions: isSubRow ? raw.rowOptions || {} : {},
      });
    }
    // Step 5: Return the array of BodyRowModel objects.
    // console.log({ body });
    return body;
  }



  private _createFooterDomModel(footerInput: any | TableCellData[]): TableRowModel[] | null {
    const { editable, pageSize, autoNumbering, footerOptions } = this.config;
    let footer = [];
    if (!footerInput && !footerOptions?.renderTotal && !editable && !pageSize) return null;

    let addButtonPlaced = false;

    // --- RenderTotal Row ---
    // Step 1: Check if renderTotal is configured.
    if (Array.isArray(footerOptions?.renderTotal)) {
      const row = { rowIndex: footer.length, cells: [] as TableCellModel[] };
      // `_totalColumns` already accounts for the "Row Total" column (when sub-rows exist),
      // so the render-total row is created with the full column count – no stale-flag adjustment.
      const footerColumns = this._totalColumns as number;
      // A "Row Total" column (inserted right after the formula column) has no dedicated sum cell
      // here: the formula column's grand-total cell spans across it (colspan 2), so no extra <th>
      // is left dangling in front of the add-row button column.
      const formulaIndex = this._getFormulaColumnIndex();
      const hasRowTotal = formulaIndex !== -1 && this._hasSubRows();

      // Step 1a: Fill the row with empty placeholders.
      for (let i = 0; i < footerColumns; i++) {
        row.cells.push(tcell("placeholder").value("").create());
      }

      footerOptions.renderTotal.forEach((title) => {
        const colIdx = __findColIndexByHeader(this.data.header!, title);
        if (colIdx !== -1) {
          const pos = (autoNumbering ? 1 : 0) + colIdx;
          const cell = tcell(`render-total-${title}`)
            .value(`${title.toUpperCase()}_PLACEHOLDER`)
            .create();
          if (hasRowTotal && colIdx === formulaIndex) {
            // The grand-total for the formula column doubles as the "Row Total" footer cell:
            // widen it over the row-total slot and drop that slot's placeholder.
            cell.options.colSpan = 2;
            row.cells.splice(pos + 1, 1);
          }
          row.cells[pos] = cell;
        }
      });

      if (editable) {
        // Step 1b: If editable, place an add button placeholder in the last column.
        // 👇 put the button placeholder always in the last obj in a row.cells
        row.cells[row.cells.length - 1] = tcell("add-button").value("ADD_BTN_PLACEHOLDER").create();
        addButtonPlaced = true;
      }

      footer.push(row);
    }

    // --- Data.footer Row ---
    // Step 2: Check if custom footer content is provided.
    if (footerInput) {
      // console.log("_createFooterDomModel > footerInput:", footerInput);
      const row = { rowIndex: footer.length, cells: [] as TableCellModel[] };
      // Step 2a: If footerInput is an array, fill cells directly; otherwise, create a single cell.
      // fill with placeholders first
      if (Array.isArray(footerInput) && footerInput.length > 0) {
        for (let i = 0; i < this._totalColumns!; i++) {
          row.cells.push(tcell(`data-footer-${i}`).value(footerInput[i]).create());
        }
      } else if (footerInput instanceof HTMLElement || typeof footerInput === "string") {
        row.cells[0] = tcell("data-footer").value(footerInput).valign("middle").colspan(this._totalColumns).create();
      }

      footer.push(row);
    }

    // --- Pagination Row ---
    // Step 3: Check if pagination is enabled.
    if (pageSize) {
      const row = { rowIndex: footer.length, cells: [] as TableCellModel[] };
      if (editable) {
        row.cells.push(
          // Step 3a: If editable, create a pagination placeholder spanning all but the last column.
          // The last column is always occupied by the add-button placeholder (`addButtonPlaced`)
          // or a plain placeholder pushed below, so subtracting exactly 1 keeps this row's width
          // equal to `_totalColumns` – regardless of whether sub-rows / a Row Total are rendered.
          tcell("pagination")
            .value("PAGINATION_PLACEHOLDER")
            .colspan((this._totalColumns as number) - 1)
            .create()
        );

        if (!addButtonPlaced) {
          // Step 3b: If add button not yet placed, add it.
          row.cells.push(tcell("add-button").value("ADD_BTN_PLACEHOLDER").create());
          addButtonPlaced = true;
        } else {
          // Step 3c: Otherwise, add an empty placeholder to maintain column count.
          row.cells.push(tcell("placeholder").value("").create());
        }
      } else {

        row.cells.push(tcell("pagination").value("PAGINATION_PLACEHOLDER").colspan(this._totalColumns).create());
      }
      footer.push(row);
    }

    // Step 4: Return the constructed footer rows.
    return footer;
  }


  // =========================================================================
  // Private Methods - Rendering
  // =========================================================================
  private _createGrandTotalColumnPayload(headerTitle: { title: string; colIndex: number }, config: TableConfig): any[] {

    const payload = [];

    const colIndex = headerTitle.colIndex - (config.autoNumbering ? 1 : 0);
    const sum = this.data.body!
      .map((r: any) => {
        const formula = config.bodyOptions?.[colIndex]?.formula as string;
        if (formula) {
          return __calculateRow(this.data.header!, __getRowData(r), colIndex, formula);
        } else {
          return __getRowData(r)[colIndex];
        }
      })
      .filter((v) => typeof v === "number")
      .reduce((a, b) => a + b, 0);

    payload.push({
      title: "Grand Total",
      value: __formatValue(sum, config.bodyOptions?.[colIndex] || {})
    })

    if (config.pageSize) {
      const pageVals = this.pageRows
        .map((r) => {
          if (r[colIndex]?.hasOwnProperty("text")) {
            return r[colIndex].text;
          } else {
            return r[colIndex];
          }
        })
        .filter((v) => typeof v === "number");

      const pageSum = pageVals.reduce((a, b) => a + b, 0);

      payload.push({
        title: `Page ${this.currentPage} Total`,
        value: __formatValue(pageSum, config.bodyOptions?.[colIndex] || {})
      })
    }
    this._isRowTotalRendered = true;
    // result[headerTitle.colIndex] = this.render("@table>trow>total", payload.reverse());

    return payload.reverse();
  }

  /**
   * Determine whether the current data contains any sub-rows.
   * Covers both the modern `subrowOfUid` reference and the legacy `subrowOf` numeric marker.
   */
  private _hasSubRows(): boolean {
    return (this.data?.body || []).some(
      (r) => r && typeof r === "object" && ((r as TableCellData).subrowOfUid != null || (r as TableCellData).subrowOf != null)
    );
  }

  /**
   * Determine whether a "Row Total" column will be rendered for the current data.
   * A Row Total column is inserted only when a body column has a `formula` AND sub-rows exist.
   * This is the live-data equivalent of `_isRowTotalRendered` (which is only set *after* the
   * column is inserted, so it is useless for pre-computing `_totalColumns`).
   */
  private _hasRowTotalColumn(): boolean {
    return this._getFormulaColumnIndex() !== -1 && this._hasSubRows();
  }

  /**
   * Index (within `bodyOptions`) of the column configured with a `formula`, or -1 if none.
   */
  private _getFormulaColumnIndex(): number {
    return (this.config.bodyOptions || []).findIndex((opt) => !!opt?.formula);
  }

  private _countRenderedColumns(domModel: DOMModel | null = null): number {
    if (domModel && domModel.header && domModel.header.length > 0) {
      // Step 1a: Get the first header row.
      const top = domModel.header[0];
      let count = 0;
      // Step 1b: Iterate through its cells and sum up their colspans.
      for (const cell of top.cells || []) {
        // Get colspan, defaulting to 1 if not specified.
        const cs = Number(cell.options?.colSpan ?? cell.options?.colSpan ?? 1);
        // Add the colspan to the total count.
        count += Math.max(1, cs);
      }
      // Return the calculated count from the DOM model.
      return count;
    }
    // Step 2: Fallback: compute from config + flags if no valid domModel is provided.
    const cfg = this.config;
    // Step 2a: Calculate the total columns by adding base header columns and optional columns.
    const headerCols = this.data?.header?.length || 0;
    // Return the calculated count based on configuration.
    return (cfg.autoNumbering ? 1 : 0) + headerCols + (this._hasRowTotalColumn() ? 1 : 0) + (cfg.editable ? 1 : 0);
  }

  private _openRowForEditByGlobalIndex(globalIndex: number): void {
    // Step 1: Attempt to find the table row (<tr>) corresponding to the globalIndex in the current tbody.
    const tr = this.tbody?.querySelector(`tr[data-global-index="${globalIndex}"]`);
    // Step 2: If the row is not found, it might be on a different page.
    if (!tr) {
      // Step 2a: If pagination is enabled, calculate the correct page for the row.
      if (this.config.pageSize) {
        const page = Math.floor(globalIndex / this.config.pageSize) + 1;

        if (page > this.currentPage) {
          this.switchPage(page)
        }
      }
    }
    // Step 3: After rendering (or if the row was already on the current page),
    // find the row again to ensure it's in the DOM.
    const tr2 = this.tbody?.querySelector(`tr[data-global-index="${globalIndex}"]`);
    if (tr2) {
      // Step 4: Find the edit button within the row and simulate a click to activate edit mode.
      const editBtn = tr2.querySelector("button.edit-btn");
      if (editBtn && editBtn instanceof HTMLButtonElement) editBtn.click();
      if (tr2 && tr2 instanceof HTMLTableRowElement) {
        // Step 5: Find the 1st cell and set to focus().
        const firstCell = tr2.cells.item(0);
        if (firstCell && firstCell instanceof HTMLTableCellElement) firstCell.focus();
      }
    }
  }

  private _insertMetadataRowUids(data: TableData) {
    for (let i = 0; i < data.body!.length; i++) {
      const row = data.body?.[i];

      // Parent is an Array (normal row)
      if (Array.isArray(row)) {
        // if (!row._uid) row._uid = this._generateRowUID();
        continue;
      }

      // Subrow is an object { subrowOf: <index | uid>, data: [...] }
      // give subrow itself a uid (useful to track editing)
      if (!(row as TableCellData)?._uid) (row as TableCellData)._uid = this._generateRowUID();
      if (row && typeof row === "object") {
        // console.log("_insertMetadataRowUids > row:", row);
        // If legacy numeric `subrowOf` exists, convert to `subrowOfUid`
        if ((row as any).subrowOf != null && row.subrowOfUid == null) {
          const parentIndex = Number((row as any).subrowOf);
          const parent = data.body?.[parentIndex];
          if (parent) {
            // parent may be an Array (normal parent) or object — ensure it has _uid
            if (!(parent as TableCellData)._uid) (parent as TableCellData)._uid = this._generateRowUID();
            row.subrowOfUid = (parent as TableCellData)._uid;
          } else {
            // fallback: treat as uid string if not found
            row.subrowOfUid = String((row as TableCellData).subrowOf);
          }
        }

        // If user already passed subrowOfUid directly, keep it.
      }
    }
  }

  private _applyInsertionAutoNumbering(domModel: DOMModel): void {
    const key = "autoNumber";
    // Step 1: Determine the label for the auto-numbering column.
    const label = typeof this.config.autoNumbering === "string" ? this.config.autoNumbering : "#";

    // --- Header ---
    // Step 2: Iterate through header rows to insert the auto-numbering cell.
    domModel.header.forEach((row, rowIndex) => {
      // Step 2a: For the first header row, insert the auto-numbering cell.
      // This cell will span all header rows if there are multiple.
      if (rowIndex === 0) {
        row.cells.unshift(
          tcell(key)
            .value(label)
            .rowspan(domModel.header.length) // rowSpan size is the header rows length itself
            .align("center")
            .options(this.config.headerOptions)
            .create()
        );
      }
    });

    // --- Body ---
    domModel.body.forEach((row, _idx) => {
      // numbering only for main rows (subrows covered by rowspan)
      const isSubRow = !!row.parentUid;
      if (!isSubRow) {
        row.cells.unshift(
          tcell(key)
            .value(row[key]) // use metaUid build in bodyDomModel as number
            .class(key) // Add class for styling
            .align("center")
            .create()
        );
      } else {
        // subrows get placeholder (so column count matches)
        row.cells.unshift(tcell(key).value("•").align("right").create());
      }
    });

    // --- Footer ---
    // Step 3: No direct modification to the footer is needed here, as its structure
    // is handled by other insertion methods or its initial creation.
  }

  private _applyInsertionActionButtons(domModel: DOMModel): void {
    // Step 1: Get configuration and determine the label for the "Actions" column.
    const cfg = this.config;
    const label = typeof cfg.editable === "string" ? cfg.editable : "Actions";

    // ---------- HEADER ----------
    // Step 2: Handle header insertion based on the number of header rows.
    const key = label.toLowerCase();
    const headerRows = domModel.header || [];
    if (headerRows.length === 0) {
      // Step 2a: If no header rows exist, create a single header row with the "Actions" cell.
      domModel.header = [
        {
          rowIndex: 0,
          cells: [tcell(key).value(label).align("center").options(cfg.headerOptions).create()],
        },
      ];
    } else if (headerRows.length === 1) {
      // Step 2b: If a single header row exists, append the "Actions" cell to it.
      headerRows[0].cells.push(tcell(key).value(label).align("center").options(cfg.headerOptions).create());
    } else {
      // Step 2c: If grouped headers exist, insert the "Actions" cell into the top row, spanning both.
      headerRows[0].cells.push(tcell(key).value(label).rowspan(2).align("center").options(cfg.headerOptions).create());
      // bottom row needs no action cell because top spans both rows
    }

    // ---------- BODY ----------
    // Step 3: Append action button cells for each body row.
    // Append actions placeholder cell for each body row model
    (domModel.body || []).forEach((rowModel) => {
      // keep the same cell-object shape used elsewhere: key, value (null), options
      const rawRow = this.data.body![rowModel.rowIndex as number];
      const isSubRow = rawRow && typeof rawRow === "object" && rawRow.subrowOfUid != null;
      rowModel.cells.push(
        tcell(key)
          .value(this.render("@table>tbody>actions", { isSubRow: isSubRow || this.config.disableSubRow, ...rowModel }))
          .class("actions cell")
          .align(isSubRow ? "right" : "center")
          .create()
      );
    });

    // ---------- FOOTER ----------
    // Step 4: Replace "add-button" placeholders in the footer with actual buttons.
    for (const row of domModel.footer) {
      const idx = row.cells.findIndex((c) => c.key === "add-button");
      if (idx >= 0) {
        row.cells[idx] =
          tcell("add-button")
            .value(this.render("@table>tfoot>add-row"))
            .create();
      }
    }
  }

  private _applyInsertionFooterRenderTotal(domModel: DOMModel, config: TableConfig): void {
    // Step 1: Check if renderTotal is configured and is an array. If not, return.
    if (!Array.isArray(config.footerOptions?.renderTotal) || config.footerOptions.renderTotal.length === 0) return;

    // Step 2: Iterate through each footer row in the DOM model.
    for (const row of domModel.footer) {
      // Step 3: Iterate through each cell in the current footer row.
      row.cells.forEach((c, idx) => {
        // Step 3a: Check if the cell's key indicates it's a render-total placeholder.
        if (c.key && c.key.startsWith("render-total-")) {
          // Step 3b: Extract the original column title from the placeholder key.
          const title = c.key.replace("render-total-", "");
          // Step 3c: Replace the placeholder cell with a new tcell containing the grand total HTML.
          // The `_createGrandTotalColumnPayload` method generates the formatted total content.

          row.cells[idx] = tcell(title)
            .value(this.render("@table>trow>total", this._createGrandTotalColumnPayload({ title, colIndex: idx }, this.config)))
            .class(`sum ${title}`)
            .options({ ...(c.options || {}) }) // preserve colSpan (e.g. the Row Total merge colspan 2)
            .create();
        }
      });
    }
  }

  private _applyInsertionPagination(domModel: DOMModel): void {
    // Step 1: Iterate through each footer row in the DOM model.
    for (const row of domModel.footer) {
      // Step 2: Find the index of the cell with the key "pagination".
      const idx = row.cells.findIndex((c) => c.key === "pagination");
      if (idx >= 0) {
        // Step 3: If a "pagination" placeholder is found, replace it with the actual controls.
        // The `_createPaginationControls()` method generates the HTML div for pagination.
        // Preserve the colspan from the original placeholder if it exists.
        row.cells[idx] = tcell("pagination")
          .value(this.render("@table>tfoot>pagination", this.data))
          .colspan(row.cells[idx].options?.colSpan || row.cells[idx].options?.colSpan || 1)
          .create();
      }
    }
  }

  private _applyInsertionRowTotalColumns(domModel: DOMModel): void {
    // Step 1: Get configuration and find the index of the column with a formula.
    const config = this.config;
    const formulaIndex = this._getFormulaColumnIndex();
    // If no formula column is found, there's nothing to total, so return.
    if (formulaIndex === -1) return; // no formula column, nothing to total
    // Step 2: Calculate the position where the "Row Total" column should be inserted.
    // This position is relative to the original data columns, adjusted for auto-numbering.
    const insertPos = (config.autoNumbering ? 1 : 0) + formulaIndex + 1;

    // ---------- HEADER ----------
    // Step 3: Insert the "Row Total" header cell.
    const headerRows = domModel.header || [];
    if (headerRows.length) {
      // Create a header cell object for "Row Total". It spans every header row so it is
      // visually connected to the "Row Total" body column regardless of header grouping.
      const headerCellObj = tcell("row-total")
        .value("Row Total")
        .class("row-total")
        .align("center")
        .rowspan(headerRows.length)
        .create();

      if (headerRows.length === 1) {
        // Single (non-grouped) header row: its cells mirror the body cells 1:1, so insert at
        // the same index the body uses. (`insertPos` already includes the auto-numbering offset
        // and lands the column right after the formula column – splicing at the bare
        // `formulaIndex` would skew every later column and break header/body alignment plus
        // the `data-col-index` numbering.)
        headerRows[0].cells.splice(insertPos, 0, headerCellObj);
      } else {
        // Grouped header: group titles live in the top row, per-column cells in the bottom row.
        const top = headerRows[0];
        const bottom = headerRows[headerRows.length - 1];
        const formulaGrid = (config.autoNumbering ? 1 : 0) + formulaIndex;

        // Walk the top-row cells grid-based (honoring colspans) to find the cell that covers
        // the formula column and whether that title extends past the new row-total slot.
        let grid = 0;
        let coveringIdx = -1;
        let coveringEnd = -1;
        for (let i = 0; i < top.cells.length; i++) {
          const span = top.cells[i].options?.colSpan || 1;
          if (coveringIdx === -1 && grid + span - 1 >= formulaGrid) {
            coveringIdx = i;
            coveringEnd = grid + span - 1;
          }
          grid += span;
        }

        if (coveringIdx !== -1 && coveringEnd >= insertPos) {
          // The group holding the formula column also covers the new row-total slot
          // (formula is followed by more members inside the same group). Widen that group
          // title by one so the row-total header can live in the bottom row beneath it.
          top.cells[coveringIdx].options.colSpan = (top.cells[coveringIdx].options.colSpan || 1) + 1;
          headerCellObj.options.rowSpan = 1;
          let hIdx = bottom.cells.findIndex((c) => c.key === `col${formulaIndex}`);
          if (hIdx === -1) hIdx = bottom.cells.findIndex((c) => (c as any).columnIndex === formulaIndex);
          hIdx = hIdx === -1 ? insertPos : hIdx + 1; // insert right AFTER the formula column
          bottom.cells.splice(hIdx, 0, headerCellObj);
        } else {
          // The formula column is the last member of its covering title: place the "Row Total"
          // header in the TOP row, right after that title, spanning all header rows.
          const insertIdx = coveringIdx === -1 ? top.cells.length : coveringIdx + 1;
          top.cells.splice(insertIdx, 0, headerCellObj);
        }
      }
    }

    // ------------- BODY --------------
    // We assume domModel.body is in same order as this.data.body for pages (rowIndex points to global index)
    const pageSize = config.pageSize as number;
    const currentPage = this.currentPage;
    const start = pageSize ? (currentPage - 1) * pageSize : 0;
    const end = pageSize ? Math.min(this.data.body!.length, start + pageSize) : this.data.body!.length;

    // Step 4: Iterate through each body row model to insert row total cells.
    for (const rowModel of domModel.body) {
      // Get the global index and raw row data.
      const gIdx = Number(rowModel.rowIndex);
      const rawRow = this.data.body![gIdx];
      // Determine if the current row is a sub-row.
      const isSubRow = rawRow && typeof rawRow === "object" && rawRow.subrowOfUid != null;
      // console.log(rawRow);
      // Row totals are only displayed for parent rows.
      if (!isSubRow) {
        // Step 4a: For parent rows, calculate the rowspan (1 for parent + visible sub-rows).
        const parentUid = (rawRow as any)._uid;
        const visibleSubs = __countVisibleSubRowsByUid(this.data.body as any[], parentUid, {
          pageSize,
          currentPage,
          start, // Pass start and end for pagination context
          end, // Pass start and end for pagination context
        });
        // Step 4b: Compute the total value for the parent and its sub-rows.
        const rowSpan = 1 + (visibleSubs || 0);
        const totalVal = __computeRowTotalValue(this.data.body as any[], gIdx, formulaIndex);

        // Create the "Row Total" cell with the calculated value, rowspan, and options.
        const totalCell = tcell("row-total")
          .value(totalVal)
          // .value(this.render("@table>trow>cell", { value: totalVal }))
          .class("row-total")
          .rowspan(rowSpan) // The rowspan ensures the total cell spans the parent and all its sub-rows.
          .align("center")
          .options(config.bodyOptions?.[formulaIndex])
          .create();
        // Step 4c: Insert the total cell into the parent row's cells array.
        rowModel.cells.splice(insertPos, 0, totalCell);
        // console.log({ totalCell })
      }
      // add empty cell in row-total column for orphan subrow for correct table alignment.
      const isOrphanSubRow = isSubRow && !domModel.body.some((rowModel) => rowModel.uid === rawRow.subrowOfUid);
      if (isOrphanSubRow) {
        const spacer = tcell("spacer").class("row-total spacer").value("").create();
        rowModel.cells.splice(insertPos, 0, spacer);
      }
    }

    this._isRowTotalRendered = true;
    // Step 5: Footer rows were already built spanning the full `_totalColumns` (which now already
    // includes this "Row Total" column), so no footer colspan adjustment is required here.
    // (Bumping `footer[0].cells[insertPos - 1].options.colSpan = 2` here used to create a phantom
    // extra column in the pagination row when `footer[0]` was the pagination row.)
  }

  private _applyFreezeColumns(table: HTMLTableElement) {
    const autoFreezeAt = this.config.autoFreezeAt;
    if (!this.config.renderAsCard && autoFreezeAt !== null) {
      requestAnimationFrame(() => {
        let currentLeft = 0;

        // Lakukan loop hingga indeks batas freeze yang ditentukan di konfigurasi
        for (let ci = 0; ci <= autoFreezeAt!; ci++) {
          // Cari semua cell (header dan body) yang memiliki indeks kolom ini
          const targetCells = table.querySelectorAll(`[data-col-index="${ci}"]`) as NodeListOf<HTMLElement>;

          if (targetCells.length === 0) continue;

          // Ambil lebar cell pertama (biasanya TH) untuk acuan kolom berikutnya
          const cellWidth = targetCells[0].offsetWidth || 100; // fallback 100px jika elemen belum di-render ke layar

          targetCells.forEach(cell => {
            const zIndex = cell.tagName === 'TH' ? '3' : '2';
            // Beri batas border tebal khusus di kolom batas terakhir freeze
            const borderWidth = ci === autoFreezeAt ? "3px" : "0px";
            cell.setAttribute("style", `--border-width: ${borderWidth}; --current-left: ${currentLeft}px; --z-index: ${zIndex};`.trim())
            !cell.classList.contains("sticky") ? cell.classList.add("sticky") : cell.classList.remove("sticky")
            // console.log(cell, currentLeft)
          });

          currentLeft += cellWidth;
        }
      });
    }
  }

  _applyKeydownHandler(e?: KeyboardEvent) {
    if (e?.key === 'ArrowRight') {
      // move to the previous column which has contenteditable = true
      e.preventDefault();
    }
    if (e?.key === 'ArrowLeft') {
      // move to the next column which has contenteditable = true
      e.preventDefault();
    }
    if (e?.key === 'Escape') {
      // set contenteditable=false to all column 
      e.preventDefault();
    }
    if (e?.key === 'Enter') {
      // new row / subrow, check first which one is activated
      e.preventDefault();
    }
    // dont forget to remove listener after editing complete or use {once:true}
  }

}
