// Shared browser/CLI price rules. No network calls and no external dependencies.
(function (root) {
  "use strict";
  function ageDays(iso, now) {
    if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return NaN;
    var date = new Date(iso + "T00:00:00Z");
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return NaN;
    now = now || new Date();
    var today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.floor((today - date.getTime()) / 86400000);
  }
  function validSource(source) {
    try { return new URL(source).protocol === "https:"; } catch (error) { return false; }
  }
  function state(dish, freshDays, soonDays, now) {
    var days = ageDays(dish.chk, now);
    if (typeof dish.price !== "number" || !Number.isFinite(dish.price) || dish.price < 0 ||
        !Number.isFinite(days) || days < 0 || !validSource(dish.src) ||
        !["carta", "pdf", "toast", "square", "web", "agregador", "deliveroo", "foto"].includes(dish.ch)) return "none";
    if (days > freshDays) return "stale";
    return days >= freshDays - soonDays ? "soon" : "fresh";
  }
  var rules = { ageDays: ageDays, validSource: validSource, state: state };
  if (typeof module !== "undefined" && module.exports) module.exports = rules;
  else root.AntojoPriceRules = rules;
})(typeof globalThis !== "undefined" ? globalThis : this);
