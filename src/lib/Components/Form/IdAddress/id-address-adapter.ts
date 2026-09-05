export interface ISetOptionsParamsConfig {
  options?: any;
  state?: "loading" | "start" | "ready" | "complete" | "empty" | "error";
  onLevelChange?: Function;
}

export interface ISetOptionsFunction {
  (element: HTMLInputElement | HTMLSelectElement, config?: ISetOptionsParamsConfig): void;
}

export interface IAddressAdapter {
  onLevelChange?: Function;
  setOptions: ISetOptionsFunction;
  setSelectedOption: Function;
  clear: Function;
  init?: Function;
  onError?: Function;
  getValue?: Function;
  destroy?: Function;
  selector?: Object;
  textContent?: Object;
}

export const setPlaceholderText = (element: HTMLInputElement | HTMLSelectElement, text: string) => {
  element.innerHTML = "";
  element && element.tagName === "INPUT" && element instanceof HTMLInputElement ? (element.placeholder = text) : (element.textContent = text);
  return element;
};

export function __setloadingState(el: HTMLInputElement | HTMLSelectElement, level: any, state = "loading", placeholderEl: HTMLInputElement | null = null) {
  if (state === "start") {
    setPlaceholderText(placeholderEl as HTMLInputElement | HTMLSelectElement, `Loading ${level} `);
    if (el instanceof HTMLInputElement) {
      el?.parentElement?.classList.add("loading");
      // const spinner = document.createElement("span");
      // spinner.className = "spinner";
      // el.parentElement?.appendChild(spinner);
    }
    if (el instanceof HTMLSelectElement) {
      el.classList.add("loading");
    }
  } else if (state === "complete") {
    el.classList.remove("error");
    if (el instanceof HTMLInputElement) {
      el?.parentElement?.classList.remove("loading");
      // el.parentElement?.querySelector(".spinner")?.remove()
    }
    if (el instanceof HTMLSelectElement) {
      el.classList.remove("loading");
    }
    const text = level === "kodepos" ? "Isi kodepos tujuan" : `Pilih ${level}`;
    setPlaceholderText(placeholderEl as HTMLInputElement | HTMLSelectElement, text);
  } else {
    el.classList.remove("error");
    if (el instanceof HTMLInputElement) {
      el?.parentElement?.classList.remove("loading");
      // el.parentElement?.querySelector(".spinner")?.remove()
    }
    if (el instanceof HTMLSelectElement) {
      el.classList.remove("loading");
    }
  }
  return;
}

export function __setErrorState(el: HTMLInputElement | HTMLSelectElement, level: any, _message: string, placeholderEl: HTMLInputElement | null = null) {
  el.classList.remove("loading");
  el.classList.add("error");
  setPlaceholderText(placeholderEl as HTMLInputElement | HTMLSelectElement, `Terjadi kesalahan saat memuat ${level}`);
}