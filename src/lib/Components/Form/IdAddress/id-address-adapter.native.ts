import { __setloadingState, __setErrorState, type IAddressAdapter } from "./id-address-adapter";

declare global {
  interface HTMLSelectElement {
    __nativeChangeHandler: (e: Event) => any;
    __onLevelChange: (e: any) => any;
    __kodeposHandler: (e: any) => any;
    __isDropdown: boolean;
  }

  interface HTMLInputElement {
    __nativeChangeHandler: (e: Event) => any;
    __onLevelChange: (e: any) => any;
    __kodeposHandler: (e: any) => any;
    __isDropdown: boolean;
  }
}


export const IdAddressAdapterNative: IAddressAdapter = {
  init(_el: HTMLSelectElement | HTMLInputElement) {
    // console.info("IAddressBuilder Native Adapter Initialized");
  },

  setOptions(el: HTMLSelectElement | HTMLInputElement, args: any) {
    const level = el.dataset.level;
    const isAddressValue = el instanceof HTMLInputElement && el.type === "hidden" && !!level;
    const visibleInput = isAddressValue
      ? el.parentElement?.querySelector("input.dropdown") as HTMLInputElement | null
      : el as HTMLInputElement;
    const { options = [], state = "complete", onLevelChange } = args;
    // console.log(`run [%s] > setOptions : <${state}>`, level, options);

    // create placeholder if none
    let placeholderEl = el instanceof HTMLSelectElement ? el.options[0] : el;
    if (!placeholderEl && el instanceof HTMLSelectElement) {
      placeholderEl = document.createElement("option");
      placeholderEl.classList.add("placeholder");
      el.add(placeholderEl, 1);
    }

    const isCustomDropdown = isAddressValue || (el instanceof HTMLInputElement && el.classList.contains("dropdown"));

    if (isCustomDropdown) {
      const searchInput = visibleInput || el as HTMLInputElement;
      const listId = searchInput.getAttribute("list");
      const datalist = listId ? document.getElementById(listId) as HTMLDataListElement | null : null;
      if (datalist) {
        datalist.dataset.options = JSON.stringify((options as any[]).map((option) => ({
          id: option[`${level}_id`],
          label: option[`${level}_name`],
        })));
        datalist.replaceChildren(...(options as any[]).map((option) => {
          const optionEl = document.createElement("option");
          optionEl.value = option[`${level}_name`];
          optionEl.dataset.id = String(option[`${level}_id`]);
          return optionEl;
        }));
      }
      (el as HTMLInputElement & { __onLevelChange?: (value: any) => void }).__onLevelChange = onLevelChange;
      __setloadingState(searchInput, level, state, searchInput);
      return;
    }

    // remove any old options incrementally from the top except for placeholder
    if (el.tagName === "SELECT" && el instanceof HTMLSelectElement) {
      while (el.options.length > 1) {
        el.remove(1);
      }
    }

    // set loading state
    __setloadingState(el as HTMLInputElement, level, state, placeholderEl as HTMLInputElement);

    // Add options
    if (el.tagName === "INPUT" && el instanceof HTMLInputElement && state === "complete") {
      el.value = (options as any[])?.[0][`${level}_name`];
    } else if (el.tagName === "SELECT" && el instanceof HTMLSelectElement && state === "complete") {
      for (const option of options) {
        const opt = document.createElement("option");
        opt.value = (option as any)[`${level}_id`];
        opt.textContent = (option as any)[`${level}_name`];
        // opt.id = `${level}-${option[`${level}_id`]}`;

        el.appendChild(opt);
      }
      // @ts-ignore
      el.__onLevelChange = onLevelChange;
    }
  },

  setSelectedOption(el: HTMLInputElement | HTMLSelectElement, value: any) {
    // const level = el.dataset.level;
    // console.log("run %s > setSelectedOption", level, value, typeof value);
    if (el.classList.contains("error")) el.classList.remove("error");
    if (el instanceof HTMLInputElement && (el.type === "hidden" || el.classList.contains("dropdown"))) {
      const visibleInput = el.type === "hidden"
        ? el.parentElement?.querySelector("input.dropdown") as HTMLInputElement | null
        : el;
      const listId = visibleInput?.getAttribute("list");
      const option = listId ? document.getElementById(listId)?.querySelector(`option[data-id="${CSS.escape(String(value))}"]`) : null;
      if (visibleInput) visibleInput.value = option?.getAttribute("value") || String(value);
      if (el.type !== "hidden") {
        const hidden = el.parentElement?.querySelector("input[type='hidden']") as HTMLInputElement | null;
        if (hidden) hidden.value = String(value);
      } else {
        el.value = String(value);
      }
      return;
    }
    el.value = value; // set value both input / select
    if (el.tagName === "SELECT" && el instanceof HTMLSelectElement) {
      const selectedOptEl = el.selectedOptions?.[0];
      selectedOptEl.setAttribute("selected", "");
      selectedOptEl.classList.add("active", "selected");
    }
  },

  onLevelChange(el: HTMLSelectElement | HTMLInputElement) {
    const level = el.dataset.level;

    if (el instanceof HTMLInputElement && (el.type === "hidden" || el.classList.contains("dropdown"))) {
      return;
    }

    if (el.tagName === "SELECT" && el instanceof HTMLSelectElement) {
      const selectEl = /** @type {HTMLSelectElement & { __nativeChangeHandler?: (e: Event) => void }} */ (el);

      // prevent duplicate listeners
      if (selectEl.__nativeChangeHandler) {
        selectEl.removeEventListener("change", selectEl.__nativeChangeHandler);
      }

      selectEl.__nativeChangeHandler = (_e: Event) => {
        const selected = {
          [`${level}_id`]: Number(el.value),
          [`${level}_name`]: el.selectedOptions?.[0]?.textContent,
        };

        const selectedOptEl = el.selectedOptions?.[0];

        selectedOptEl?.setAttribute("selected", "");

        selectedOptEl?.classList.add("active", "selected");

        // @ts-ignore
        selectEl.__onLevelChange?.(el.value === "" ? null : selected);
      };

      selectEl.addEventListener("change", selectEl.__nativeChangeHandler);
    }
  },

  onError(el: HTMLSelectElement | HTMLInputElement, message: string) {
    const level = el.dataset.level;
    el.classList.add("error");
    el.value = "";

    let placeholderEl = el.tagName === "SELECT" && el instanceof HTMLSelectElement ? el.options[0] : el;
    __setErrorState(el as HTMLSelectElement, level, message, placeholderEl as HTMLInputElement);
  },

  getValue(el: HTMLSelectElement | HTMLInputElement) {
    return el.value;
  },

  clear(el: HTMLSelectElement | HTMLInputElement) {
    if (el instanceof HTMLInputElement && (el.type === "hidden" || el.classList.contains("dropdown"))) {
      const visibleInput = el.type === "hidden"
        ? el.parentElement?.querySelector("input.dropdown") as HTMLInputElement | null
        : el;
      if (visibleInput) visibleInput.value = "";
      if (el.type === "hidden") el.value = "";
      const listId = visibleInput?.getAttribute("list");
      document.getElementById(listId || "")?.replaceChildren();
      visibleInput?.classList.remove("loading");
      return;
    }
    if (el.tagName === "SELECT" && el instanceof HTMLSelectElement) {
      let placeholder = el.options[0].cloneNode(true);
      placeholder.textContent = "Pilih " + el.dataset.level;
      el.innerHTML = "";
      el.appendChild(placeholder);
    }
    el.value = "";
    el.classList.remove("loading");
  },

  destroy(el: HTMLSelectElement) {
    // remove native listener
    if (el.__nativeChangeHandler) {
      el.removeEventListener("change", el.__nativeChangeHandler);

      delete (el as any).__nativeChangeHandler;
    }

    // remove builder callback ref
    delete (el as any).__onLevelChange;

    // remove helper flags
    delete (el as any).__isDropdown;

    // cleanup UI state
    el.classList.remove("loading", "error", "active", "selected");
  },
};