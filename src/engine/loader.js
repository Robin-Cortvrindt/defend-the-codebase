// Loads content modules one by one, so one broken file never stops the game.
export async function loadModules(paths, importFn = p => import(p)) {
  const loaded = [];
  const failed = [];
  for (const path of paths) {
    try {
      await importFn(path);
      loaded.push(path);
    } catch (error) {
      console.error(`[loader] skipped "${path}"`, error);
      failed.push({ path, error });
    }
  }
  return { loaded, failed };
}

// Loads the manifest itself. If it's broken (e.g. a typo), fall back to the core content list.
export async function loadManifest(url, fallback, importFn = p => import(p)) {
  try {
    const mod = await importFn(url);
    if (!Array.isArray(mod.CONTENT_URLS)) throw new Error('manifest has no CONTENT_URLS array');
    return mod.CONTENT_URLS;
  } catch (error) {
    console.error('[loader] manifest failed to load, using the core content list', error);
    return fallback;
  }
}
