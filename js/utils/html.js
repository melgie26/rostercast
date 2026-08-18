export const escapeHtml = (value = "") => String(value).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
export const formatMobile = (value) => /^\+1\d{10}$/.test(value) ? `(${value.slice(2, 5)}) ${value.slice(5, 8)}-${value.slice(8)}` : value;

