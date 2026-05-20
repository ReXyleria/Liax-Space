export function shouldRunInProcessWorkers() {
  return process.env.BACKGROUND_WORKER_MODE !== "external" || process.env.BACKGROUND_WORKER_ROLE === "worker";
}
