# IdAddressBuilder

**Headless Indonesian Administrative Region Cascade Engine**

A headless, adapter-based JavaScript library for building cascading Indonesian administrative region selectors.

IdAddressBuilder manages hierarchical regional state, asynchronous cascading data loading, reverse postal-code lookup, and optional geocode integration — while remaining framework-agnostic and fully extensible through adapters.

Built for Vanilla JS, Angular, React, Vue, Semantic UI/Fomantic UI, and custom rendering systems.

---

# Why This Project Exists

One of the biggest problems in application development is not building forms — it is maintaining **clean and reliable data** after thousands of users start filling them.

Address data is one of the most common examples.

When users are allowed to type addresses freely:

- spelling becomes inconsistent,
- administrative names differ between users,
- abbreviations vary,
- postal codes are missing,
- and sometimes users leave fields incomplete entirely.

Over time, the database slowly turns into unstructured data that is difficult to search, validate, analyze, or integrate into other systems.

```txt
Free User Input
        ↓
Inconsistent Address Data
        ↓
Difficult Validation & Analytics
        ↓
Junk Data
```

---

To solve this, many applications implement cascading address selectors:

```txt
Province → City → District → Sub-district → Postal Code
```

This approach dramatically improves consistency because users are guided through valid administrative hierarchies instead of manually typing everything themselves.

But implementing this system at scale introduces a new challenge.

---

# The Hidden Problem Behind Cascading Address Forms

Once the administrative dataset becomes large:

- server-side queries become complicated,
- maintaining regional data becomes tedious,
- frontend cascade logic becomes messy,
- API structures become tightly coupled to UI implementations,
- and supporting multiple frontend frameworks becomes painful.

What initially started as “just a dropdown form” slowly evolves into infrastructure.

```txt
Better User Experience
        ↓
Better Data Consistency
        ↓
Higher Development & Maintenance Cost
```

---

# The Goal of IdAddressBuilder

IdAddressBuilder was created to simplify that entire process.

The idea was simple:

> Create a reusable cascade engine that separates:
>
> - hierarchical regional logic,
> - UI rendering,
> - and data management.

So applications can maintain clean administrative data **without building the entire infrastructure repeatedly from scratch**.

---

# Why Google Sheets + Apps Script?

Instead of deploying expensive infrastructure for administrative region services, this project uses:

- Google Sheets as the database,
- Google Apps Script as the REST API layer.

This provides several advantages:

- free hosting (you can host it yourself in your google account simply by copying),
- easy manual data updates,
- simple deployment,
- low operational cost (You don't need to maintain it, if you feel like you don't want to.),
- and accessibility for small teams or solo developers.

The backend behaves like a lightweight microservice dedicated to Indonesian administrative region data.

---

# Built for Flexibility

Another important goal was avoiding framework lock-in.

Most cascading form libraries are tightly coupled to a single UI system.

IdAddressBuilder was designed differently.

The engine is separated from the UI through adapters and headless mode, allowing integration with:

- Vanilla JS,
- Angular,
- React,
- Vue,
- Semantic UI,
- or completely custom rendering systems.

This means the same cascade engine can power multiple applications without rewriting the logic repeatedly.

---

# The Real Objective

This project is not just about dropdowns.

It is about:

- improving data consistency,
- reducing maintenance complexity,
- lowering infrastructure cost,
- and making hierarchical regional systems reusable.

If you have ever struggled with:

- inconsistent address data,
- massive cascading region queries,
- messy administrative APIs,
- or difficult UI integrations,

then this project was probably built for the same problems you are facing.

# Features

- **Headless Hierarchical Cascade Engine**

  Run fully without UI rendering and control the cascade programmatically.

- **Adapter-Based Rendering System**

  Supports pluggable UI adapters for Native HTML, Semantic UI/Fomantic UI, and custom frameworks.

- **Framework-Agnostic Architecture**

  Integrates with Vanilla JS, Angular, React, Vue, Svelte, and custom applications.

- **Hierarchical Administrative Loader**

  Province → City → District → Sub-district → Postal Code.

- **Event-Driven Lifecycle**

  Fully observable cascade and selection events.

- **Reverse Postal-Code Lookup**

  Automatically reconstruct hierarchical regional data from postal code input.

- **Optional Geocode Integration**

  Fetch geolocation data after full address resolution.

- **Runtime Adapter Switching**

  Safely rebuild and switch adapters at runtime.

- **Built-in Cache Layer**

  LocalStorage-based caching with configurable TTL.

- **Destroy/Reinitialize Lifecycle**

  Proper cleanup for SPA and dynamic applications.

- **Extensible Adapter System**

  Create adapters for Bootstrap, Material UI, Select2, Tailwind UI, etc.

- **TypeScript Friendly**

  Designed with predictable APIs and typed integration in mind.

---

# Architecture Overview

IdAddressBuilder separates:

- hierarchical state management,
- asynchronous cascading logic,
- rendering,
- and user interaction.

This allows the engine to operate in two modes.

---

## Adapter Mode

The builder controls DOM interaction through adapters.

```txt
User Interaction
        ↓
Adapter
        ↓
IdAddressBuilder Engine
        ↓
REST API / Cache
```

Example:

- Native HTML `<select>`
- Semantic UI dropdowns
- jQuery plugins

---

## Headless Mode

The framework controls the UI while IdAddressBuilder manages state and cascading logic.

```txt
Framework UI
      ↓
schema.select()
      ↓
Cascade Engine
      ↓
onLevelLoaded()
      ↓
Framework Re-render
```

Example:

- Angular Reactive Forms
- React controlled components
- Vue composables
- Custom rendering systems

---

# Why Adapters?

Adapters isolate rendering logic from cascading state management.

This architecture allows IdAddressBuilder to:

- support multiple UI libraries,
- run in headless mode,
- integrate with modern frameworks,
- remain framework-agnostic,
- and avoid coupling the engine to DOM implementations.

The core engine never depends on a specific UI framework.

---

# Installation

```bash
npm install github:ymgh/indonesia-administrative-areas
```

Or install a specific version:

```bash
npm install github:ymgh/indonesia-administrative-areas#v1.0.0
```

---

# Quick Start

## Native Adapter Example

```javascript
import { IdAddressBuilder } from "indonesia-administrative-areas";

const builder = new IdAddressBuilder({
  url: "https://your-api-endpoint.com/api",
  container: document.getElementById("address-form"),
  useAdapter: "native",
});

builder.init();
```

---

# Headless Example

```javascript
const builder = new IdAddressBuilder({
  url: "https://your-api-endpoint.com/api",
  headless: true,
});

builder.init();

builder.onLevelLoaded(async (schema, data) => {
  console.log(`Loaded ${schema.name}`, data);

  // simulate selecting first item
  if (schema.next && data.length) {
    await schema.next.load(data[0][`${schema.name}_id`]);
  }
});
```

---

# Adapters

Built-in adapters:

| Adapter       | Description                         |
| ------------- | ----------------------------------- |
| `native`      | Standard HTML select/input elements |
| `semantic-ui` | Fomantic UI dropdown integration    |
| `base`        | Headless/no-op adapter              |

---

# Registering Adapters

```javascript
import { IAddressAdapterSemanticUi } from "indonesia-administrative-areas";

builder.registerAdapter("semantic-ui", IAddressAdapterSemanticUi);
```

---

# Creating Custom Adapters

Adapters implement the `IAddressAdapter` interface.

```javascript
const customAdapter = {
  init(element) {},

  setOptions(element, config) {},

  setSelectedOption(element, value) {},

  onLevelChange(element) {},

  clear(element) {},

  destroy(element) {},
};

builder.registerAdapter("custom", customAdapter);
```

---

# Events

IdAddressBuilder exposes lifecycle events for observing and controlling the cascade.

---

## onLevelLoaded

Triggered when a level finishes loading.

```javascript
builder.onLevelLoaded((schema, data, complete) => {
  console.log(schema.name);
  console.log(data);
});
```

---

## onLevelChanged

Triggered when a level selection changes.

```javascript
builder.onLevelChanged((schema, data) => {
  console.log(schema.name);
  console.log(data);
});
```

---

## onGeocodeLoaded

Triggered when geocode data becomes available.

```javascript
builder.onGeocodeLoaded((schema, data) => {
  console.log(data);
});
```

---

# Schema API

Each administrative level is represented as a schema node.

Example levels:

- `propinsi`
- `kota`
- `kecamatan`
- `kelurahan`
- `kodepos`

---

## Schema Properties

| Property      | Description                    |
| ------------- | ------------------------------ |
| `name`        | Current level name             |
| `adapterName` | Active adapter                 |
| `adapter`     | Adapter instance               |
| `el`          | DOM element or virtual node    |
| `next`        | Next schema node               |
| `index`       | Level index                    |
| `isDropdown`  | Whether level is selectable    |
| `getDetail()` | Get accumulated address detail |

---

## Schema Methods

### `schema.load(parentId, selectedValue?)`

Manually load options for the current level.

```javascript
await schema.load(parentId);
```

Example

```js
builder.onLevelLoaded(async (schema, data) => {
  if (schema.name === "propinsi") {
    console.log(data);

    // manually continue cascade
    await schema.next.load(data[0].propinsi_id);
  }
});
```

---

### `schema.select(selectedItem)`

Trigger a selection transition programmatically.

```javascript
await schema.select(selectedItem);
```

Example

```js
builder.onLevelLoaded((schema, data) => {
  dropdown.addEventListener("change", async (e) => {
    const selected = data.find((item) => {
      return item[`${schema.name}_id`] === Number(e.target.value);
    });
    await schema.select(selected);
  });
});
```

This automatically:

- updates detail state,
- clears child levels,
- loads next level,
- emits lifecycle events,
- optionally resolves geocode data.

---

# Reverse Postal-Code Lookup

Entering a postal code automatically reconstructs:

- province,
- city,
- district,
- sub-district,
- and postal-code detail.

This is handled internally by the cascade engine.

---

# Geocode Integration

Enable geocode support:

```javascript
const builder = new IdAddressBuilder({
  url: apiUrl,
  geocode: true,
});
```

Receive geocode data:

```javascript
builder.onGeocodeLoaded((schema, data) => {
  console.log(data);
});
```

---

# Lifecycle Management

IdAddressBuilder supports safe destruction and reinitialization.

```javascript
const builder = new IdAddressBuilder(options);

builder.init();

builder.destroy();
```

Destroy cleans:

- DOM listeners,
- adapters,
- internal lifecycle state,
- runtime references.

---

# Framework Integration

---

## Vanilla JS

```javascript
const builder = new IdAddressBuilder({
  url: apiUrl,
  container: document.getElementById("form"),
  useAdapter: "native",
});

builder.init();
```

---

## React

```jsx
import { useEffect, useRef } from "react";
import { IdAddressBuilder } from "indonesia-administrative-areas";

function AddressForm() {
  const containerRef = useRef();

  useEffect(() => {
    const builder = new IdAddressBuilder({
      url: apiUrl,
      container: containerRef.current,
      useAdapter: "native",
    });

    builder.init();

    return () => builder.destroy();
  }, []);

  return <div ref={containerRef} />;
}
```

---

## Angular (Headless Mode)

```typescript
this.builder = new IdAddressBuilder({
  url: this.apiUrl,
  headless: true,
});

this.builder.init();

this.builder.onLevelLoaded((schema, data) => {
  this.options[schema.name] = data;
});
```

```typescript
async onPropinsiChange(selected) {

  const schema =
    this.builder.schema.find(
      s => s.name === "propinsi"
    );

  await schema.select(selected);
}
```

---

## Vue

```vue
<script setup>
import { onMounted, onBeforeUnmount } from "vue";
import { IdAddressBuilder } from "indonesia-administrative-areas";

let builder;

onMounted(() => {
  builder = new IdAddressBuilder({
    url: apiUrl,
    container: document.getElementById("form"),
    useAdapter: "native",
  });

  builder.init();
});

onBeforeUnmount(() => {
  builder?.destroy();
});
</script>
```

---

# Cache System

IdAddressBuilder includes a persistent cache layer.

Features:

- LocalStorage-based cache
- Configurable TTL expiration
- Automatic expiration validation
- Cached hierarchical lookup optimization

---

# Server-Side REST API

The backend API is implemented using Google Apps Script and serves Indonesian administrative region data from Google Sheets.

---

## Spreadsheet Template

Duplicate the spreadsheet template:

[Google Spreadsheet Template](https://docs.google.com/spreadsheets/d/1tPKmIwF75q3-OCMyGzFMUO6VYTpAKWVqCBKng9h3m0s/copy)

---

## Apps Script Setup

1. Open the Apps Script editor from the spreadsheet.
2. Update the `SPREADSHEET_ID`.
3. Deploy as Web App.
4. Use the deployment URL as the builder `url`.

```javascript
const builder = new IdAddressBuilder({
  url: "https://script.google.com/macros/s/DEPLOYMENT_ID/exec",
});
```

## REST API Reference (optional)

IdAddressBuilder is powered by a lightweight REST API built with Google Apps Script.

Although the library provides a complete cascading engine and adapter system, the API itself can also be used independently through standard HTTP requests.

This allows integration with:

- backend systems,
- mobile applications,
- Angular/React/Vue apps,
- existing enterprise systems,
- or completely custom frontend implementations.

---

# Base Endpoint

```txt id="b2k1e8"
https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec
```

---

# Hierarchical Administrative Levels

The API follows Indonesia's administrative hierarchy:

```txt id="w4czv6"
Propinsi
    ↓
Kota / Kabupaten
    ↓
Kecamatan
    ↓
Kelurahan
    ↓
Kodepos
```

Each level is loaded using:

- `level`
- `parentId`

---

# Get Province List

## Request

```http id="kx3yb2"
GET /exec?level=propinsi
```

## Example

```txt id="n3lq4k"
https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?level=propinsi
```

## Response

```json id="2o3xq7"
[
  {
    "propinsi_id": 24,
    "propinsi_name": "KALIMANTAN UTARA"
  },
  {
    "propinsi_id": 25,
    "propinsi_name": "SULAWESI UTARA"
  }
]
```

---

# Get Kota / Kabupaten List

## Request

```http id="7uwl7m"
GET /exec?level=kota&parentId=<PROPINSI_ID>
```

## Example

```txt id="q6tqrm"
https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?level=kota&parentId=24
```

## Response

```json id="u6a1bq"
[
  {
    "kota_id": 341,
    "kota_name": "BULUNGAN (BULONGAN)"
  },
  {
    "kota_id": 342,
    "kota_name": "TANA TIDUNG"
  }
]
```

---

# Get Kecamatan List

## Request

```http id="7r3l7u"
GET /exec?level=kecamatan&parentId=<KOTA_ID>
```

## Example

```txt id="fq8z5m"
https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?level=kecamatan&parentId=342
```

## Response

```json id="v7hm1l"
[
  {
    "kecamatan_id": 5098,
    "kecamatan_name": "BETAYAU"
  },
  {
    "kecamatan_id": 5107,
    "kecamatan_name": "SESAYAP"
  }
]
```

---

# Get Kelurahan List

## Request

```http id="6vh1uo"
GET /exec?level=kelurahan&parentId=<KECAMATAN_ID>
```

## Example

```txt id="y7u3w8"
https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?level=kelurahan&parentId=5107
```

## Response

```json id="y3p8md"
[
  {
    "kelurahan_id": 62141,
    "kelurahan_name": "RIAN"
  },
  {
    "kelurahan_id": 62159,
    "kelurahan_name": "SEBAWANG"
  }
]
```

---

# Get Postal Code (Final Level)

## Request

```http id="v8z8jw"
GET /exec?level=kodepos&parentId=<KELURAHAN_ID>
```

## Example

```txt id="j3yq8w"
https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?level=kodepos&parentId=62141
```

## Response

```json id="7n2c6d"
[
  {
    "kodepos_id": 62154,
    "kodepos_name": 77152
  }
]
```

---

# Reverse Lookup by Postal Code

The API can reconstruct the administrative hierarchy from a postal code.

---

## Request

```http id="y5z1dr"
GET /exec?level=detail&kodepos=<KODEPOS>&location=false
```

## Example

```txt id="z2w4fe"
https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?level=detail&kodepos=96264&location=false
```

## Response

```json id="0x6j4z"
[
  {
    "kodepos_name": 96264,
    "kelurahan_id": 71182,
    "kelurahan_name": "BANDUNG REJO",
    "kecamatan_id": 5991,
    "kecamatan_name": "BOLIOHUTO (BOLIYOHUTO)",
    "kota_id": 408,
    "kota_name": "GORONTALO",
    "propinsi_id": 29,
    "propinsi_name": "GORONTALO"
  }
]
```

---

# Geocode Lookup

Set `location=true` to retrieve geolocation data.

---

## Request

```http id="9r2j4n"
GET /exec?level=detail&kodepos=<KODEPOS>&location=true
```

## Example

```txt id="5z9k4n"
https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?level=detail&kodepos=24473&location=true
```

## Response

```json id="1w4h8r"
[
  {
    "kelurahan_id": 19,
    "kecamatan_id": 18,
    "kota_id": 10,
    "propinsi_id": 1,
    "latitude": 4.2932389,
    "longitude": 98.18439550000001,
    "formatted_address": "Air Masin, Seuruway, Aceh Tamiang Regency, Aceh, Indonesia"
  }
]
```

---

# How IdAddressBuilder Uses the API

Internally, IdAddressBuilder orchestrates multiple API calls to construct the complete hierarchical detail object.

For example:

```txt id="3wwnmg"
Postal Code
    ↓
Detail Lookup
    ↓
Cascade Reconstruction
    ↓
Final Hierarchical Detail Object
```

The builder automatically transforms the API response into:

```json id="v9eq0m"
{
  "kodepos_name": 96264,
  "propinsi_id": 29,
  "propinsi_name": "GORONTALO",
  "kota_id": 408,
  "kota_name": "GORONTALO",
  "kecamatan_id": 5991,
  "kecamatan_name": "BOLIOHUTO (BOLIYOHUTO)",
  "kelurahan_id": 71182,
  "kelurahan_name": "BANDUNG REJO"
}
```

This reconstruction process is handled automatically by:

```javascript id="3mjlwm"
builder.getDetailByKodepos(kodepos);
```

---

# Query Parameters

| Parameter  | Description                              |
| ---------- | ---------------------------------------- |
| `level`    | Administrative level to query            |
| `parentId` | Parent region identifier                 |
| `kodepos`  | Postal code value                        |
| `location` | Enable geocode lookup (`true` / `false`) |

---

# Available Levels

| Level       | Description             |
| ----------- | ----------------------- |
| `propinsi`  | Province                |
| `kota`      | City / Regency          |
| `kecamatan` | District                |
| `kelurahan` | Sub-district / Village  |
| `kodepos`   | Postal code             |
| `detail`    | Reverse lookup endpoint |
| `geocode`   | Geolocation lookup      |

---

# API Design Philosophy

The API was intentionally designed to remain:

- lightweight,
- cache-friendly,
- hierarchical,
- composable,
- and framework-independent.

This allows developers to:

- use the full IdAddressBuilder engine,
- partially integrate the API,
- or completely build their own UI systems on top of the endpoints.

---

# Roadmap

- Bootstrap adapter
- Material UI adapter
- Select2 adapter
- Tailwind adapter
- Enhanced geocode providers
- Offline dataset support
- Dedicated Angular/React/Vue packages
- Stronger TypeScript typings

---

# License

MIT License.

---

# Contributing

Contributions, adapters, integrations, and improvements are welcome.

---

# Author

YMGH
