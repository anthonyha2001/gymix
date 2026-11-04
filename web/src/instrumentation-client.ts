import { reportClientError } from "@/lib/report-error";

// Uncaught browser errors and rejected promises go to the super admin's Errors tab.
window.addEventListener("error", (event) => reportClientError(event.error ?? event.message));
window.addEventListener("unhandledrejection", (event) => reportClientError(event.reason));
