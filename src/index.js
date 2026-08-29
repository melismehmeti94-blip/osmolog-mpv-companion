"use strict";

const { CompanionService, mpvConfigContainsPipe } = require("./service");

const logger = {
  info: message => console.log(`[Osmolog] ${message}`),
  warn: message => console.warn(`[Osmolog] Warning: ${message}`),
  error: message => console.error(`[Osmolog] Error: ${message}`)
};

async function main() {
  const service = new CompanionService({ logger });
  await service.start();
  const stop = signal => service.shutdown(signal).then(() => { process.exitCode = 0; });
  process.on("SIGINT", () => void stop("SIGINT"));
  process.on("SIGTERM", () => void stop("SIGTERM"));
  process.on("uncaughtException", error => {
    logger.error(error.stack || error.message);
    process.exitCode = 1;
  });
  process.on("unhandledRejection", error => logger.error(error?.stack || String(error)));
  return service;
}

if (require.main === module) {
  main().catch(error => {
    logger.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = { main, mpvConfigContainsPipe };
