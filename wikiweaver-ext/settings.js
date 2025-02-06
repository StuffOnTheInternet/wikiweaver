export const Settings = {
  "local": StorageAPI(chrome.storage.local),
  "session": StorageAPI(chrome.storage.session),
}

function StorageAPI(storage) {
  const PREFIX = "__Settings__";
  const DEFAULT = "Default__";

  const get = async (key) => {
    return (await storage.get(PREFIX + key))[PREFIX + key];
  }

  const getAll = async () => {
    let entries = Object.keys(await storage.get())
      .filter(key => key.includes(PREFIX))
      .filter((key, idx, arr) => arr.indexOf(key) === idx)
      .map(key => key.replace(PREFIX, ""))
      .map(key => key.replace(DEFAULT, ""))
      .map(async key => [key, await Get(key)]);

    return Object.fromEntries(await Promise.all(entries));
  }

  const Get = async (key, optionalDefault) => {
    if (key === undefined) return await getAll();
    return (await get(key)) ?? (await get(DEFAULT + key)) ?? optionalDefault;
  }

  const Set = async (key, value) => {
    return (await storage.set({ [PREFIX + key]: value }));
  }

  const Remove = async (key) => {
    return (await storage.remove(PREFIX + key));
  }

  const Defaults = async (defaults) => {
    return Object.entries(defaults).forEach(([key, value]) => Set(DEFAULT + key, value))
  }

  const API = {
    "Get": Get,
    "Set": Set,
    "Remove": Remove,
    "Defaults": Defaults,
  }

  return API;
};

