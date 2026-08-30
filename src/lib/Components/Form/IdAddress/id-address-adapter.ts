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
    el instanceof HTMLInputElement ? el.parentElement?.classList.add("loading") : el.classList.add("loading");
    setPlaceholderText(placeholderEl as HTMLInputElement | HTMLSelectElement, `Loading ${level}...`);
  } else if (state === "complete") {
    el.classList.remove("error");
    el instanceof HTMLInputElement ? el.parentElement?.classList.remove("loading") : el.classList.remove("loading");
    const text = level === "kodepos" ? "Isi kodepos tujuan" : `Pilih ${level}`;
    setPlaceholderText(placeholderEl as HTMLInputElement | HTMLSelectElement, text);
  } else {
    el instanceof HTMLInputElement ? el.parentElement?.classList.remove("loading") : el.classList.remove("loading");
  }
  return;
}

export function __setErrorState(el: HTMLInputElement | HTMLSelectElement, level: any, _message: string, placeholderEl: HTMLInputElement | null = null) {
  el.classList.remove("loading");
  el.classList.add("error");
  setPlaceholderText(placeholderEl as HTMLInputElement | HTMLSelectElement, `Terjadi kesalahan saat memuat ${level}`);
}