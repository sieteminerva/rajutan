interface iHttpServiceConfig {
  url: string;
  timeout: number;
  delay: number;
  cacheEnabled: boolean;
  cachePrefix: string;
  cacheTtlDays: number;
}

type iCacheEntry = Record<"data" | "expire", any | number>;

export class HttpService {

  /**
   * @property {boolean} _destroyed
   * @description Whether this instance has been destroyed and should ignore async work.
   */
  _destroyed: boolean = false;

  /**
   * @property {Set<AbortController>} _abortControllers
   * @description Active request controllers used to cancel pending API calls.
   */
  _abortControllers: Set<AbortController> = new Set();

  /**
   * @property {iHttpServiceConfig} _config
   * @description Merged runtime configuration for API, cache, text, container, and adapter behavior.
   */
  config;

  constructor(config: iHttpServiceConfig) {
    const defaultConfig: Required<iHttpServiceConfig> = {
      url: "",
      cacheEnabled: false,
      cacheTtlDays: 1,
      cachePrefix: "app",
      timeout: 10000,
      delay: 1000
    }
    this.config = { ...defaultConfig, ...config };
    if (this.config.cacheEnabled) {
      this._validateCache()
    }
  }

  /**
   * Retrieves administrative regional data either from the local cache or by calling the remote API.
   *
   * @param {Object} [query={}] - The query parameters for the data request.
   * @returns {Promise<Array|Object>} A promise that resolves to the requested regional data.
   * @throws {Error} If the API request fails or cache retrieval encounters a critical error.
   *
   * @example
   * const cities = await service.get({ level: 'kota', parentId: 11 });
   *
   * @description
   * This method acts as a data proxy. It generates a unique cache key based on the query parameters,
   * checks if valid data exists in `localStorage`, and if not, performs a network fetch.
   * To ensure a consistent UI experience, it introduces a configurable artificial delay
   * when serving data from the cache.
   */
  async get(query: any): Promise<any[] | Object> {

    // Step 1: Generate a unique key based on query.
    const cacheKey = this._constructCacheKey(query, "get");

    let isLocal = false;
    let data = null;

    // Step 3: Attempt to load data from local storage if caching is enabled.
    if (this.config.cacheEnabled) {
      const cached = this._loadCache(cacheKey);
      if (cached) {
        isLocal = true;
        data = cached;
      }
    }

    // Step 4: If no cached data is found, fetch from the API and update the cache.
    if (!data) {
      isLocal = false;
      data = await this._fetchAPI(query);
      if (this.config.cacheEnabled) {
        this._writeCache(cacheKey, data);
      }
    }

    // Step 5: Return a promise that resolves immediately for API data,
    // or after a configured delay for cached data to simulate network feel.
    try {
      if (isLocal && this.config.delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.config.delay));
      }
      console.log(`[${query}] Data loaded from ${isLocal ? "cache" : "API"}:`, data);
      return data;
    } catch (error) {
      localStorage.removeItem(`${this.config.cachePrefix}:${cacheKey}`);
      throw error; // Propagates the error properly to the caller
    }
  }

  /**
   * Submits data to the remote API using a POST request and caches the successful response.
   *
   * @param {Object} query - Configuration parameter to determine the cache structural key.
   * @param {Object} payload - The JavaScript object containing the body data to be sent as JSON.
   * @returns {Promise<Array|Object>} A promise that resolves to the processed data returned by the API.
   * @throws {Error} If the API request fails.
   */
  async post(query: any, payload: any): Promise<any[] | Object> {
    // 1. Jalankan request POST ke API menggunakan core fetch service Anda
    const fetchOptions: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    };

    // Jika terjadi eror di sini, proses otomatis berhenti (tidak akan lanjut ke bawah)
    const data = await this._fetchAPI(query, fetchOptions);

    // 2. Jika caching aktif, buat key unik baru kemudian simpan hasil suksesnya
    if (this.config.cacheEnabled) {
      const cacheKey = this._constructCacheKey(query, "post");
      this._writeCache(cacheKey, data);
    }

    console.log(`[POST][${query}] Data successfully processed via API:`, data);
    return data;
  }


  /**
   * Constructing key for storing data in `localStorage` cache
   * @param query 
   * @param suffix 
   * @returns Cache Key for `localStorage`
   */
  private _constructCacheKey(query: any, suffix: string): string {
    const key = Object.keys(query).join("-");
    return `${key}-${suffix}`;
  }
  /**
   * Performs a network request to the configured API endpoint with automatic timeout and abort handling.
   *
   * @param {Object} [query={}] - Key-value pairs to be appended as URL search parameters.
   * @param {RequestInit} [options={}] - Standard fetch options (method, headers, etc.).
   * @param {number} [timeout=10000] - Maximum time in milliseconds to wait before aborting the request.
   * @returns {Promise<any>} A promise that resolves to the 'data' property of the successful JSON response.
   * @throws {Error} If the request times out, returns a non-2xx status, or the JSON payload indicates failure.
   *
   * @example
   * const data = await service._fetchAPI({ level: 'propinsi' });
   *
   * @description
   * This method wraps the native `fetch` API with a lifecycle management system. It creates an
   * `AbortController` for every request, registers it in an internal set for cleanup during
   * instance destruction, and sets a timer to trigger an abort if the server doesn't respond
   * within the specified window. It also normalizes the API response format.
   */
  async _fetchAPI(query = {}, options: RequestInit = {}, timeout = 10000) {
    // Step 1: Guard against execution if the builder instance has been destroyed.
    if (this._destroyed) return;

    // Step 2: Initialize AbortController and register it for global cleanup.
    const controller = new AbortController();
    this._abortControllers.add(controller);

    // Step 3: Set up a timer to automatically abort the request on timeout.

    // 4. Fixed: Used the modern `AbortSignal.timeout()` utility if available, 
    // falling back cleanly to the manual setTimeout mechanism.
    const requestTimeout = this.config.timeout ?? timeout;
    let timeoutId: any;

    if (typeof AbortSignal.timeout === 'function') {
      // Modern way to auto-abort
      options.signal = AbortSignal.any([controller.signal, AbortSignal.timeout(requestTimeout)]);
    } else {
      timeoutId = setTimeout(() => controller.abort(), requestTimeout);
      options.signal = controller.signal;
    }

    // Step 4: Construct the final URL by appending sanitized query parameters.
    const baseUrl = this.config.url.replace(/\/+$/, "");
    const params = new URLSearchParams();

    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) params.append(k, v as string);
    }
    const url = params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
    console.log(`[Query]:`, query);
    console.log(`[Endpoint]:`, url);
    try {
      // Step 5: Execute the network request with the abort signal attached.
      const res = await fetch(url, options);

      // Step 6: Clear the timeout immediately upon receiving a response.
      if (timeoutId) clearTimeout(timeoutId);

      // Step 7: Validate HTTP status codes (4xx and 5xx are treated as errors).
      if (!res.ok) {
        throw new Error(res.statusText || `HTTP Error ${res.status}`);
      }

      // Step 8: Parse JSON and validate the application-level success flag.
      const json = await res.json();
      if (json && json.success) {
        return json.data;
      }
      throw new Error(json?.message || "Invalid response");
    } catch (err) {
      // Step 9: Handle errors, specifically distinguishing between manual aborts and timeouts.
      console.error("❌ Fetching Data Faild", err);
      if (timeoutId) clearTimeout(timeoutId);

      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("Request timed out");
      }
      throw err;
    } finally {
      // Step 10: Cleanup the controller reference and re-throw the error for the caller.
      this._abortControllers.delete(controller);
    }
  }

  // ============================
  // 💾 CACHING HELPERS
  // ============================

  /**
   * Checks whether the builder cache is still valid and clears expired entries when needed.
   *
   * @param {boolean} [clearNow=false] - Forces cache clearing even when the stored expiration is still valid.
   * @returns {void} Does not return a value; it updates `localStorage` cache metadata as a side effect.
   * @throws {void} Storage errors are caught and logged instead of being thrown.
   *
   * @example
   * const service = new HttpService({ url: '/api/address', cacheEnabled: true });
   * service._validateCache(true); // Force all HttpService cache entries to be refreshed.
   *
   * @description
   * How it works: the method reads the cache expiration marker, exits early when the marker
   * is still in the future, otherwise removes every `localStorage` item using the configured
   * cache prefix and writes a new expiration timestamp based on `cache.ttlDays`.
   */
  _validateCache(clearNow: boolean = false) {
    if (!this.config.cacheEnabled) return;

    try {
      // Step 1: Build the metadata key used to track the global cache expiration time.
      const expiredTimeKey = `${this.config.cachePrefix}:expired-time`;

      // Step 2: Read the stored expiration timestamp and capture the current time.
      const storedExpiredTime = localStorage.getItem(expiredTimeKey);
      const now = Date.now();

      // Step 3: Keep the cache when a valid future expiration exists and no forced clear was requested.
      if (!clearNow || (storedExpiredTime && parseInt(storedExpiredTime, 10) <= now)) {

        // Step 4: Remove all cached items that belong to this builder prefix.
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key?.startsWith(this.config.cachePrefix + ":")) {
            localStorage.removeItem(key);
          }
        }
        // Step 5: Convert the configured TTL from days to milliseconds.
        const ttl = this.config.cacheTtlDays * 24 * 3600 * 1000;

        // Step 6: Store the next expiration timestamp for future cache validation checks.
        localStorage.setItem(expiredTimeKey, (now + ttl).toString());

        console.info(`Cache namespace synchronized and cleared.`);
      } else if (!storedExpiredTime) {
        // Initialize the global track key if it does not exist yet
        const ttl = this.config.cacheTtlDays * 24 * 3600 * 1000;
        localStorage.setItem(expiredTimeKey, (now + ttl).toString());
      }
    } catch (error) {
      console.warn("Cache clear failed", error);
    }
  }

  /**
   * Writes one API response payload into the configured `localStorage` cache namespace.
   *
   * @param {string} key - Cache key suffix, without the configured prefix.
   * @param {*} data - Serializable data to store in the cache entry.
   * @returns {void} Does not return a value; it persists the cache entry in `localStorage`.
   * @throws {Error} Throws `Cache write failed` when serialization or storage fails.
   *
   * @example
   * service._writeCache('propinsi-root', [{ propinsi_id: 31, propinsi_name: 'DKI Jakarta' }]);
   *
   * @description
   * How it works: the method computes an absolute expiration time from `cache.ttlDays`,
   * wraps the payload and expiration in a cache entry object, serializes it to JSON,
   * and stores it under `<prefix>:<key>`.
   */
  _writeCache(key: string, data: any) {
    try {
      // Step 1: Convert the configured cache lifetime from days to milliseconds.
      const ttl = this.config.cacheTtlDays * 24 * 3600 * 1000;

      // Step 2: Wrap the payload with its absolute expiration timestamp.
      const obj: iCacheEntry = { data, expire: Date.now() + ttl };

      // Step 3: Serialize and persist the entry under the configured cache namespace.
      localStorage.setItem(`${this.config.cachePrefix}:${key}`, JSON.stringify(obj));
    } catch (error) {
      // Step 4: Promote storage failures to callers that depend on successful cache writes.
      // 1. Fixed: Handle full localStorage elegantly.
      console.warn("⚠️ localStorage quota exceeded or unavailable. Skipping write.", error);

      // Optional: Proactively clear out expired data to free up space
      this._purgeExpiredKeysOnly();
    }
  }

  /**
   * Reads one cached API response payload from the configured `localStorage` cache namespace.
   *
   * @param {string} key - Cache key suffix, without the configured prefix.
   * @returns {*|null} Returns cached data when present, otherwise `null`.
   * @throws {void} Read and parse errors are caught and logged instead of being thrown.
   *
   * @example
   * const cachedCities = service._loadCache('propinsi-31');
   * if (cachedCities) {
   *   console.log(cachedCities.length);
   * }
   *
   * @description
   * How it works: the method builds the namespaced cache key, reads the raw JSON string
   * from `localStorage`, parses it into a cache entry, removes stale or invalid entries,
   * and returns only the stored `data` payload.
   */
  _loadCache(key: string) {
    const storageKey = `${this.config.cachePrefix}:${key}`;
    try {
      // Step 1: Read the serialized cache entry from the configured namespace.
      const raw = localStorage.getItem(storageKey);

      // Step 2: Return null when no cache entry exists for the requested key.
      if (!raw) return null;

      // Step 3: Parse the cache entry JSON into an object.
      const obj: iCacheEntry = JSON.parse(raw);

      // Step 4: Remove stale cache entries and continue with a remote fetch.
      if (!obj || typeof obj.expire !== "number" || obj.expire <= Date.now()) {
        localStorage.removeItem(storageKey);
        return null;
      }

      // Step 5: Return the cached payload.
      return obj.data;
    } catch (error) {
      // Step 6: Log cache read failures without breaking the main API fetch flow.
      console.warn("Cache load failed", error);
      localStorage.removeItem(storageKey);
      return null;
    }
  }

  /**
  * Helper utility to safely clean out stale data when space runs tight
  * without destroying freshly cached items.
  */
  private _purgeExpiredKeysOnly() {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.startsWith(this.config.cachePrefix + ":") && !key.endsWith(":expired-time")) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const obj = JSON.parse(raw);
            if (obj && typeof obj.expire === "number" && obj.expire <= Date.now()) {
              localStorage.removeItem(key);
            }
          }
        }
      }
    } catch (e) {
      // Fail-silent helper
    }
  }
}