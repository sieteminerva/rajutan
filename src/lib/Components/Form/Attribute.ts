import { InputBuilder, type InputType, type iBasicInputNode } from "./Input";

export interface iAttributeProperty {
  name: string;
  type: InputType;
  label?: string;
  value: string | number | boolean;
  config?: { style?: string; options?: any, position?: "left" | "right" }
}

export type InputAttributeType =
  | "value"
  | "label"
  | "name"
  | "placeholder"
  | "required"
  | "disabled"
  | "min"
  | "max"
  | "minlength"
  | "maxlength"
  | "step"
  | "rows"
  | "cols"
  | "accept"
  | "multiple"
  | "checked"
  | "orient"
  | "pattern"
  | "form"
  // Custom for google sheets range
  | "range"
  // Custom for file uploader
  | "data-max-upload"
  | "data-max-file-size"
  | "data-group-unallowed"
  | "data-thumbnail"
  | "data-view"
  | "view"
  | "thumbnail";

// Base config applied to every input
const baseInputConfig = {
  label: "",
  name: "",
  value: "",
  required: false,
  disabled: false,
};

export class InputAttributeBuilder {

  // Type-specific overrides (minimal defaults per type)
  static inputs: Record<InputType, Partial<Record<InputAttributeType, string | number | boolean>>> = {
    text: { placeholder: "Enter text", maxlength: 255 },
    textarea: { placeholder: "Enter your message", rows: 3, cols: 30 },
    number: { placeholder: "Enter a number", value: 50, min: 0, max: 100, step: 1 },
    select: { placeholder: "Select an option", range: "sheet_range", form: "form_id", multiple: false },
    dropdown: { placeholder: "Select an option", range: "sheet_range", form: "form_id", multiple: false },
    checkbox: { value: "default_value", checked: false },
    radio: { value: "default_value", range: "sheet_range" },
    range: { value: 50, min: 0, max: 100, step: 1, orient: "horizontal" },
    actions: {},
    date: { min: "yyyy-MM-dd", max: "yyyy-MM-dd" },
    time: {},
    "datetime-local": { min: "YYYY-MM-DDTHH:mm", max: "YYYY-MM-DDTHH:mm" },
    file: {
      accept: "image/*,.pdf",
      multiple: false,
      "data-max-upload": 10,
      "data-max-file-size": 5,
      "data-group-unallowed": true,
      "data-thumbnail": true,
      "data-view": "thumbnails",
    },
    color: { value: "#000000" },
    email: { placeholder: "Enter email" },
    password: { placeholder: "Enter password", minlength: 8, maxlength: 255 },
    url: { placeholder: "Enter URL", pattern: "https://.*" },
    tel: { placeholder: "Enter phone number", pattern: "" },
    hidden: { value: "hidden_value" },
  };

  // Generic attribute definitions
  static attributes: Partial<Record<InputAttributeType, iAttributeProperty>> = {
    value: { name: "value", type: "text", value: "" },
    placeholder: { name: "placeholder", type: "text", value: "" },
    required: { name: "required", type: "checkbox", config: { style: "toggle", position: "left" }, value: false },
    disabled: { name: "disabled", type: "checkbox", config: { style: "toggle", position: "left" }, value: false },
    min: { name: "min", type: "number", value: "" },
    max: { name: "max", type: "number", value: "" },
    minlength: { name: "minlength", type: "number", value: "" },
    maxlength: { name: "maxlength", type: "number", value: "" },
    step: { name: "step", type: "number", value: 1 },
    rows: { name: "rows", type: "number", value: 3 },
    cols: { name: "cols", type: "number", value: 30 },
    accept: { name: "accept", type: "text", value: "" },
    multiple: { name: "multiple", type: "checkbox", config: { style: "toggle", position: "left" }, value: false },
    checked: { name: "checked", type: "checkbox", config: { style: "toggle", position: "left" }, value: false },
    orient: { name: "orient", type: "text", value: "horizontal" },
    pattern: { name: "pattern", type: "text", value: "" },
    // Custom
    ["data-max-upload"]: { name: "data-max-upload", label: "max upload", type: "number", value: 10 },
    ["data-max-file-size"]: { name: "data-max-file-size", label: "max file size", type: "number", value: 5 },
    ["data-view"]: {
      name: "data-view",
      type: "select",
      value: "thumbnails",
      config: { options: ["thumbnails", "list"] },
    },
    ["data-group-unallowed"]: {
      name: "data-group-unallowed",
      label: "group unallowed",
      type: "checkbox",
      config: { style: "toggle", position: "left" },
      value: false,
    },
    ["data-thumbnail"]: { name: "data-thumbnail", label: "display thumbnail", type: "checkbox", config: { style: "toggle", position: "left" }, value: false },
  };
  // resolve correct attr type for min/max
  static resolveMinMaxType(inputType: InputType, key: InputAttributeType) {
    if (!["min", "max"].includes(key)) return null;
    switch (inputType) {
      case "date":
        return "date";
      case "time":
        return "time";
      case "datetime-local":
        return "datetime-local";
      default:
        return "number";
    }
  }

  // unified builder
  static buildSchemaForType(inputType: InputType, header: iBasicInputNode = {}) {
    // merge base + type defaults + user overrides
    const merged: Record<string, any> = {
      ...baseInputConfig,
      ...this.inputs[inputType],
      ...header,
      type: inputType,
    };



    const schema: Record<string, any> = {
      ...merged,
      template: "", // main input
    };

    // now generate attribute editors
    for (const attrKey in this.attributes) {
      const key = attrKey as InputAttributeType;
      const schemaDef = this.attributes[key];
      if (!schemaDef) continue;

      // skip attributes irrelevant to this type
      if (!(key in merged)) continue;

      let value = merged[key];
      // console.log(`[${inputType} > value]`, value);
      let attrType = schemaDef.type;

      // special case: min/max type resolution
      if (["min", "max"].includes(key)) {
        const resolved = this.resolveMinMaxType(inputType, key);
        if (resolved) attrType = resolved;
      }

      // special case: checkbox / radio → use `checked` not value=true
      if (inputType === "checkbox" || inputType === "radio") {
        if (typeof value === "boolean") {
          schema.checked = value;
          value = value;
        }
      }

      // special case: file remove value editor field
      if (inputType === "file") {
        delete schema.value;
      }

      const title = header.id
        ? header.id.toLowerCase().replace(/[\s_]+/g, "-")
        : header.title
          ? header.title.toLowerCase().replace(/[\s_]+/g, "-")
          : inputType;

      const elementId = `${title}-${schemaDef.name}`;

      let attrConfig: iBasicInputNode = {
        type: attrType,
        title: schemaDef.name,
        label: schemaDef.label,
        id: elementId,
        value,
        ...(schemaDef.config ? { config: schemaDef.config } : {}),
      };

      // console.log(`[${inputType} > attrConfig]`, attrConfig);

      schema[key] = {
        input: attrType,
        value,
        ...(schemaDef.config ? { config: schemaDef.config } : {}),
        template: new InputBuilder().create(attrConfig),
      };
    }

    // console.log(`[${inputType} > schema]`, schema);

    return schema;
  }

  static scanUnallowedAttrs(type: InputType, config: Record<string, any>, customAllowed: string[] = []) {
    let status = false;
    const allowedAttrs: Record<InputType, InputAttributeType[]> = {
      text: ["label", "name", "value", "required", "disabled", "placeholder", "maxlength"],
      textarea: ["label", "name", "value", "required", "disabled", "placeholder", "rows", "cols"],
      select: ["label", "name", "value", "required", "disabled", "multiple", "form", "placeholder"],
      dropdown: ["label", "name", "value", "required", "disabled", "multiple", "form", "placeholder"],
      number: ["label", "name", "value", "required", "disabled", "placeholder", "min", "max", "step"],
      checkbox: ["label", "name", "checked", "required", "disabled", "value"],
      radio: ["label", "name", "checked", "required", "disabled", "value"],
      date: ["label", "name", "value", "required", "disabled", "min", "max"],
      time: ["label", "name", "value", "required", "disabled", "min", "max"],
      "datetime-local": ["label", "name", "value", "required", "disabled", "min", "max"],
      file: [
        "label",
        "name",
        "value",
        "required",
        "disabled",
        "multiple",
        "accept",
        //custom
        "data-max-upload",
        "data-max-file-size",
        "thumbnail",
        "data-view",
      ],
      color: ["label", "name", "value", "required", "disabled"],
      range: ["label", "name", "value", "required", "disabled", "min", "max", "step"],
      email: ["label", "name", "value", "required", "disabled", "placeholder"],
      password: ["label", "name", "value", "required", "disabled", "placeholder"],
      url: ["label", "name", "value", "pattern", "required", "disabled", "placeholder"],
      tel: ["label", "name", "value", "pattern", "required", "disabled", "placeholder"],
      hidden: ["label", "name", "value", "required", "disabled"],
      // ... extend as needed
      actions: ["label", "name", "value", "required", "disabled"],
    };

    const allowed = new Set([...(allowedAttrs[type] || []), ...customAllowed]);
    Object.keys(config).forEach((key) => {
      if (!allowed.has(key)) {
        console.warn(`[scanUnallowedAttrs] "${key}" is not standard for input type "${type}"`);
        status = false;
      } else {
        status = true;
      }
    });
    return status;
  }

  static create(headers: Array<iBasicInputNode>) {
    return headers.map((header: iBasicInputNode) => {
      // we expect each header at least has a `type`
      const type = header.type || "text";
      // const scanStatus = scanUnallowedAttrs(type, header, ["title", "type", "range", "config"]);
      // console.log("[generateInputAttributes] > isGoodToGo:", scanStatus);
      return this.buildSchemaForType(type, header);
    });
  }

}







