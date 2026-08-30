export const GLOBAL_DISPLAY_LOG = false//"DATA"

export interface iRendererLite {
  create: () => void;
  append: () => void;
  remove: () => void;
  replace: () => void;
  text: () => void;
  html: () => void;
  attr: () => void;
  class: () => void;
}


// ==========================================
// Page
// ==========================================

export interface iLandingPageBuilderSource {
  menu?: HTMLElement | iBasicNode | null;
  footer?: HTMLElement | iBasicNode | null;
  pages: Record<string, iBasicNode[]>;
}

interface iComponentEvents<T extends string = string> {
  elementChanged: {
    builder?: keyof iBuilderRegistry;
    type?: T | string; // 💡 Tipe sub-organ menangkap token dinamis dari T secara kaku!
    element: HTMLElement | null;
    data?: any;
  };
  elementAdded: {
    builder?: keyof iBuilderRegistry;
    type?: T; // 💡 Tipe sub-organ menangkap token dinamis dari T secara kaku!
    element: HTMLElement;
    parent?: HTMLElement;
    data?: any;
  };
  elementRemoved: {
    element?: HTMLElement;
    builder?: keyof iBuilderRegistry;
    data?: any
  };
  themeChanged: { themeId: string; shell: HTMLElement };
  ready: { shell: HTMLElement; elements: Map<string, HTMLElement>, context?: any };
  error: { message: string; error: Error; context?: string };
}

export interface iPageEvents<T extends string = string> extends iComponentEvents<T> {
  beforeRender: {
    route: string;
    pages: any[]; // Sesuaikan dengan iBasicNode[] asli Anda di lokal
    menu: any | null;
    footer: any | null;
    pageMetaReport?: any;
  };
  pageChanged: { route: string; activeNodes?: HTMLElement[] };
}

// ==========================================
// BUILDER
// ==========================================

export type iBuilderSelectorsConfig<TType extends string = string> = Record<TType, iActionProperty>;

export interface iBuilderConfig<TType extends string = string> {
  themeId?: string;
  namespace?: string | null;
  selectors?: Partial<iBuilderSelectorsConfig<TType>>;
  emit?: (<K extends keyof iComponentEvents<TType>>(
    event: K,
    data: iComponentEvents<TType>[K]
  ) => void) | null;
}

export interface iBuilderElementContext<TType extends string = string, TData = any> {
  type: TType;
  element: HTMLElement;
  data: TData;
}

export interface iBuilderRegistry {
  carousel: iBuilderContent[];
  accordion: iHeaderProperty[];
  "pricing-card": iCardProperty[];
  masonry: iBuilderContent[];
  section: iBuilderContent[];
  form: Array<iBasicInputNode | iFormGroupNode | HTMLElement | string>;
  menu: iBasicNode;
  footer: iBasicNode;
  "fab-menu": iBasicNode;
  modal: iBasicNode | HTMLElement;
  "mode-switcher": iBasicNode;
  message: iBasicNode;
  rating: any;
  article: any;
  tab: any;
  input: iBasicInputNode;
  "product-card": iBasicNode;
  "product-card-grid": any;
  "input-controls": Array<iBasicInputNode>;
  table: any[];
  dropdown: iBasicInputNode;
  // Untuk komponen baru nanti, cukup daftarkan jenis array atomnya di sini:
  // stats: iStatsProperty[];
}

// Function signature constraint for allowed builders
export type ComponentBuilderFn<Args = any> = (content: Args) => HTMLElement | null;

// Registry map type contract tracking all active builder functions
export type BuilderFunctionsMap = {
  [K in keyof iBuilderRegistry]: ComponentBuilderFn<iBuilderRegistry[K]>;
};


/**
 * 
 */

export interface iMetadataContext {
  scopeId: string;         // Identitas wilayah domain pengenal (e.g. "home" atau "form-panel")
  parentKey: string | null; // Alamat penunjuk bapak sejati tempat elemen anak ini hinggap fisik
}

declare global {
  interface HTMLSelectElement {
    __nativeChangeHandler: (e: Event) => any;
  }
  interface HTMLElement {
    __outer: HTMLElement;
    __inner: HTMLElement;
    __payload: any;
    __index: number;
    __templateId: string;
    getMetadata: ((context: iMetadataContext) => any) | undefined | null;
    mount: (compositeOutput: iCompositeBuilderOutput | HTMLElement | null | any) => void;
  }
}

export interface iNodeRecords {
  records: iNodeRecordItem[]
}

export interface iNodeRecordItem<T = any> {
  key: string;
  element: HTMLElement,
  payload: T;
  relations?: iNodeRecordRelations;
  // proxy: any;
}

export interface iNodeRecordRelations {
  scope?: string;
  key?: string;
  template?: string;
  parent?: string | null; // "builderId:typeKey" milik bapak angkatnya
  children?: string[]     // Array [...builderId:typeKey] milik anak cucunya
}

export interface iCompositeBuilderOutput {
  element: HTMLElement;
  metadata: iNodeRecords;
}

/**
 * CONTRACT SPECIFICATION: Base Contract for all Architectural Themes.
 * Every theme MUST implement this interface to be recognized by the ThemeRenderer.
 */
export interface iThemeModule {
  readonly themeId: string;
  readonly name: string;

  /**
   * 🧙‍♂️ HOOK 1: STRUCTURAL MUTATION (Pre-Render Lifecycle)
   * Veto right to reconstruct the raw template objects BEFORE DOM synthesis.
   */
  beforePageRender?(
    pageBlocks: iBasicNode[],
    menuBlock: iBasicNode | null,
    footerBlock: iBasicNode | null,
    context?: Record<string, Function>
  ): {
    pages: iBasicNode[];
    menu: iBasicNode | null;
    footer: iBasicNode | null;
  };

  /**
   * ⚡ HOOK 2: BEHAVIORAL INTERACTION (Post-Render Lifecycle)
   * Triggered when the final elements tree is fully live on the DOM.
   */
  activate(shell: HTMLElement, elements: HTMLElement[], context: { setConfig: (builderName: keyof iBuilderRegistry, newConfig: Record<string, any>) => void; }): void;

  /**
   * 🛑 HOOK 3: MEMORY CLEANUP (Unmount Lifecycle)
   * MUST be used to unbind custom event listeners to eliminate memory leaks.
   */
  deactivate?(shell: HTMLElement): void;

  templates?(): Record<string, (typeKey: any, el: HTMLElement, payload: any, selector: any) => void>;
}


export type themeSwitcherPosition = "top-left" | "top-right" | "bottom-right" | "bottom-left";


export interface iElementProperty {
  id?: string;
  className?: string;
  tagName?: string;
  attrs?: Record<string, string>;
  isArray?: boolean;
  wrapper?: string;
  icon?: string;
}
// ==========================================
// 1. INDIVIDUAL ATOM PROPERTIES & DESIGN TOKENS
// ==========================================
export interface iHeaderProperty extends iElementProperty {
  title?: string;
  eyebrow?: string;
  description?: string;
}

export interface iActionProperty extends iElementProperty {
  label?: string;
  href?: string;
  src?: string;
  isActive?: boolean;
  isRoot?: boolean;
  icon?: string;
  type?: 'button' | 'submit' | 'reset' | InputType | InputControlsType;
  onClick?: (event: MouseEvent) => void;
}

// Data Item khusus untuk builder bertipe 'section', 'carousel', 'masonry'
export interface iBuilderContent extends iElementProperty {
  title?: string;
  description?: string;
  image?: string;
  actions?: iActionProperty[];
  category?: string;
}

// Data Item khusus untuk builder bertipe 'pricing-table'
export interface iCardProperty extends iElementProperty {
  header: string;
  body: { name: string; className: string }[];
  action?: iActionProperty;
}

// Skema untuk Form Builder
export interface iFormGroupNode {
  legend?: string;
  title?: string;
  description?: string;
  className?: string;
  submitButton?: boolean;
  group: Array<iBasicInputNode | HTMLElement | string>;
}

// =========================================
// 2. INPUT & FORM
// =========================================
export type InputType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "checkbox"
  | "radio"
  | "range"
  | "date"
  | "time"
  | "datetime-local"
  | "file"
  | "color"
  | "email"
  | "password"
  | "url"
  | "tel"
  | "hidden";

export type InputControlsType =
  | "add"
  | "remove"
  | "edit"
  | "save"

export interface InputBuilderSelectorOption {
  value?: string;
  label?: string;
  icon?: string;
}

export interface InputBuilderConfigOptions {
  attributes?: Array<{ name: string; value: string }>;
  style?: string;
  field?: string;
  className?: string;
  options?: Array<string | InputBuilderSelectorOption>;
  position?: "left" | "right";
  icon?: string;
  content?: string | Record<string, unknown>;
  action?: { mode?: string } | null;
  actionMode?: string;
  wide?: number | null;
  useLabel?: boolean;
  view?: string;
  thumbnail?: boolean;
  maxUpload?: number;
  maxFileSize?: number;
  groupUnallowed?: boolean;
  createEventListener?: boolean;
  display?: "block" | "inline";
}

export interface iBasicInputNode {
  type?: InputType;
  id?: string;
  name?: string;
  title?: string;
  placeholder?: string;
  value?: string | number | boolean;
  rows?: number;
  cols?: number;
  multiple?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  checked?: boolean;
  range?: string;
  info?: string;
  accept?: string;
  config?: Partial<InputBuilderConfigOptions>;
  [key: string]: unknown;
}

export interface iComponentMeta {
  active: boolean;
  container: string;       // Selector CSS unik tempat dia bersarang (misal: "div#carousel-container")
  count: number;           // Jumlah komponen sejenis di halaman tersebut
  instances: any[];        // Salinan referensi payload data internalnya
}

export interface iPageMetaReport {
  isArray: boolean;
  totalSections: number;
  hasComponent: {
    [K in keyof iBuilderRegistry]?: iComponentMeta;
  };
  // Tambahan info taktis: Daftar seluruh ID seksi dan label nama seksi untuk timeline
  timelinePaths: Array<{ id: string; name: string; type: string }>;
  graphRelationsBlueprint?: any
}



// ==========================================
// 3. BASE STRUCTURAL HOOKS INTERFACE
// ==========================================
export interface iNodeLifecycleHooks {
  onCreated?: (element: HTMLElement) => void;
  onDestroy?: (element: HTMLElement) => void;
}

// ==========================================
// 4. ADVANCED MODE PATTERNS (String Selectors)
// ==========================================
export type DefaultSelectors = 'grid' | 'row' | 'column' | string;
export type ValidLayoutKey<S extends string> = S | `${S}${string}`;

// Rantai Rekursif Advanced Mode untuk Elemen HTML Standar
export interface iAdvancedStandardNode<S extends string = DefaultSelectors> extends iNodeLifecycleHooks {
  builder?: never;
  attrs?: Record<string, string>;
  content?: string | HTMLElement | iNodeContent<S> | iNodeContent<S>[];
  [childKey: string]: any;
}

// Rantai Rekursif Advanced Mode untuk Builder Komponen Kompleks (Mendukung Penyatuan Content)
export type iAdvancedBuilderNode<S extends string = DefaultSelectors> = {
  [K in keyof iBuilderRegistry]: iNodeLifecycleHooks & {
    builder: K;
    content: iBuilderRegistry[K]; // Mengunci content secara otomatis menjadi array item dari registry komponen tersebut!
    attrs?: Record<string, string>;
    [childKey: string]: iNodeContent<S> | any;
  }
}[keyof iBuilderRegistry];

// Kombinasi Utama untuk Item Node di Advanced Mode
export type iLayoutItemNode<S extends string = DefaultSelectors> =
  | iAdvancedStandardNode<S>
  | iAdvancedBuilderNode<S>;

export type iDOMStructure<S extends string = DefaultSelectors> = {
  [K in ValidLayoutKey<S>]?: iLayoutItemNode<S> | any;
};

export type iNodeContent<S extends string = DefaultSelectors> = iDOMStructure<S>;


// ==========================================
// 5. BASIC MODE PATTERNS (JSON Style / Ramah Pemula)
// ==========================================

// Rantai Rekursif Basic Mode untuk Elemen HTML Standar + Custom Attributes Support
export interface iBasicStandardNode extends iNodeLifecycleHooks {
  tagName?: string;
  id?: string;
  className?: string;
  builder?: never;
  isRoot?: boolean;
  content?: string | HTMLElement | iBasicNode | iBasicNode[] | iActionProperty;
  // 💡 INTERNAL SYSTEM TRACKING: Metadata penanda form admin dashboard Anda
  _field?: string;

  [customHtmlAttr: string]: any;
}

// Rantai Rekursif Basic Mode untuk Builder Komponen Kompleks (Mendukung Penyatuan Content)
export type iBasicBuilderNode = {
  [K in keyof iBuilderRegistry]: iNodeLifecycleHooks & {
    tagName?: string;
    id?: string;
    className?: string;
    builder: K;
    isRoot?: boolean;
    content: iBuilderRegistry[K]; // Mengunci content secara otomatis menjadi array item dari registry komponen tersebut!
    [customHtmlAttr: string]: any;
  }
}[keyof iBuilderRegistry];

export type iBasicNode = iBasicStandardNode | iBasicBuilderNode;
