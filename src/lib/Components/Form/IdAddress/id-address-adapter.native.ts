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
    const { options = [], state = "complete", onLevelChange } = args;
    // console.log(`run [%s] > setOptions : <${state}>`, level, options);

    // create placeholder if none
    let placeholderEl = el instanceof HTMLSelectElement ? el.options[0] : el;
    if (!placeholderEl && el instanceof HTMLSelectElement) {
      placeholderEl = document.createElement("option");
      placeholderEl.classList.add("placeholder");
      el.add(placeholderEl, 1);
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
    el.value = value; // set value both input / select
    if (el.tagName === "SELECT" && el instanceof HTMLSelectElement) {
      const selectedOptEl = el.selectedOptions?.[0];
      selectedOptEl.setAttribute("selected", "");
      selectedOptEl.classList.add("active", "selected");
    }
  },

  onLevelChange(el: HTMLSelectElement) {
    const level = el.dataset.level;

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