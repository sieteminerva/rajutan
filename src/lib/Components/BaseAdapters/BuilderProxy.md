# BuilderProxy

BuilderProxy is the reactive state helper for the builder system. It keeps the proxy logic out of the base lifecycle and gives the component a reusable way to:

- create a proxy from plain object state
- bind DOM controls to state paths
- sync state back from inputs
- refresh the UI from model changes

## Why it exists

The base builder should stay focused on lifecycle and DOM creation. Reactive state management is a cross-cutting concern, so it belongs in a dedicated helper instead of growing the base class endlessly.

## Basic usage

```ts
import { BuilderProxy } from "./src/lib/Modules/BuilderProxy";

const runtime = new BuilderProxy(builder.storage);

const state = runtime.makeReactive(
  "@form",
  {
    name: "Alice",
    email: "alice@example.com",
    preferences: {
      darkMode: true,
    },
  },
  () => {
    // refresh UI here
  },
);

state.name = "Bob";
state.preferences.darkMode = false;
```

With this pattern, mutations to `state` trigger your callback and you can recompute the UI from the current model.

## Binding form controls to state

Use `data-bind` or a `name` attribute to map a control to a nested path:

```html
<input data-bind="name" type="text" />
<input data-bind="preferences.darkMode" type="checkbox" />
<input data-bind="email" type="email" />
```

Then in your builder or component:

```ts
this.bindState(root, this.#state);
```

This will:

- populate the input value from the current state
- listen for input/change events
- write the new value back into the state object

## Syncing the DOM after state change

When the model changes programmatically, you can update the mounted form back to the DOM using:

```ts
this.syncBoundState(root, this.#state);
```

That gives a lightweight Angular-like model binding without needing a full framework.

## Example in a builder

```ts
public prepare(content: any) {
  const root = this.render("@container", content) as HTMLElement;
  this.#state = this.setProxy("@container", {
    title: "Hello",
    disabled: false,
  }, () => {
    this.syncBoundState(root, this.#state);
    this.refresh(root);
  });

  this.bindState(root, this.#state);
  return root;
}
```

This keeps the builder lifecycle intact while giving you reactive two-way binding for form controls.

## Rules to follow

- Keep `#state` as the data model, not DOM nodes.
- Use `data-bind="path.to.value"` for nested state values.
- Use `refresh()` to patch the UI after state changes.
- Keep `render()` for first construction only.

## Summary

BuilderProxy is the bridge between:

- the builder lifecycle
- the reactive state object
- the live DOM form controls

It is the small, reusable building block that gives the framework Angular-like data binding without hardcoding proxy logic into the base builder.
