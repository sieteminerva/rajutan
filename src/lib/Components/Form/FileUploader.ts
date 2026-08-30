import { truncateText } from "../../Utility/helper";
import './FileUploader.css';

interface FileUploaderConfigMessages {
  selectedFiles: (count: number) => string;
  readyFiles: (count: number) => string;
  unAllowedFiles: (count: number) => string;
  tooMany: (limit: number) => string;
  tooLarge: (maxSize: string) => string;
  nearLimit: (warnSize: string) => string;
  notAccepted: (acceptablefileType: string) => string;
}

interface FileUploaderConfig {
  accept?: string[];
  input?: string;
  closeButton?: string;
  maxFileSize?: number;
  maxUpload?: number;
  warnFileSize?: number;
  view?: string;
  renderThumbnail?: boolean;
  renderDetails?: boolean;
  groupUnallowed?: boolean | string;
  messages?: FileUploaderConfigMessages;
}

interface FileValidationResult {
  allowed: boolean;
  unAllowedGroup?: boolean;
  message: string | null;
  name: string;
  notAccepted?: boolean;
  maxFileSize?: boolean;
  warning?: boolean;
}

interface FileValidationEntry {
  file: File;
  validation: FileValidationResult;
}

/**
 * @class
 * @classdesc
 *  A robust file upload manager that handles file selection, validation, and UI rendering.
 *
 * This class provides a comprehensive solution for managing file inputs, including:
 * - Drag-and-drop support.
 * - Real-time validation (file size, MIME types, upload limits).
 * - Customizable UI views (thumbnails or list).
 * - Automatic integration with Google Apps Script (via binary byte-stream conversion).
 * - Support for multiple instances on a single page.
 */
export class FileUploader {
  private static _configDefaults?: FileUploaderConfig;

  private input: HTMLInputElement | null = null;
  private container: HTMLElement | null = null;
  private viewContainer: HTMLDivElement | null = null;
  private uploadInfo: HTMLDivElement | null = null;
  private filesToUpload: File[] = [];
  private _selectedFiles: File[] = [];
  private unAllowedFiles: Array<FileValidationResult & { file: File; name: string }> = [];
  private _config: FileUploaderConfig = {};

  /**
   * @typedef {Object} FileUploaderConfigMessages
   * @property {function(number): string} selectedFiles - Message for selected files count.
   * @property {function(number): string} readyFiles - Message for files ready to upload count.
   * @property {function(number): string} unAllowedFiles - Message for unallowed files count.
   * @property {function(number): string} tooMany - Message when too many files are selected.
   * @property {function(string): string} tooLarge - Message when a file exceeds max size.
   * @property {function(string): string} nearLimit - Message when a file is near max size.
   * @property {function(string): string} notAccepted - Message when a file type is not accepted.
   */

  /**
   * @typedef {Object} FileUploaderConfig
   * @property {string[]} [accept=["image/*", ".pdf"]] - Accepted file types/extensions.
   * @property {string} [input='input[type="file"][data-uploader]'] - Selector for file input elements.
   * @property {string} [closeButton=".close.icon"] - Selector for close button.
   * @property {number} [maxFileSize=5242880] - Maximum file size in bytes (default 5MB).
   * @property {number} [maxUpload=10] - Maximum number of files allowed to upload.
   * @property {number} [warnFileSize=2097152] - File size in bytes to trigger a warning (default 2MB).
   * @property {"thumbnails"|"list"|string} [view="thumbnails"] - Display mode for selected files.
   * @property {boolean} [renderThumbnail=true] - Whether to render image thumbnails.
   * @property {string|boolean} [groupUnallowed=true] - Whether to group unallowed files in the display.
   * @property {FileUploaderConfigMessages} [messages] - Custom messages for various scenarios.
   */
  /**
   *
   * @description
   * Initializes a new FileUploader instance for a given file input element.
   * It prevents multiple instances on the same input and sets up drag-and-drop functionality,
   * file selection change listeners, and configuration based on defaults, provided config,
   * and data attributes on the input element.
   *
   * @example
   * // Initialize a file uploader on an input with data-uploader attribute
   * const inputElement = document.querySelector('input[type="file"][data-uploader]');
   * const uploader = new FileUploader(inputElement, {
   *   maxUpload: 5,
   *   accept: ["image/png", ".jpg"],
   *   view: "list"
   * });
   *
   * @example
   * // Access static methods
   * FileUploader.initAll(); // Initializes all uploaders on the page
   * const files = FileUploader.getFiles("myFormId"); // Get files from a form
   *
   * @param {HTMLInputElement} input - The file input element to attach the uploader to.
   * @param {FileUploaderConfig} [config={}] - Configuration options for the uploader.
   * @throws {Error} (Implicit) If `input` is not a valid HTMLInputElement or its `closest('.field')` fails.
   *
   * @summary
   * 1. **Instance Check**: Prevents re-initialization if an instance already exists on the input.
   * 2. **DOM References**: Stores references to the input and its closest field container.
   * 3. **Config Merging**: Merges default, provided, and data-attribute configurations.
   * 4. **UI Setup**: Creates a `viewContainer` for displaying file previews.
   * 5. **State Initialization**: Sets up arrays for `filesToUpload`, `_selectedFiles`, and `unAllowedFiles`.
   * 6. **Event Listeners**: Attaches `change` and drag-and-drop listeners.
   * 7. **Form Reset Listener**: Adds a global reset listener to the parent form if not already bound.
   * 8. **Instance Storage**: Stores the instance on the input element for future reference.
   */
  constructor(input: HTMLInputElement, config: Partial<FileUploaderConfig> = {}) {
    // Step 1: Prevent re-initialization if an instance already exists on this input.
    // @ts-ignore
    if (input._uploaderInstance) return input._uploaderInstance;

    // Step 2: Store references to the input element and its closest parent with class 'field'.
    this.input = input;
    this.input.title = "You can select or drop the files here to upload.";
    this.container = input.closest(".field") as HTMLElement | null;

    // Attribute-based config overrides
    // Step 3: Parse 'accept' attribute from DOM, splitting by comma and cleaning up.
    const domAccept = (input.getAttribute("accept") || "")
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);
    const configAccept = Array.isArray(config.accept) && config.accept.length > 0 ? config.accept.map((s) => s.trim()).filter(Boolean) : undefined;
    const defaultAccept = Array.isArray(this.config.accept) && this.config.accept.length > 0 ? this.config.accept.map((s) => s.trim()).filter(Boolean) : undefined;

    const resolvedMaxUpload = Number(input.dataset.maxUpload) || config.maxUpload || this.config.maxUpload;
    const resolvedAccept = configAccept ?? (domAccept.length > 0 ? domAccept : defaultAccept ?? ["image/*", ".pdf"]);

    // Step 4: Merge configurations: static defaults, provided config, and data attributes.
    // Data attributes take precedence over provided config, which takes precedence over static defaults.
    this._config = {
      ...this.config,
      ...config,
      maxUpload: resolvedMaxUpload,
      maxFileSize: Number(input.dataset.maxFileSize) * 1024 * 1024 || config.maxFileSize || this.config.maxFileSize,
      warnFileSize: Number(input.dataset.warnFileSize) * 1024 * 1024 || config.warnFileSize || this.config.warnFileSize,
      groupUnallowed: input.dataset.groupUnallowed ?? config.groupUnallowed ?? this.config.groupUnallowed,
      view: input.dataset.view || config.view || this.config.view,
      accept: resolvedAccept,
      renderThumbnail:
        input.dataset.thumbnail !== undefined
          ? input.dataset.thumbnail !== "false"
          : (config.renderThumbnail ?? this.config.renderThumbnail ?? true),
    };

    this._syncInputAttributes();

    // console.log({ cfg: this._config, domAccept, config })

    // Step 5: Create a container element for displaying file previews and append it to the input's field container.
    this.viewContainer = document.createElement("div");
    this.viewContainer.className = "file hidden";
    if (this.container && this.viewContainer) {
      this.container.append(this.viewContainer);
    }
    this.uploadInfo = null;

    // Step 6: Initialize arrays to manage file states.
    this.filesToUpload = [];
    this._selectedFiles = [];
    this.unAllowedFiles = [];

    // Step 7: Attach event listeners for file selection and drag-and-drop.
    this._onSelectionChange();
    this._onDragNdrop();

    // Step 8: Find the closest parent form and attach a reset listener if not already bound.
    const form = this.input.closest("form");
    if (form && !form.dataset.uploaderResetBound && form instanceof HTMLFormElement) {
      form.addEventListener("reset", () => FileUploader.reset(form));
      form.dataset.uploaderResetBound = "true";
    }

    // Step 9: Store the current FileUploader instance on the input element for future reference.
    // @ts-ignore
    input._uploaderInstance = this;
  }

  /**
   * @private
   *
   * @description
   * Attaches an event listener to the file input element to handle file selections.
   * When files are selected (or changed), it converts the FileList to an array and
   * passes them to the `handleFiles` method for processing.
   *
   * @returns {void}
   *
   * @example
   * // This method is called internally by the constructor.
   * // It listens for the 'change' event on `this.input`.
   *
   * @summary
   * 1. **Event Listener**: Adds a 'change' event listener to `this.input`.
   * 2. **File Extraction**: When the event fires, it extracts the selected files from `e.target.files`.
   * 3. **File Handling**: Converts the `FileList` to an array and calls `this.handleFiles` with the new files.
   */
  _onSelectionChange() {
    if (!this.input) return;

    // Step 1: Add an event listener for the 'change' event on the input element.
    this.input.addEventListener("change", (e: Event) => {
      const target = e.target as HTMLInputElement | null;
      const files = Array.from(target?.files ?? []);
      // Event change sudah menjadi sumber pemrosesan, jadi jangan emit change lagi.
      this.handleFiles(files as File[], false);

    });
  }



  /**
   * @private
   *
   * @description
   * Attaches event listeners for drag-and-drop functionality to the file input's container.
   * It handles `dragover`, `dragleave`, and `drop` events to allow users to drag files
   * onto the input area, visually indicating the drag state and processing the dropped files.
   *
   * @returns {void}
   *
   * @summary
   * 1. **Drag Over**: Adds a `dragover` event listener to prevent default to allow dropping,
   *    and adds a `dragover` class to the container for visual feedback.
   * 2. **Drag Leave**: Removes the `dragover` class when a file is dragged out of the container.
   * 3. **Drop**: Prevents default on `drop`, removes the `dragover` class,
   *    extracts files from the `dataTransfer` object, and calls `this.handleFiles` to process them.
   */
  _onDragNdrop() {
    // console.log(this.container)
    if (!this.container) return;

    this.container.addEventListener("dragover", (e: DragEvent) => {
      e.preventDefault();
      this.container?.classList.add("dragover");
    });

    this.container.addEventListener("dragleave", (_e: DragEvent) => {
      this.container?.classList.remove("dragover");
    });

    this.container.addEventListener("drop", (e: DragEvent) => {
      e.preventDefault();
      this.container?.classList.remove("dragover");
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (!files.length || !this.input) return;
      this.handleFiles(files);
    });
  }



  /**
   * @private
   *
   *
   * @description
   * Attaches a click event listener to a close icon associated with a file item in the UI.
   * When clicked, it removes the visual representation of the file, updates the internal
   * `_selectedFiles` array, and re-processes the remaining files to ensure the UI and
   * internal state are consistent. If no files remain, it clears the entire view.
   *
   * @param {File} file - The File object corresponding to the item being removed.
   * @param {HTMLElement} closeIcon - The DOM element (e.g., an icon or button) that triggers the removal.
   * @param {HTMLElement} wrapper - The DOM element that visually represents the file item (e.g., a div containing the thumbnail and info).
   * @returns {void}
   *
   * @example
   * // This method is called internally when rendering file items.
   * // `this._onCloseRemoveItem(fileObject, closeButtonElement, fileItemWrapperElement);`
   *
   * @summary
   * 1. **Event Listener**: Attaches a 'click' listener to the `closeIcon`.
   * 2. **UI Removal**: Removes the `wrapper` element from the DOM.
   * 3. **State Update**: Filters `_selectedFiles` to remove the specified `file`.
   * 4. **Conditional Clear/Re-process**: If no files remain, calls `clearView(true)`. Otherwise, calls `handleFiles([])` to re-evaluate and re-render the current `_selectedFiles`.
   */
  _onCloseRemoveItem(file: File, closeIcon: HTMLElement, wrapper: HTMLElement) {
    closeIcon.addEventListener("click", () => {
      wrapper.remove();

      this._selectedFiles = this._selectedFiles.filter((f) => f.name !== file.name);

      if (this._selectedFiles.length === 0) {
        this.clearView(true, true); // also clears input + state and notifies input listeners
        return;
      }
      // Re-run handleFiles so state + UI update consistently
      // Perubahan berasal dari UI uploader, jadi informasikan juga listener input.
      this.handleFiles([], true);
    });
  }

  /**
   *
   * @param {File[]} newFiles - An array of new File objects to be added and processed.
   *
   * @description
   * Processes a new set of files, merging them with already selected files,
   * validating them against configured rules (max size, accepted types, max upload count),
   * and then updating the UI to reflect the current state of allowed and unallowed files.
   * It ensures that the native file input's `files` property is updated to only contain
   * the files that are deemed "allowed" for upload.
   *
   * @example
   * // Called when files are selected via input change or drag-and-drop.
   * // `uploader.handleFiles(e.target.files);`
   *
   * @returns {void}
   *
   * @summary
   * 1. **File Key Generation**: Defines a unique key for each file based on name, size, and last modified date.
   * 2. **Merge New Files**: If `newFiles` are provided, it merges them into `_selectedFiles`, avoiding duplicates.
   * 3. **Reset Partitions**: Clears `filesToUpload` and `unAllowedFiles` for a fresh evaluation.
   * 4. **Initial Validation**: Runs `runValidation` on all `_selectedFiles` to get base validation results, without considering `maxUpload` yet.
   * 5. **Select Allowed Files (up to maxUpload)**: Filters for initially allowed files and selects a subset based on `maxUpload` limit.
   * 6. **Final Validation Pass**: Re-evaluates all `_selectedFiles` against the `maxUpload` limit, demoting files that were initially allowed but exceed the limit.
   * 7. **Sort Files**: Sorts the files based on their validation status (allowed first, then warnings, then hard failures).
   * 8. **Update Partitions**: Populates `filesToUpload` and `unAllowedFiles` based on the final sorted validations.
   * 9. **Update Native FileList**: Attempts to update the native `input.files` property with only the `filesToUpload`.
   * 10. **Render View**: Calls `renderView` to update the UI with the processed files.
   */
  handleFiles(newFiles: File[], emitChange = true): void {
    // Step 1: Define a helper function to create a unique key for each file.
    const fileKey = (file: File) => `${file.name}|${file.size}|${file.lastModified || 0}`;
    const allowsMultiple = this.input?.multiple ?? false;
    const maxUpload = this.config.maxUpload ?? Infinity;
    // file not selected as allowed
    // merge step (if newFiles provided)
    // Step 2: If new files are provided, merge them into _selectedFiles, avoiding duplicates.
    if (Array.isArray(newFiles) && newFiles.length > 0) {
      const incomingFiles = allowsMultiple && maxUpload > 1 ? newFiles : [newFiles[0]];

      if (!allowsMultiple || maxUpload <= 1) {
        this._selectedFiles = incomingFiles.filter(Boolean);
      } else {
        const existing = new Set(this._selectedFiles.map((f) => fileKey(f)));
        for (const f of incomingFiles) {
          const k = fileKey(f);
          if (!existing.has(k)) {
            this._selectedFiles.push(f);
            existing.add(k);
          }
        }
      }
    }

    // Step 3: Reset the arrays that will hold files categorized for upload or as unallowed.
    this.filesToUpload.length = 0;
    this.unAllowedFiles.length = 0;

    // Step 4: Determine the maximum number of files allowed for upload.
    const max = this.config.maxUpload ?? Infinity;

    // run base validation (skip maxUpload grouping here by omitting index in runValidation)
    // Step 5: Run initial validation on all selected files without considering the maxUpload limit yet.
    const entries = this._selectedFiles.map((file: File, idx: number) => {
      // No index is passed to runValidation, so it won't apply the maxUpload check at this stage.
      const base = this.runValidation(file, undefined); // no index => skip grouped check inside runValidation
      return { file, base, originalIndex: idx };
    });

    // collect allowed candidates (base.allowed === true)
    // Step 6: Filter for files that passed the initial validation (allowed candidates).
    const allowedCandidates = entries.filter((e: { file: File; base: FileValidationResult; originalIndex: number }) => e.base.allowed === true);

    // choose earliest allowed up to max
    // Step 7: Select the first 'max' allowed files to be uploaded.
    const chosenAllowed = allowedCandidates.slice(0, max).map((e: { file: File; base: FileValidationResult; originalIndex: number }) => e.file);
    const chosenAllowedSet = new Set(chosenAllowed.map((f: File) => fileKey(f)));

    // build final validations in original order
    // Step 8: Create the final validation results for all files, now incorporating the maxUpload limit.
    const final = entries.map((e: { file: File; base: FileValidationResult; originalIndex: number }) => {
      const { file, base } = e;
      const key = fileKey(file);

      if (chosenAllowedSet.has(key)) {
        // allowed and selected for upload
        // Step 8a: If the file was chosen for upload, mark it as allowed and not part of an unallowed group.
        const v = { ...base, allowed: true, unAllowedGroup: false };
        return { file, validation: v };
      }

      // file not selected as allowed
      if (!base.allowed) {
        // original blocked reason (notAccepted / tooLarge / warning)
        // Step 8b: If the file was initially unallowed for other reasons (e.g., type, size), keep that status.
        const v = { ...base, allowed: false };
        return { file, validation: v };
      }

      // was allowed but beyond max -> demote to unAllowedGroup
      // Step 8c: If the file was initially allowed but exceeded the maxUpload limit, demote it to an unallowed group.
      const messages = this.config.messages ?? FileUploader.config.messages;
      const v = {
        ...base,
        allowed: false,
        unAllowedGroup: true,
        message: messages?.tooMany(max) ?? null,
      };
      return { file, validation: v };
    });

    // sort final validations so allowed come first, generic unallowed next, and hard fails (notAccepted / unAllowedGroup / tooLarge) last
    // Step 9: Define a weighting function to sort files based on their validation status.
    const weight = (v: FileValidationResult) => {
      if (v.allowed) return 0;
      if (v.notAccepted || v.unAllowedGroup || v.maxFileSize) return 2;
      return 1; // other unallowed/warning
    };

    const stable = final.map((item, i) => ({ item, i }));
    // Step 10: Sort the files using the weighting function, preserving original order for files with the same weight.
    stable.sort((a, b) => {
      const wa = weight(a.item.validation);
      const wb = weight(b.item.validation);
      if (wa !== wb) return wa - wb;
      return a.i - b.i; // preserve original order within same weight
    });
    // Step 11: Extract the sorted items.
    const sorted = stable.map((s) => s.item);

    // update partitions
    // Step 12: Populate filesToUpload with files that are finally allowed.
    this.filesToUpload = sorted.filter((v) => v.validation.allowed).map((v) => v.file);
    // Step 13: Populate unAllowedFiles with files that are not allowed, including their validation details.
    this.unAllowedFiles = sorted
      .filter((v) => !v.validation.allowed)
      .map((v) => {
        const { name: _ignoredName, ...validation } = v.validation;
        return { name: v.file.name, file: v.file, ...validation };
      });

    // rebuild native FileList with only filesToUpload (these will be submitted)
    // Step 14: Attempt to update the native input's FileList with only the files that are allowed for upload.
    try {
      const dt = new DataTransfer();
      this.filesToUpload.forEach((f) => dt.items.add(f));
      if (this.input) {
        this.input.files = dt.files;
        if (emitChange) {
          this.input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    } catch (err) {
      // fail silently if environment forbids programmatic assignment
      console.warn("Could not set input.files programmatically:", err);
    }

    // Step 15: Render the updated view based on the final validation results.
    this.renderView(final);
  }

  /**
   *
   * @param {Object[]} validations - An array of objects, each containing a `File` object and its `validation` result.
   *
   * @description
   * Renders the visual representation of the selected files (both allowed and unallowed)
   * based on the configured `view` mode ("list" or "thumbnails"). It first clears
   * any existing view and then calls the appropriate build method (`_buildListView` or `_buildThumbnailsView`).
   * Finally, it updates the upload information summary.
   *
   * @returns {void}
   *
   * @example
   * // Called internally by `handleFiles` after file processing.
   * // `this.renderView(finalValidationResults);`
   *
   * @summary
   * 1. **Reset UI**: Clears the `viewContainer`'s content and class, then adds the appropriate view class and removes 'hidden'.
   * 2. **Conditional Build**: Calls `_buildListView` if `config.view` is "list", otherwise calls `_buildThumbnailsView`.
   * 3. **Update Info**: Calls `updateUploadInfo` to display a summary of selected and allowed files.
   */
  renderView(validations: FileValidationEntry[]) {
    if (!this.viewContainer) return;
    // Build view based on validations (merge allowed + unallowed for rendering
    // Reset UI only (not state)
    this.viewContainer.className = `file${this.config.view === "list" ? " list" : " thumbnails"} hidden`;
    this.viewContainer.replaceChildren();
    this.viewContainer.classList.remove("hidden");

    if (!validations.length) {
      this.viewContainer.replaceChildren()
      this.viewContainer.classList.add("hidden");
      // console.log(this.viewContainer)
      return;
    }

    // console.log({ validations, filesToUpload: this.filesToUpload, unAllowedFiles: this.unAllowedFiles });

    if (this.config.view === "list") {
      this._buildListView(validations);
    } else {
      this._buildThumbnailsView(validations);
    }

    this.updateUploadInfo(this._selectedFiles.length, this.filesToUpload.length);
  }

  /**
   * @private
   *
   *
   * @description
   * Removes the file uploader and cleans up all associated event listeners and DOM elements.
   * This method should be called when the file uploader is no longer needed to prevent memory leaks.
   *
   * @returns {void}
   *
   * @summary
   * 1. **Remove Element**: Removes the main `container` element from the DOM.
   * 2. **Clean State**: Resets the `input`, `container`, `viewContainer`, `uploadInfo`, and file arrays.
   * 3. **Event Cleanup**: Removes all event listeners attached to the input and its container.
   *
   * @example
   * // Call this method when you want to remove the file uploader.
   * // `uploaderInstance.destroy();`
   */
  destroy() {
    // 1. Remove the main container element from the DOM.
    if (this.container && this.container.parentNode) {
      this.container.remove();
    }

    // 2. Clean up the input element's internal reference.
    if (this.input) {
      // @ts-ignore
      delete this.input._uploaderInstance;
    }

    // 3. Reset all internal state properties to prevent memory leaks.
    this.input = null;
    this.container = null;
    this.viewContainer = null;
    this.uploadInfo = null;
    this.filesToUpload = [];
    this._selectedFiles = [];
    this.unAllowedFiles = [];

    // 4. Remove all event listeners from the input and container.
    // Note: This requires us to store references to the listener functions,
    // which we haven't explicitly done in the current implementation.
    // A more robust solution would be to store references to the added listeners
    // in the instance and use `removeEventListener`.
    // For now, we'll clear the DOM elements which helps GC, but explicit
    // `removeEventListener` calls would be ideal for a production-grade destroy method.
  }

  /**
   * @private
   *
   * @param {Object[]} validations - An array of objects, each containing a `File` object and its `validation` result.
   *
   * @description
   * Builds and appends the list-style view for files to the `viewContainer`.
   * Each file is represented as an `item` with a thumbnail (if enabled), content (message),
   * file size, and a close button. It also handles grouping of unallowed files if configured.
   *
   * @returns {void}
   *
   * @example
   * // Called internally by `renderView` when `config.view` is "list".
   * // `this._buildListView(validations);`
   *
   * @summary
   * 1. **Initialize Counter**: Sets `countMSNA` to track files unallowed due to max size or non-acceptance.
   * 2. **Iterate Validations**: Loops through each file and its validation result.
   * 3. **Skip Grouped Unallowed**: If `groupUnallowed` is true and the file is part of an `unAllowedGroup` (exceeded max upload count), it skips rendering the individual item.
   * 4. **Count Max Size/Not Accepted**: Increments `countMSNA` for files unallowed due to size or type, if `groupUnallowed` is active.
   * 5. **Create Item Elements**: Creates `div.item`, `div.content`, `div.label.filesize`, and `div.close.button` for each file.
   * 6. **Thumbnail**: Creates and appends a thumbnail if `renderThumbnail` is true.
   * 7. **Message**: Appends the file message (name, status, validation message).
   * 8. **File Size**: Displays the formatted file size and adds 'unallowed' class if applicable.
   * 9. **Close Button**: Creates a close button and attaches `_onCloseRemoveItem` listener.
   * 10. **Append to View**: Appends all created elements to the `item`, then appends the `item` to `viewContainer`.
   * 11. **Grouped Summary**: If `groupUnallowed` is true and there are files exceeding the max upload limit, it creates and appends a summary item for them.
   */
  _buildListView(validations: FileValidationEntry[]) {
    const viewContainer = this.viewContainer;
    if (!viewContainer) return;

    // Step 1: Initialize a counter for files unallowed due to maxFileSize or notAccepted reasons.
    let countMSNA = 0; //maxFileSize and notAccepted
    validations.forEach(({ file, validation }: FileValidationEntry) => {
      if (this.config.groupUnallowed && validation.unAllowedGroup) return; // skip grouped count-limit files
      if ((this.config.groupUnallowed && validation.maxFileSize) || (this.config.groupUnallowed && validation.notAccepted)) {
        countMSNA++;
      }
      const item = document.createElement("div");
      // Step 2: Create the main item container for the file.
      item.classList.add("item");

      // Step 3: Create a thumbnail if renderThumbnail is enabled.
      const thumb = this.config.renderThumbnail ? this.createImageThumbnail(file) : null;

      const content = document.createElement("div");
      // Step 4: Create the content area for the file's message.
      content.classList.add("content");
      // Step 5: Append the file message (name, status, validation message) to the content area.
      content.appendChild(this.createMessage(file, validation));

      const size = document.createElement("div");
      // Step 6: Create the element to display file size.
      size.classList.add("label", "filesize");

      // Step 7: Set the formatted file size and add 'unallowed' class if the file is not allowed.
      size.textContent = this._formatFileSize(file.size);
      if (!validation.allowed) size.classList.add("unallowed");

      const close = document.createElement("div");
      // Step 8: Create the close/remove button.
      close.classList.add("close", "button");
      close.insertAdjacentHTML("afterbegin", `<i class="icon trash"></i>`);
      // Step 9: Attach the event listener for removing the item.
      this._onCloseRemoveItem(file, close, item);

      // Step 10: Append thumbnail (if exists), content, size, and close button to the item.
      if (thumb) item.append(thumb);
      item.append(content, size, close);
      // Step 11: Append the complete item to the view container.
      viewContainer.appendChild(item);
    });

    // grouped summary for exceeded files from list view
    // Step 12: If grouping unallowed files is enabled, check for files exceeding the max upload limit.
    if (this._config.groupUnallowed) {
      const groupedExceeded = validations.find((v: FileValidationEntry) => v.validation.unAllowedGroup);
      if (groupedExceeded) {
        const unallowedCount = this._selectedFiles.length - (this.filesToUpload.length + countMSNA);
        const message = groupedExceeded.validation.message ?? "File is not allowed.";
        const item = this.createUnallowedItem("list", message, unallowedCount);
        item.title = this.unAllowedFiles.map((f) => f.name).join(", ");
        viewContainer.appendChild(item);
      }
    }
  }

  /**
   * @private
   *
   * @param {Object[]} validations - An array of objects, each containing a `File` object and its `validation` result.
   *
   * @description
   * Builds and appends the thumbnail-style view for files to the `viewContainer`.
   * It creates two main rows: one for thumbnails and one for details (messages).
   * Each file's thumbnail is displayed with its size and a close button, and its
   * validation message is shown in the details row. It also handles grouping of
   * unallowed files if configured.
   *
   * @returns {void}
   *
   * @example
   * // Called internally by `renderView` when `config.view` is "thumbnails".
   * // `this._buildThumbnailsView(validations);`
   *
   * @summary
   * 1. **Create Row Containers**: Creates `rowThumbs` for thumbnails and `rowDetails` for messages.
   * 2. **Initialize Counter**: Sets `countMSNA` to track files unallowed due to max size or non-acceptance.
   * 3. **Iterate Validations**: Loops through each file and its validation result.
   * 4. **Skip Grouped Unallowed**: If `groupUnallowed` is true and the file is part of an `unAllowedGroup`, it skips rendering the individual item.
   * 5. **Count Max Size/Not Accepted**: Increments `countMSNA` for files unallowed due to size or type, if `groupUnallowed` is active.
   * 6. **Create Item Elements**: Creates `div.item` for each file.
   * 7. **Thumbnail**: Creates and appends a thumbnail if `renderThumbnail` is true, adding 'unallowed' or 'warning' classes as needed.
   * 8. **File Size**: Displays the formatted file size.
   * 9. **Close Button**: Creates a close button and attaches `_onCloseRemoveItem` listener.
   * 10. **Append to Rows**: Appends the item to `rowThumbs` and the message to `rowDetails`.
   * 11. **Append Rows to View**: Appends `rowThumbs` and `rowDetails` to `viewContainer`.
   * 12. **Grouped Summary**: If `groupUnallowed` is true and there are files exceeding the max upload limit, it creates and appends a summary item for them in `rowDetails`.
   */
  _buildThumbnailsView(validations: FileValidationEntry[]) {
    const viewContainer = this.viewContainer;
    if (!viewContainer) return;
    const rowThumbs = document.createElement("div");
    rowThumbs.classList.add("row");
    const rowDetails = document.createElement("div");
    rowDetails.classList.add("row", "details");
    rowDetails.insertAdjacentHTML("afterbegin", `<div class="title">Details</div>`);

    // Step 1: Initialize a counter for files unallowed due to maxFileSize or notAccepted reasons.
    let countMSNA = 0; //maxFileSize and notAccepted

    validations.forEach(({ file, validation }: FileValidationEntry) => {
      // Step 2: If grouping unallowed files is enabled and this file is part of an unallowed group (exceeded max upload), skip rendering it individually.
      if (this.config.groupUnallowed && validation.unAllowedGroup) return; // skip grouped count-limit files
      // Step 3: If grouping unallowed files is enabled and this file is unallowed due to maxFileSize or notAccepted, increment the counter.
      if ((this.config.groupUnallowed && validation.maxFileSize) || (this.config.groupUnallowed && validation.notAccepted)) {
        countMSNA++;
      }
      const item = document.createElement("div");
      // Step 4: Create the main item container for the file.
      item.classList.add("item");

      // Step 5: If thumbnail rendering is enabled, create and append the thumbnail.
      if (this.config.renderThumbnail) {
        const thumb = this.createImageThumbnail(file);
        // Step 5a: Add 'unallowed' or 'warning' classes to the thumbnail based on validation status.
        if (!validation.allowed) thumb.classList.add("unallowed");
        if (validation.allowed && validation.warning) thumb.classList.add("warning");
        item.append(thumb);
      }

      const size = document.createElement("div");
      // Step 6: Create the element to display file size.
      size.classList.add("label", "filesize");
      size.textContent = this._formatFileSize(file.size);

      const close = document.createElement("div");
      // Step 7: Create the close/remove button.
      close.classList.add("close", "button");
      close.title = `Remove ${file.name}`
      close.insertAdjacentHTML("afterbegin", `<i class="icon close"></i>`);
      // Step 8: Attach the event listener for removing the item.
      this._onCloseRemoveItem(file, close, item);

      // Step 9: Append size and close button to the item.
      item.append(size, close);
      // Step 10: Append the item to the row for thumbnails.
      rowThumbs.appendChild(item);

      // Step 11: Append the file message (name, status, validation message) to the row for details.
      rowDetails.appendChild(this.createMessage(file, validation));
    });

    viewContainer.append(rowThumbs, rowDetails);

    // grouped summary from thumbnails view
    // Step 12: If grouping unallowed files is enabled, check for files exceeding the max upload limit.
    if (this._config.groupUnallowed) {
      const groupedExceeded = validations.find((v: FileValidationEntry) => v.validation.unAllowedGroup);
      if (groupedExceeded) {
        const unallowedCount = this._selectedFiles.length - (this.filesToUpload.length + countMSNA);
        const msg = this.createUnallowedItem("thumbnails", groupedExceeded.validation.message as string, unallowedCount);
        msg.dataset.filename = this.unAllowedFiles.map((f) => f.name).join(", ");
        rowDetails.appendChild(msg);
      }
    }
  }

  /**
   * @public
   *
   * @param {"list"|"thumbnails"} view - The current view mode ("list" or "thumbnails").
   * @param {string} msg - The validation message explaining why the files are unallowed.
   * @param {number} count - The number of unallowed files being grouped.
   *
   * @description
   * Creates a DOM element to display a grouped summary of unallowed files,
   * typically used when `groupUnallowed` is enabled and multiple files
   * exceed the `maxUpload` limit or are unallowed for other reasons.
   * The structure of the element varies slightly based on the `view` mode.
   *
   * @returns {HTMLElement} The created DOM element representing the grouped unallowed files message.
   *
   * @example
   * // Called internally by `_buildListView` or `_buildThumbnailsView` for grouped unallowed files.
   * // `this.createUnallowedItem("list", "Too many files selected.", 3);`
   *
   * @summary
   * 1. **Message Text**: Constructs a generic message indicating the number of files not uploaded.
   * 2. **List View**:
   *    - Creates a `div.item` as the main container.
   *    - Adds a generic file icon thumbnail.
   *    - Creates a `div.content` to hold the filename and info.
   *    - Displays the `messageText` as the filename.
   *    - Displays the specific `msg` from validation as info, with a 'times circle' icon.
   * 3. **Thumbnails View**:
   *    - Creates a `div.message.unallowed.group` as the main container.
   *    - Displays the `messageText` with a file icon as the filename.
   *    - Displays the specific `msg` from validation as info, with a 'times circle' icon.
   * 4. **Return Element**: Returns the constructed DOM element.
   *
   * @security
   * - Uses `textContent` for `msg` to prevent XSS when inserting validation messages.
   */
  createUnallowedItem(view: string, msg: string, count: number) {
    const messageText = `${count} file(s) will not be uploaded.`;

    if (view === "list") {
      const item = document.createElement("div");
      item.classList.add("item");

      const exImg = document.createElement("div");
      exImg.classList.add("thumbnail", "image");
      exImg.insertAdjacentHTML("afterbegin", `<i class="icon file"></i>`);

      const content = document.createElement("div");
      content.classList.add("content");

      const messageGroup = document.createElement("div");
      messageGroup.classList.add("message", "group");

      const filename = document.createElement("div");
      filename.classList.add("filename");
      filename.style.color = "var(--unallowed-color)";
      filename.textContent = messageText;

      const info = document.createElement("div");
      info.classList.add("info", "unallowed");
      info.textContent = msg; // Step 2f: Safely insert the validation message as text content.

      const icon = document.createElement("i");
      icon.classList.add("icon", "cross", "circle");
      info.appendChild(icon);

      messageGroup.append(filename, info);
      content.appendChild(messageGroup);
      item.append(exImg, content);

      return item;
    } else {
      const item = document.createElement("div");
      item.classList.add("message", "unallowed", "group");

      const filename = document.createElement("div");
      filename.classList.add("filename");
      filename.style.color = "var(--unallowed-color)";

      filename.insertAdjacentHTML("afterbegin", `<i class="icon file"></i> ${messageText}`);

      const info = document.createElement("div");
      info.classList.add("info", "unallowed");
      info.textContent = msg; // Step 3d: Safely insert the validation message as text content.

      const icon = document.createElement("i");
      icon.classList.add("icon", "close", "circle");
      info.appendChild(icon);

      item.append(filename, info);
      return item;
    }
  }

  /**
   * @public
   *
   * @description
   * Creates a `div` element containing an `img` tag that displays a thumbnail
   * for the given file. If the file is an image, it uses `URL.createObjectURL`
   * to generate a preview. For other file types, it generates an SVG icon
   * based on the file extension.
   *
   * @param {File} file - The File object for which to create a thumbnail.
   * @returns {HTMLDivElement} The `div` element containing the thumbnail image.
   *
   */
  createImageThumbnail(file: File): HTMLDivElement {
    const thumb = document.createElement("div");
    thumb.classList.add("thumbnail", "image");
    const img = document.createElement("img");
    if (file.type.startsWith("image/")) {
      img.src = URL.createObjectURL(file);
      img.onload = () => URL.revokeObjectURL(img.src);
    } else {
      img.src = this._getSvgThumbnail(file);
    }

    img.title = file.name;
    thumb.appendChild(img);
    return thumb;
  }

  /**
   * @public
   *
   * @param {number} allSelectedFiles
   * @param {number} totalAllowedFiles
   * @returns {void}
   */
  updateUploadInfo(allSelectedFiles: number, totalAllowedFiles: number) {
    const messages = this.config.messages ?? FileUploader.config.messages;
    if (!this.viewContainer || !messages) return;
    const totalFilesMsg = `
      <div class="message">
        <i class="copy file icon"></i>
        ${messages.selectedFiles(allSelectedFiles)}
      </div>`;
    // Step 2: Generates HTML strings for allowed files.
    const allowedFilesMsg = `
      <div class="message allowed">
        <i class="checkmark circle icon"></i>
        ${messages.readyFiles(totalAllowedFiles)}
      </div>`;
    // Step 2: Generates HTML strings for unallowed files.
    const unAllowedFilesMsg = `
      <div class="message unallowed">
        <i class="cross circle icon"></i>
        ${messages.unAllowedFiles(allSelectedFiles - totalAllowedFiles)}
      </div>`;

    // Step 3: Creates a new `div` element for `uploadInfo` and adds appropriate classes.
    this.uploadInfo = document.createElement("div");
    this.uploadInfo.classList.add("item", "info");
    // Step 4: Inserts the `uploadInfo` element at the beginning of the `viewContainer`.
    this.viewContainer.prepend(this.uploadInfo);
    // Step 5: Determines the number of unallowed files.
    const unAllowedFiles = this._selectedFiles.length - this.filesToUpload.length;

    if (unAllowedFiles > 0) {
      this.uploadInfo.insertAdjacentHTML("beforeend", `${totalFilesMsg} ${allowedFilesMsg} ${unAllowedFilesMsg}`);
    } else {
      this.uploadInfo.insertAdjacentHTML("beforeend", `${totalFilesMsg} ${allowedFilesMsg}`);
    }
  }

  /**
   * @public
   *
   *
   * @description
   * Creates a DOM element to display a file's name, status, and any associated validation message.
   * It includes an icon representing the file type and another icon indicating its validation status.
   *
   * @returns {HTMLDivElement} The created DOM element representing the file message.
   *
   * @example
   * // Called internally by `_buildListView` or `_buildThumbnailsView`.
   * // `this.createMessage(fileObject, { allowed: true, message: "Ready to upload" });`
   *
   * @summary
   * 1. **Create Wrapper**: Creates a `div` element with class "message" to contain the file information.
   * 2. **Define Icons**: Sets up an object mapping validation states ("allowed", "unallowed", "warning") to their respective Semantic UI icon HTML.
   * 3. **Filename Element**: Creates a `div` for the filename, including a file type icon and a truncated version of the file's name.
   * 4. **Info Element**: Creates a `div` for additional information or validation messages.
   * 5. **Conditional Message**: If a `validation.message` exists, it adds appropriate styling ("warning" or "unallowed") and displays the message along with its corresponding icon.
   * 6. **Default Message**: If no specific validation message, it displays "Ready to upload" with the "allowed" icon.
   * 7. **Append Elements**: Appends the filename and info elements to the wrapper.
   * 8. **Return Element**: Returns the constructed wrapper element.
   *
   * @param {File} file - The File object for which to create the message.
   * @param {Object} validation - The validation result object for the file.
   * @param {boolean} validation.allowed - Whether the file is allowed for upload.
   * @param {string} [validation.message] - The validation message (e.g., warning, error).
   */
  createMessage(file: File, validation: FileValidationResult) {
    // Step 1: Create a wrapper div for the message and add the "message" class.
    const wrapper = document.createElement("div");
    wrapper.classList.add("message");

    const icons = {
      allowed: `<i class="checkmark circle icon"></i>`,
      unallowed: `<i class="cross circle icon"></i>`,
      warning: `<i class="error icon"></i>`,
    };

    const filename = document.createElement("div");
    filename.classList.add("filename");
    filename.insertAdjacentHTML("beforeend", this._getFileIconSVG(file) + truncateText(file.name, 15));

    const info = document.createElement("div");
    info.classList.add("info");

    if (validation.message) {
      const state = validation.allowed ? "warning" : "unallowed";
      info.classList.add(state);
      info.insertAdjacentHTML("beforeend", validation.message + " " + icons[state]);
    } else {
      info.classList.add("allowed");
      info.insertAdjacentHTML("beforeend", "Ready to upload" + " " + icons.allowed);
    }

    wrapper.append(filename, info);
    return wrapper;
  }
  /**
   * @public
   *
   *
   * @description
   * Clears the file uploader view and resets its internal state.
   * This method removes all file previews from the UI and clears the internal arrays that store file references.
   * It can optionally clear the actual file input element as well.
   *
   * @param {boolean} [clearInput=false] - If true, the file input element will also be cleared.
   * @returns {void}
   *
   * @example
   * // Clear the view and the input
   * uploaderInstance.clearView(true);
   *
   * @example
   * // Clear only the view, keeping the input value
   * uploaderInstance.clearView(false);
   *
   * @summary
   * 1. **View Container Cleanup**: Removes all content from `this.viewContainer` and hides it.
   * 2. **State Reset**: Clears the `filesToUpload` and `unAllowedFiles` arrays.
   * 3. **Optional Input Reset**: If `clearInput` is true, it also clears the `_selectedFiles` array and resets the value of the actual file input element.
   */
  clearView(clearInput = false, emitChange = false) {
    if (this.viewContainer) {
      this.viewContainer.className = "";
      this.viewContainer.replaceChildren();
      this.viewContainer.classList.add("hidden");
    }
    this.filesToUpload.length = 0;
    this.unAllowedFiles.length = 0;
    if (clearInput) {
      this._selectedFiles = [];
      if (this.input) {
        this.input.value = "";
        if (emitChange) {
          this.input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    }
  }

  /**
   * @typedef {Object} FileValidationResult
   * @property {boolean} allowed - True if the file is allowed for upload, false otherwise.
   * @property {boolean} [unAllowedGroup] - True if the file was disallowed because it exceeded the maxUpload limit.
   * @property {string|null} message - A message explaining the validation status (e.g., warning, error).
   * @property {string} name - The name of the file.
   * @property {boolean} [notAccepted] - True if the file type is not accepted.
   * @property {boolean} [maxFileSize] - True if the file size exceeds the maximum allowed.
   * @property {boolean} [warning] - True if the file triggers a warning (e.g., near max size).
   */

  /**
   * @public
   *
   * @description
   * Validates a given file against the configured rules such as maximum file size,
   * accepted file types, and maximum number of files allowed for upload.
   * It returns an object detailing the validation result, including whether the file is allowed,
   * any specific reasons for disallowance, and a user-friendly message.
   *
   * @param {File} file - The File object to validate.
   * @param {number} [index] - The index of the file in the selection. Used for `maxUpload` validation.
   * @returns {FileValidationResult} An object containing the validation status and message.
   *
   * @example
   * // Validate a file
   * const myFile = new File(["content"], "document.pdf", { type: "application/pdf" });
   * const validationResult = uploader.runValidation(myFile);
   * console.log(validationResult);
   * // { allowed: true, message: null, name: "document.pdf" }
   *
   * @example
   * // Validate a file that exceeds max size
   * const largeFile = new File(new ArrayBuffer(6 * 1024 * 1024), "large.jpg", { type: "image/jpeg" });
   * const validationResult = uploader.runValidation(largeFile);
   * console.log(validationResult);
   * // { allowed: false, maxFileSize: true, message: "Exceeds the maximum file size of 5.0 MB.", name: "large.jpg" }
   *
   * @example
   * // Validate a file that is beyond the maxUpload limit (assuming maxUpload is 2 and this is the 3rd file)
   * // const validationResult = uploader.runValidation(anotherFile, 2); // index 2 means 3rd file
   * // console.log(validationResult);
   * // { allowed: false, unAllowedGroup: true, message: "Maximum of 2 files allowed.", name: "another.png" }
   *
   * @summary
   * 1. **Extract Config**: Destructures relevant configuration properties.
   * 2. **Max Upload Check**: If `index` is provided and exceeds `maxUpload`, marks the file as `unAllowedGroup`.
   * 3. **Accepted File Type Check**: Uses `_isAcceptedFile` to check if the file type is allowed. If not, constructs a readable error message.
   * 4. **Max File Size Check**: Compares `file.size` with `maxFileSize`.
   * 5. **Warning File Size Check**: Compares `file.size` with `warnFileSize` to issue a warning if near the limit.
   * 6. **Default Allowed**: If all checks pass, the file is marked as allowed.
   */
  runValidation(file: File, index?: number): FileValidationResult {
    const { maxFileSize, maxUpload, warnFileSize, accept } = this.config;
    const messages = this.config.messages ?? FileUploader.config.messages;

    // grouped case: exceeds maxUpload
    if (typeof index === "number" && maxUpload && index >= maxUpload) {
      return { allowed: false, unAllowedGroup: true, message: messages?.tooMany(maxUpload) ?? null, name: file.name };
    }

    if (accept && !this._isAcceptedFile(file, accept)) {
      // normalize to human-readable labels
      const readableTypes = accept.map((type: string) => {
        if (type.startsWith(".")) {
          return type.toUpperCase().replace(".", ""); // ".jpg" -> "JPG"
        }
        if (type.includes("/*")) {
          // "image/*" -> "Images"
          const category = type.split("/")[0];
          return category.charAt(0).toUpperCase() + category.slice(1) + "s";
        }
        if (type.includes("/")) {
          // "image/jpeg" -> "JPEG"
          return type.split("/")[1].toUpperCase();
        }
        return type;
      });
      return {
        allowed: false,
        notAccepted: true,
        message: (messages?.notAccepted(readableTypes.join(", ")) ?? "File type is not accepted.") + ` You tried '${file.type || file.name}'.`,
        name: file.name,
      };
    }
    if (maxFileSize && file.size > maxFileSize) {
      return {
        allowed: false,
        maxFileSize: true,
        message: messages?.tooLarge(this._formatFileSize(maxFileSize)) ?? null,
        name: file.name,
      };
    }
    const maxSize = maxFileSize ?? Number.POSITIVE_INFINITY;
    if (warnFileSize && file.size > warnFileSize && file.size < maxSize) {
      return {
        allowed: true,
        warning: true,
        message: messages?.nearLimit(this._formatFileSize(maxSize)) ?? null,
        name: file.name,
      };
    }
    return { allowed: true, message: null, name: file.name };
  }

  /**
   * @public
   *
   * @description
   * Getter for the merged configuration object. It combines the static default configuration
   * with any instance-specific configuration provided during instantiation.
   *
   * @returns {FileUploaderConfig} The merged configuration object for this instance.
   *
   * @example
   * const uploader = new FileUploader(inputElement, { maxUpload: 5 });
   * console.log(uploader.config.maxUpload); // Output: 5
   * console.log(uploader.config.view);     // Output: "thumbnails" (default)
   *
   * @summary
   * 1. **Merge Configurations**: Spreads the static `FileUploader.config` (defaults)
   *    and the instance's `_config` (overrides) into a new object.
   * 2. **Return Merged Config**: Returns the resulting merged configuration.
   */
  get config() {
    // Step 1: Merge the static default configuration with the instance-specific configuration.
    // The instance's _config takes precedence over the static defaults.
    return { ...FileUploader.config, ...this._config };
  }

  /**
   * @public
   *
   * @description
   * Getter for the default configuration object.
   *
   * @returns {FileUploaderConfig} The default configuration object for the FileUploader class.
   *
   * @example
   * console.log(FileUploader.config.maxUpload); // Output: 10
   * console.log(FileUploader.config.view);     // Output: "thumbnails" (default)
   *
   * @summary
   * 1. **Access Static Default Config**: Checks for a cached `_configDefaults` property.
   * 2. **Create Defaults if Needed**: If no cached defaults, it initializes a new configuration object
   *    with default values for all settings (e.g., `accept`, `maxFileSize`, `view`, etc.)
   * 3. **Return Defaults**: Returns the default configuration object.
   */
  static get config() {
    return (
      this._configDefaults || {
        accept: ["image/*", ".pdf"],
        input: 'input[type="file"][data-uploader]',
        container: "",
        closeButton: ".close.icon",
        maxFileSize: 5 * 1024 * 1024,
        maxUpload: 10,
        warnFileSize: 2 * 1024 * 1024,
        view: "thumbnails",
        renderThumbnail: true,
        groupUnallowed: true,
        icons: {
          remove: `<i class="close icon"></i>`,
          allowed: `<i class="check circle icon"></i>`,
          unallowed: `<i class="times circle icon"></i>`,
          warning: `<i class="circle exclamation icon"></i>`,
          image: `<i class="file image icon"></i>`,
          audio: `<i class="file audio icon"></i>`,
          video: `<i class="file video icon"></i>`,
          pdf: `<i class="file pdf icon"></i>`,
          file: `<i class="file icon"></i>`,
          files: `<i class="copy file icon"></i>`
        },
        messages: {
          selectedFiles: (count) => `${count} selected file(s)`,
          readyFiles: (count) => `${count} file(s) ready to upload.`,
          unAllowedFiles: (count) => `${count} file(s) not allowed.`,
          tooMany: (limit) => `Maximum of ${limit} files allowed.`,
          tooLarge: (maxSize) => `Exceeds the maximum file size of ${maxSize}.`,
          nearLimit: (warnSize) => `Is near the max file size (${warnSize}).`,
          notAccepted: (acceptablefileType) => `Only '${acceptablefileType}' type are allowed.`,
        },
      }
    );
  }

  /**
   *
   * @static
   *
   * @description
   * Setter for the static default configuration of the `FileUploader` class.
   * This allows global modification of default settings for all future `FileUploader` instances
   * that do not explicitly override these settings.
   *
   * @param {FileUploaderConfig} custom - An object containing custom configuration properties
   *   to merge with the existing static defaults.
   * @returns {void}
   *
   * @example
   * FileUploader.config = { maxUpload: 20, accept: ["image/*"] };
   * // Now, all new FileUploader instances will default to max 20 uploads and only images.
   *
   * @summary
   * 1. **Merge Custom Config**: Merges the provided `custom` configuration with the current static defaults.
   * 2. **Update Defaults**: Stores the new merged configuration as the static `_configDefaults`.
   */
  static set config(custom) {
    // Step 1: Merge the current static configuration defaults with the provided custom configuration.
    this._configDefaults = { ...this.config, ...custom };
  }

  /**
   * @private
   *
   * @description
   * Synchronizes native input attributes with the resolved uploader configuration.
   * This keeps the browser file picker behavior aligned with the uploader logic.
   */
  private _syncInputAttributes() {
    if (!this.input) return;

    const accept = this._config.accept ?? [];
    const acceptValue = accept.join(",");
    if (acceptValue) {
      this.input.setAttribute("accept", acceptValue);
    } else {
      this.input.removeAttribute("accept");
    }

    const maxUpload = this._config.maxUpload ?? Infinity;
    if (maxUpload > 1) {
      this.input.setAttribute("multiple", "");
      this.input.multiple = true;
    } else {
      this.input.removeAttribute("multiple");
      this.input.multiple = false;
    }
  }

  static reset(input: HTMLInputElement | HTMLFormElement | null = null) {
    const selector = this.config.input ?? 'input[type="file"][data-uploader]';

    if (input instanceof HTMLInputElement) {
      const uploaderInstance = (input as HTMLInputElement & { _uploaderInstance?: FileUploader })._uploaderInstance;
      if (uploaderInstance) uploaderInstance.clearView(true);
    } else if (input instanceof HTMLFormElement) {
      const inputs = input.querySelectorAll<HTMLInputElement>(selector);
      inputs.forEach((inp) => {
        const uploaderInstance = (inp as HTMLInputElement & { _uploaderInstance?: FileUploader })._uploaderInstance;
        uploaderInstance?.clearView(true);
      });
    } else {
      document.querySelectorAll<HTMLInputElement>(selector).forEach((inp) => {
        const uploaderInstance = (inp as HTMLInputElement & { _uploaderInstance?: FileUploader })._uploaderInstance;
        uploaderInstance?.clearView(true);
      });
    }
  }

  /**
   * @static
   *
   * @description
   * Retrieves all files selected across all `FileUploader` instances within a specific form.
   * It groups the files by their input name attribute.
   *
   * @param {string} formId - The ID of the form element.
   * @returns {Object} An object where keys are the input names and values are arrays of File objects for that input.
   *
   * @example
   * const filesData = FileUploader.getFiles("myForm");
   * console.log(filesData); // { profilePic: [File...], gallery: [File...] }
   *
   * @summary
   * 1. **Find Form**: Locates the form element by ID or uses the document if no ID is provided.
   * 2. **Find Inputs**: Selects all file input elements within the form using the configured selector.
   * 3. **Collect Files**: Iterates through each input, retrieves the associated `FileUploader` instance.
   * 4. **Group by Name**: Collects the `filesToUpload` for each instance and groups them by the input's `name` attribute.
   * 5. **Return Result**: Returns the grouped files.
   */
  static getFiles(formId?: string | null) {
    const form = formId ? document.getElementById(formId) : null;
    const selector = this.config.input ?? 'input[type="file"][data-uploader]';
    const inputs = (form || document).querySelectorAll<HTMLInputElement>(selector);
    const result: Record<string, File[]> = {};
    inputs.forEach((input) => {
      const uploader = (input as HTMLInputElement & { _uploaderInstance?: FileUploader })._uploaderInstance;
      if (uploader && input.name) result[input.name] = Array.from(uploader.filesToUpload);
    });
    return result;
  }

  /**
   * @static
   *
   * @description
   * Processes all active file attachment inputs inside a target form, converting them
   * into clean, binary byte-stream payloads optimized for the Google Apps Script transport bridge.
   * This version uses FileReader with onload callback, which is more widely supported and performant for large files compared to the arrayBuffer() method.
   *
   * @param {string} formId - The HTML DOM element ID string for the form context
   * @returns {Promise<Object>} An object mapping input names to binary structural files
   */
  static async getFilesForGoogleDrive(formId?: string | null) {
    const filesMap = FileUploader.getFiles(formId);
    const result: Record<string, Array<{ name: string; mimeType: string; size: number; bytes: number[] }>> = {};

    if (!filesMap || Object.keys(filesMap).length === 0) return result;

    const entries = Object.entries(filesMap);

    for (const [inputName, fileArray] of entries) {
      if (!fileArray || fileArray.length === 0) continue;

      // Map out all allowed files within this specific file field row block asynchronously
      result[inputName] = await Promise.all(
        (fileArray as File[]).map((file: File) => {
          return new Promise<{ name: string; mimeType: string; size: number; bytes: number[] }>((resolve, reject) => {
            const reader = new FileReader();

            // Read file raw arrays as ArrayBuffer data payloads to maintain speed
            reader.readAsArrayBuffer(file);

            reader.onload = () => {
              const arrayBuffer = reader.result;
              if (!(arrayBuffer instanceof ArrayBuffer)) {
                reject(new Error(`Unable to read file data for '${file.name}'.`));
                return;
              }

              const byteArray = Array.from(new Uint8Array(arrayBuffer));

              resolve({
                name: file.name,
                mimeType: file.type /* || "application/octet-stream" */,
                size: file.size,
                bytes: byteArray, // Direct integer array mapping matching your backend uploadFile signature!
              });
            };

            reader.onerror = (error) => {
              console.error(`[FileUploader] Failed to process payload data for '${file.name}':`, error);
              reject(error);
            };
          });
        }),
      );
    }

    return result;
  }

  /**
   * @static
   *
   * @description
   * Scans the target form context for uploaded CSV files, parses the raw data stream 
   * entirely on the client side, and instantly packs it into a normalized `TableData` structure.
   * This is heavily optimized to automatically casting numerical tokens and resolving 
   * regional Excel delimiter changes (comma vs semicolon) before returning clean payload schemas.
   *
   * @param {string} formId - The HTML DOM element ID string for the form context.
   * @returns {Promise<{body: any[], header: any[], footer:any}} A structured object mirroring the `TableData` specification or empty schema if no CSV found.
   *
   * @example
   * const importedTable = await FileUploader.parseCSVToTable("myFormId");
   * console.log(importedTable.body); // [ ["Product A", 150000, 10], ["Product B", 200000, 5] ]
   *
   * @summary
   * 1. **Fetch Form Files**: Dispatches internal `getFiles` to retrieve the active binary state dictionary within the form.
   * 2. **Locate Target CSV**: Extracts the first file containing a `.csv` extension across all file input entries.
   * 3. **Stream Text Data**: Spawns a FileReader instance utilizing `readAsText` coupled with UTF-8 encoding.
   * 4. **Auto-Detect Delimiter**: Evaluates header metrics to switch dynamically between standard commas (,) and regional semicolons (;).
   * 5. **Sanitize & Type-Cast**: Scrubs encapsulation wrappers ("quotes") and maps pure numerical strings straight to native float integers.
   */
  static async parseCSVToTable(formId?: string | null): Promise<{ body: any[], header: any[], footer: any }> {
    return new Promise<{ body: any[], header: any[], footer: any }>((resolve, reject) => {
      const filesMap = FileUploader.getFiles(formId);
      let targetCsvFile: File | null = null;

      // 1. Iterate through grouped fields to capture the first available .csv file
      if (filesMap && Object.keys(filesMap).length > 0) {
        for (const [_, fileArray] of Object.entries(filesMap)) {
          if (!fileArray || fileArray.length === 0) continue;

          const found = fileArray.find(file => file.name.split('.').pop()?.toLowerCase() === 'csv');
          if (found) {
            targetCsvFile = found;
            break;
          }
        }
      }

      // Fallback early with an empty table layout schema if no CSV matches were registered
      if (!targetCsvFile) {
        resolve({ header: [], body: [], footer: null });
        return;
      }

      const reader = new FileReader();
      reader.readAsText(targetCsvFile, "UTF-8");

      reader.onload = () => {
        const csvText = reader.result as string;
        if (!csvText || csvText.trim() === "") {
          resolve({ header: [], body: [], footer: null });
          return;
        }

        // 2. Break string text stream blocks down by structural line segments (supports CRLF / LF)
        const lines = csvText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        if (lines.length === 0) {
          resolve({ header: [], body: [], footer: null });
          return;
        }

        const firstLine = lines[0];

        // 3. Dynamic Delimiter detection engine matching standard comma configurations vs European/Excel semicolon presets
        const delimiter = (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ',';

        // Internal evaluation utility for stripping outer quote wrappers and converting data-types
        const cleanCell = (cell: string): string | number => {
          let value = cell.trim();
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1).trim();
          }

          // Force cast plain valid digit fields into native JS number types
          if (value !== "" && !isNaN(Number(value))) {
            return Number(value);
          }
          return value;
        };

        // 4. Transform structural raw segments into pure headers and 2D arrays matrix mapping
        const headerRow = firstLine.split(delimiter).map(cell => cleanCell(cell));
        const bodyRows = lines.slice(1).map(line => {
          return line.split(delimiter).map(cell => cleanCell(cell));
        });

        resolve({
          header: headerRow,
          body: bodyRows,
          footer: null // Left blank intentionally for declarative execution inside TableBuilderService
        });
      };

      reader.onerror = (error) => {
        console.error(`[CSVParser] Critical failure while reading buffer stream from target context:`, error);
        reject(error);
      };
    });
  }

  /**
   * @static
   *
   * @description
   * Initializes all `FileUploader` instances within a given DOM element.
   * It finds all file input elements with the `data-uploader` attribute and creates a `FileUploader` instance for each.
   * This method uses a global flag (`data-uploader-initialized`) to prevent re-initialization of the same element.
   *
   * @param {Document | HTMLFormElement | HTMLElement} [root=document] - The root element to search for file inputs. Defaults to the entire document.
   * @param {FileUploaderConfig} [config={}] - Optional configuration object to override default settings.
   * @returns {FileUploader[]} An array of all initialized `FileUploader` instances.
   *
   * @example
   * // Initialize all file uploaders in the document
   * const uploaders = FileUploader.initAll();
   *
   * // Initialize within a specific form
   * const form = document.getElementById("myForm");
   * const formUploaders = FileUploader.initAll(form);
   *
   * // With custom configuration
   * const customUploaders = FileUploader.initAll(document, { maxUpload: 5 });
   *
   * @summary
   * 1. **Set Default Config**: Applies the static `this.config` with any provided `config` overrides.
   * 2. **Find Inputs**: Selects all file inputs using the configured selector.
   * 3. **Iterate and Initialize**: Loops through each input.
   * 4. **Check Initialization**: Skips inputs that have already been initialized (checked via `data-uploader-initialized`).
   * 5. **Create Instance**: Creates a new `FileUploader` instance for the input, passing the element and config.
   * 6. **Mark as Initialized**: Sets a flag on the input to prevent re-initialization.
   * 7. **Collect Instances**: Adds the new instance to an array.
   * 8. **Return Result**: Returns the array of all `FileUploader` instances.
   * @memberof FileUploader
   */
  static initAll(root: Document | HTMLFormElement | HTMLElement = document, config: Partial<FileUploaderConfig> = {}) {
    const cfg = { ...this.config, ...config };
    const selector = cfg.input ?? 'input[type="file"][data-uploader]';
    const inputs = root.querySelectorAll<HTMLInputElement>(selector);
    const uploaders: FileUploader[] = [];
    inputs.forEach((input) => {
      if (input instanceof HTMLInputElement && input.dataset.uploaderInitialized !== "true") {
        uploaders.push(new FileUploader(input, config));
      }
    });
    // Step 4: Return the array of initialized FileUploader instances.
    return uploaders;
  }

  /**
   * @private
   *
   * @description
   * Formats a given number of bytes into a human-readable string (e.g., "1.2 MB", "500 KB").
   * It iteratively divides the byte count by 1024 and updates the unit until the value
   * is less than 1024 or the largest unit (GB) is reached.
   *
   * @param {number} bytes - The number of bytes to format.
   * @returns {string} The formatted file size string.
   *
   * @example
   * // Called internally to display file sizes.
   * // `this._formatFileSize(1234567);` // Returns "1.2 MB"
   *
   * @summary
   * 1. **Initialize Units**: Defines an array of size units (B, KB, MB, GB).
   * 2. **Iterate and Convert**: Divides `bytes` by 1024 and increments the unit index (`i`) until `bytes` is less than 1024 or the last unit is reached.
   * 3. **Format Output**: Returns the formatted number (to one decimal place) concatenated with the appropriate unit.
   */
  _formatFileSize(bytes: number) {
    const units = ["B", "KB", "MB", "GB"];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) {
      bytes /= 1024;
      i++;
    }
    return `${bytes.toFixed(1)} ${units[i]}`;
  }

  /**
   * @private
   *
   * @description
   * Checks if a given file's type or extension is accepted based on a list of rules.
   * The rules can be MIME types (e.g., "image/jpeg"), wildcard MIME types (e.g., "image/*"),
   * or file extensions (e.g., ".pdf").
   *
   * @param {File} file - The File object to check.
   * @param {string[]} acceptList - An array of strings representing accepted file types or extensions.
   * @returns {boolean} True if the file is accepted, false otherwise.
   *
   * @example
   * // Check if an image file is accepted
   * const imageFile = new File([], "photo.jpg", { type: "image/jpeg" });
   * uploader._isAcceptedFile(imageFile, ["image/*", ".png"]); // Returns true
   *
   * // Check if a PDF file is accepted by extension
   * const pdfFile = new File([], "document.pdf", { type: "application/pdf" });
   * uploader._isAcceptedFile(pdfFile, [".pdf"]); // Returns true
   *
   * @summary
   * 1. **Handle Empty Accept List**: If `acceptList` is empty or null, all files are accepted.
   * 2. **Normalize File Info**: Converts file name and type to lowercase for case-insensitive comparison.
   * 3. **Iterate Rules**: Loops through each rule in `acceptList`.
   * 4. **Normalize Rule**: Converts the current rule to lowercase and trims whitespace.
   * 5. **Extension Match**: If the rule starts with ".", checks if the file name ends with the rule.
   * 6. **Wildcard MIME Match**: If the rule ends with "/*", checks if the file type starts with the rule's prefix.
   * 7. **Exact MIME Match**: Otherwise, checks for an exact match with the file type.
   * 8. **Return Result**: Returns `true` if any rule matches, `false` otherwise.
   */
  _isAcceptedFile(file: File, acceptList: string[]) {
    // Step 1: If no accept list is provided or it's empty, all files are considered accepted.
    if (!acceptList || acceptList.length === 0) return true;
    // Step 2: Convert file name and type to lowercase for case-insensitive comparison.
    const fileName = file.name.toLowerCase();
    const fileType = file.type.toLowerCase();
    // Step 3: Iterate through each rule in the accept list.
    return acceptList.some((rule: string) => {
      // Step 4: Normalize the current rule by converting to lowercase and trimming whitespace.
      rule = rule.toLowerCase().trim();
      // Step 5: If the rule starts with a ".", it's an extension rule. Check if the file name ends with this extension.
      if (rule.startsWith(".")) return fileName.endsWith(rule);
      // Step 6: If the rule ends with "/*", it's a wildcard MIME type rule. Check if the file type starts with the rule's prefix.
      if (rule.endsWith("/*")) return fileType.startsWith(rule.replace("/*", ""));
      // Step 7: Otherwise, it's an exact MIME type rule. Check for an exact match with the file type.
      return fileType === rule;
    });
  }

  /**
   * @private
   *
   * @description
   * Returns an HTML string for a Semantic UI icon representing the file type.
   * It checks the file's MIME type and returns a specific icon for images, audio, video, and PDFs.
   * For any other file type, it returns a generic file icon.
   *
   * @param {File} file - The File object for which to get the icon.
   * @returns {string} An HTML string containing the `<i>` tag for the Semantic UI icon.
   *
   * @example
   * // Called internally to display file type icons.
   * // `this._getFileIconSVG(myImageFile);` // Returns `<i class="file image outline icon"></i>`
   * // `this._getFileIconSVG(myPdfFile);`   // Returns `<i class="file pdf outline icon"></i>`
   *
   * @summary
   * 1. **Check MIME Type**: Determines the file type category (image, audio, video, PDF).
   * 2. **Return Specific Icon**: Returns an appropriate Semantic UI icon HTML string based on the category.
   * 3. **Return Generic Icon**: If no specific category matches, returns a generic file icon.
   */
  _getFileIconSVG(file: File) {
    const type = file.type;
    if (type.startsWith("image/")) return `<i class="file jpg icon"></i>`;
    if (type.startsWith("audio/")) return `<i class="file mp3 icon"></i>`;
    if (type.startsWith("video/")) return `<i class="file mp4 icon"></i>`;
    if (type === "application/pdf") return `<i class="file pdf icon"></i>`;
    return `<i class="file icon"></i>`;
  }

  /**
   * @private
   *
   * @description
   * Generates a Data URL for an SVG thumbnail representing the file, primarily for non-image files.
   * The SVG contains a file icon shape and the file's extension in uppercase.
   * The color of the SVG icon is determined by common file extensions (e.g., PDF, DOC, XLS).
   *
   * @param {File} file - The File object for which to generate the SVG thumbnail.
   * @returns {string} A Data URL (base64 encoded SVG) that can be used as an `<img>` src.
   *
   * @example
   * // Called internally to display thumbnails for non-image files.
   * // `this._getSvgThumbnail(myPdfFile);` // Returns a Data URL for a red PDF icon.
   *
   * @summary
   * 1. **Extract Extension**: Gets the file extension from the file name.
   * 2. **Determine Color**: Assigns a specific color based on common file extensions.
   * 3. **Construct SVG**: Builds an SVG string with a file shape and the uppercase extension.
   * 4. **Encode to Data URL**: Base64 encodes the SVG string and prepends the Data URL prefix.
   */
  _getSvgThumbnail(file: File) {
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    let color = "#888";
    if (["pdf"].includes(ext)) color = "#e63946";
    if (["doc", "docx"].includes(ext)) color = "#457b9d";
    if (["xls", "xlsx"].includes(ext)) color = "#2a9d8f";
    if (["ppt", "pptx"].includes(ext)) color = "#f4a261";
    if (["zip", "rar"].includes(ext)) color = "#6d597a";
    const svg = `
        <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"${color}\">
          <path d=\"M6 2C5.4477 2 5 2.4477 5 3V21C5 21.5523 5.4477 22 6 22H18C18.5523 22 19 21.5523 19 21V8L13 2H6Z\"/>
          <text x=\"12\" y=\"17\" text-anchor=\"middle\" font-size=\"5\" fill=\"white\" font-family=\"Arial, sans-serif\">
            ${ext.toUpperCase()}
          </text>
        </svg>
      `;
    const encoded = `data:image/svg+xml;base64,${btoa(svg)}`;
    return encoded;
  }
}
