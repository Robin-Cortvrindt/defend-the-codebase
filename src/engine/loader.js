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
