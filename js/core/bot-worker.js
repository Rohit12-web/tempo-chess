"use strict";
importScripts("engine.js", "bot.js");
self.onmessage = (event) => {
  const { id, state, options } = event.data;
  try {
    self.postMessage({ id, ...TempoBot.search(state, options) });
  } catch {
    self.postMessage({
      id,
      error: "The computer could not finish its search.",
    });
  }
};
