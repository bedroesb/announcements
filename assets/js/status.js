/*
 * Status page behaviour - vanilla JS, no dependencies.
 *
 * The page is rendered by Jekyll with the state it had at build time, so it is
 * correct and complete without JavaScript. In the browser this script takes
 * over and recomputes everything from the timestamps in the markup:
 *
 *   - which entries are scheduled / ongoing / closed, and in which list they
 *     belong (so an incident drops into the history timeline the minute its
 *     end time passes - no rebuild, no cron job)
 *   - the banner at the top and the per-service badges
 *   - durations and "2 hours ago" labels
 *   - filtering and searching of the history, mirrored in the URL
 *
 * The vocabulary (labels, colours, icons) comes from _data/levels.yml via the
 * JSON block in index.html; nothing about severities is hard-coded here.
 */
(function () {
  "use strict";

  var MINUTE = 60000;

  /* ------------------------------------------------------------------ *
   * Time helpers
   * ------------------------------------------------------------------ */

  var UNITS = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];

  function parse(iso) {
    if (!iso) return null;
    var date = new Date(iso);
    return isNaN(date.getTime()) ? null : date;
  }

  function relativeTime(date) {
    if (!date || typeof Intl === "undefined" || !Intl.RelativeTimeFormat) return "";
    var rtf = new Intl.RelativeTimeFormat(document.documentElement.lang || "en", {
      numeric: "auto",
    });
    var seconds = (date.getTime() - Date.now()) / 1000;

    for (var i = 0; i < UNITS.length; i++) {
      if (Math.abs(seconds) >= UNITS[i][1]) {
        return rtf.format(Math.round(seconds / UNITS[i][1]), UNITS[i][0]);
      }
    }
    return rtf.format(Math.round(seconds), "second");
  }

  function formatDuration(seconds) {
    seconds = Math.max(0, Math.round(seconds));
    var days = Math.floor(seconds / 86400);
    var hours = Math.floor((seconds % 86400) / 3600);
    var minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return hours > 0 ? days + " d " + hours + " h" : days + " d";
    if (hours > 0) return minutes > 0 ? hours + " h " + minutes + " min" : hours + " h";
    if (minutes > 0) return minutes + " min";
    return "< 1 min";
  }

  function renderRelativeTimes() {
    document.querySelectorAll(".js-relative[data-time]").forEach(function (el) {
      var text = relativeTime(parse(el.getAttribute("data-time")));
      el.textContent = text ? " (" + text + ")" : "";
    });
  }

  /* ------------------------------------------------------------------ *
   * Vocabulary
   * ------------------------------------------------------------------ */

  var LEVELS = {};
  var levelsNode = document.getElementById("levels-data");
  if (levelsNode) {
    try {
      LEVELS = JSON.parse(levelsNode.textContent);
    } catch (e) {
      LEVELS = {};
    }
  }

  function level(key) {
    return LEVELS[key] || LEVELS.info || { label: key, rank: 0, dot: "bg-slate-400" };
  }

  var CARD_HISTORY = ["border-slate-200", "bg-white", "hover:border-vib-200"];

  function classesOf(value) {
    return (value || "").split(/\s+/).filter(Boolean);
  }

  function stateOf(el, now) {
    var start = parse(el.getAttribute("data-start"));
    var end = parse(el.getAttribute("data-end"));
    if (end && end.getTime() <= now) return "closed";
    if (start && start.getTime() > now) return "scheduled";
    return "ongoing";
  }

  function icon(id) {
    var tpl = document.getElementById(id);
    return tpl ? tpl.content.cloneNode(true) : null;
  }

  /* ------------------------------------------------------------------ *
   * Entry chrome: status pill, labels, duration
   * ------------------------------------------------------------------ */

  function pillContents(state, kind, levelKey) {
    var frag = document.createDocumentFragment();
    var label;

    if (state === "ongoing") {
      // Pulsing dot in the colour of the severity.
      var wrap = document.createElement("span");
      wrap.className = "relative flex h-2 w-2";
      var ping = document.createElement("span");
      ping.className =
        "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 " +
        level(levelKey).dot;
      var core = document.createElement("span");
      core.className = "relative inline-flex h-2 w-2 rounded-full " + level(levelKey).dot;
      wrap.appendChild(ping);
      wrap.appendChild(core);
      frag.appendChild(wrap);
      label = kind === "announcement" ? "Current" : "Ongoing";
    } else if (state === "scheduled") {
      var scheduledIcon = icon("pill-scheduled");
      if (scheduledIcon) frag.appendChild(scheduledIcon);
      label = "Scheduled";
    } else {
      var closedIcon = icon("pill-closed");
      if (closedIcon) frag.appendChild(closedIcon);
      label = kind === "announcement" ? "Closed" : "Resolved";
    }

    var text = document.createElement("span");
    text.className = "js-pill-label";
    text.textContent = label;
    frag.appendChild(text);
    return frag;
  }

  function setText(root, selector, text) {
    var el = root.querySelector(selector);
    if (el) el.textContent = text;
  }

  function setHidden(root, selector, hidden) {
    var el = root.querySelector(selector);
    if (el) el.hidden = hidden;
  }

  // Updates everything on a card that depends on the current time.
  function paintEntry(el, state) {
    var kind = el.getAttribute("data-kind");
    var levelKey = el.getAttribute("data-level");
    var hasEnd = !!el.getAttribute("data-end");

    var pill = el.querySelector(".js-status-pill");
    if (pill) {
      pill.textContent = "";
      pill.appendChild(pillContents(state, kind, levelKey));
    }

    setText(el, ".js-start-label", state === "scheduled" ? "Starts" : "Started");
    setHidden(el, ".js-end-row", !hasEnd);
    setText(el, ".js-end-label", state === "closed" ? "Ended" : "Expected until");
    var durationLabel =
      state === "closed"
        ? "Duration"
        : state === "scheduled"
          ? "Planned"
          : kind === "announcement"
            ? "Running for"
            : "Open for";
    setText(el, ".js-duration-label", durationLabel);
    setHidden(el, ".js-latest-update", state === "closed");

    var card = el.querySelector(".entry-card");
    if (card) {
      var active = classesOf(level(levelKey).card);
      if (state === "closed") {
        active.forEach(function (c) {
          card.classList.remove(c);
        });
        CARD_HISTORY.forEach(function (c) {
          card.classList.add(c);
        });
      } else {
        CARD_HISTORY.forEach(function (c) {
          card.classList.remove(c);
        });
        active.forEach(function (c) {
          card.classList.add(c);
        });
      }
    }

    el.setAttribute("data-state", state);
  }

  // Duration ticks on its own, without touching the rest of the card.
  function paintDuration(el, state, now) {
    var node = el.querySelector(".js-duration");
    if (!node) return;
    var start = parse(el.getAttribute("data-start"));
    var end = parse(el.getAttribute("data-end"));
    if (!start) return;

    var seconds =
      state === "ongoing" || !end
        ? (now - start.getTime()) / 1000
        : (end.getTime() - start.getTime()) / 1000;
    node.textContent = formatDuration(seconds);
  }

  /* ------------------------------------------------------------------ *
   * Detail page (a single incident or announcement)
   * ------------------------------------------------------------------ */

  var detail = document.querySelector(".js-entry-state");
  if (detail) {
    (function paintDetail() {
      var now = Date.now();
      var state = stateOf(detail, now);
      var kind = detail.getAttribute("data-kind");

      var pill = detail.querySelector(".js-status-pill");
      if (pill) {
        pill.textContent = "";
        pill.appendChild(pillContents(state, kind, detail.getAttribute("data-level")));
      }
      setText(detail, ".js-duration-label", state === "scheduled" ? "Planned" : "Duration");
      setHidden(detail, ".js-end-note", state === "closed");
      setHidden(detail, ".js-duration-note", state !== "ongoing");
      paintDuration(detail, state, now);
      renderRelativeTimes();

      setTimeout(paintDetail, MINUTE);
    })();
  }

  /* ------------------------------------------------------------------ *
   * Status page
   * ------------------------------------------------------------------ */

  var timeline = document.getElementById("timeline");
  if (!timeline) {
    renderRelativeTimes();
    return;
  }

  var activeList = document.getElementById("active-list");
  var scheduledList = document.getElementById("scheduled-list");
  var activeSection = document.getElementById("active");
  var scheduledSection = document.getElementById("scheduled");
  var historyEmpty = document.getElementById("history-empty");

  var entries = Array.prototype.slice.call(document.querySelectorAll(".js-entry"));

  var searchInput = document.getElementById("search");
  var searchClear = document.getElementById("search-clear");
  var levelSelect = document.getElementById("level-filter");
  var kindButtons = Array.prototype.slice.call(document.querySelectorAll("[data-kind-filter]"));
  var chipsWrap = document.getElementById("active-filters");
  var chips = document.getElementById("filter-chips");
  var resultCount = document.getElementById("result-count");
  var totalCount = document.getElementById("total-count");
  var noResults = document.getElementById("no-results");

  var TAB_ON = ["bg-white", "text-vib-800", "shadow-sm"];
  var TAB_OFF = ["text-slate-600", "hover:text-slate-900"];
  var KIND_LABELS = { incident: "Incidents", announcement: "Announcements" };

  var serviceNames = {};
  document.querySelectorAll(".js-service-tile").forEach(function (el) {
    var id = el.getAttribute("data-service-filter");
    var label = el.querySelector(".truncate");
    serviceNames[id] = label ? label.textContent.trim() : id;
  });

  var state = { q: "", kind: "all", level: "", services: [] };

  /* ---------- placement: who goes where ---------- */

  function sortNodes(nodes, direction) {
    return nodes.slice().sort(function (a, b) {
      var ta = parse(a.getAttribute("data-start"));
      var tb = parse(b.getAttribute("data-start"));
      var diff = (ta ? ta.getTime() : 0) - (tb ? tb.getTime() : 0);
      return direction === "asc" ? diff : -diff;
    });
  }

  // Re-appending nodes restarts CSS animations, so only touch the DOM when the
  // order actually changed.
  function reorder(container, wanted) {
    var current = Array.prototype.slice.call(container.children);
    var same =
      current.length === wanted.length &&
      wanted.every(function (node, i) {
        return current[i] === node;
      });
    if (same) return;
    wanted.forEach(function (node) {
      container.appendChild(node);
    });
  }

  function placeEntries(now) {
    var buckets = { ongoing: [], scheduled: [], closed: [] };

    entries.forEach(function (el) {
      var current = stateOf(el, now);
      buckets[current].push(el);
      if (el.getAttribute("data-state") !== current) paintEntry(el, current);
      paintDuration(el, current, now);
    });

    reorder(activeList, sortNodes(buckets.ongoing, "desc"));
    reorder(scheduledList, sortNodes(buckets.scheduled, "asc"));
    reorder(timeline, sortNodes(buckets.closed, "desc"));

    activeSection.hidden = buckets.ongoing.length === 0;
    scheduledSection.hidden = buckets.scheduled.length === 0;
    if (historyEmpty) historyEmpty.hidden = buckets.closed.length > 0;

    setText(document, "#active-count", String(buckets.ongoing.length));
    setText(document, "#scheduled-count", String(buckets.scheduled.length));
    if (totalCount) totalCount.textContent = String(buckets.closed.length);

    return buckets;
  }

  /* ---------- banner + service badges ---------- */

  function worstOf(list) {
    var best = null;
    list.forEach(function (el) {
      var key = el.getAttribute("data-level");
      if (!best || level(key).rank > level(best).rank) best = key;
    });
    return best;
  }

  function paintBanner(ongoing) {
    var iconBox = document.getElementById("status-icon");
    var headline = document.getElementById("status-headline");
    var sub = document.getElementById("status-sub");
    var action = document.getElementById("status-action");
    var actionLabel = document.getElementById("status-action-label");
    if (!iconBox || !headline || !sub) return;

    var incidents = ongoing.filter(function (el) {
      return el.getAttribute("data-kind") === "incident";
    });
    var base = "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ";

    if (incidents.length) {
      var key = worstOf(incidents);
      iconBox.className = base + level(key).icon_bg + " " + level(key).icon_text;
      iconBox.textContent = "";
      var levelIcon = icon("icon-" + key);
      if (levelIcon) iconBox.appendChild(levelIcon);

      headline.textContent =
        incidents.length + " ongoing incident" + (incidents.length > 1 ? "s" : "");
      sub.textContent = level(key).description || "";
      if (action) action.setAttribute("href", "#active");
      if (actionLabel) actionLabel.textContent = "View details";
    } else {
      iconBox.className = base + "bg-emerald-100 text-emerald-600";
      iconBox.textContent = "";
      var okIcon = icon("icon-ok");
      if (okIcon) iconBox.appendChild(okIcon);

      headline.textContent = "All systems operational";
      sub.textContent = "No ongoing incidents.";
      if (action) action.setAttribute("href", "#history");
      if (actionLabel) actionLabel.textContent = "View history";
    }
  }

  function paintServices(ongoing) {
    document.querySelectorAll(".js-service-tile").forEach(function (tile) {
      var id = tile.getAttribute("data-service-filter");
      var key = null;

      ongoing.forEach(function (el) {
        if ((el.getAttribute("data-services") || "").split(/\s+/).indexOf(id) === -1) return;
        var candidate = el.getAttribute("data-level");
        // Purely informational entries do not change a service badge.
        if (level(candidate).rank < 10) return;
        if (!key || level(candidate).rank > level(key).rank) key = candidate;
      });

      var dot = tile.querySelector(".js-service-dot");
      var status = tile.querySelector(".js-service-status");
      if (dot) {
        dot.className =
          "js-service-dot h-2 w-2 shrink-0 rounded-full " +
          (key ? level(key).dot : "bg-emerald-500");
      }
      if (status) status.textContent = key ? level(key).label : "Operational";
    });
  }

  /* ---------- filtering ---------- */

  function readUrl() {
    var params = new URLSearchParams(window.location.search);
    var services = params.get("services");

    state.q = params.get("q") || "";
    state.kind = params.get("kind") || "all";
    state.level = params.get("level") || "";
    state.services = services
      ? services
          .split(",")
          .map(function (s) {
            return s.trim();
          })
          .filter(Boolean)
      : [];

    if (!KIND_LABELS[state.kind]) state.kind = "all";
    if (state.level && !LEVELS[state.level]) state.level = "";
  }

  function writeUrl() {
    var params = new URLSearchParams();
    if (state.q) params.set("q", state.q);
    if (state.kind !== "all") params.set("kind", state.kind);
    if (state.level) params.set("level", state.level);
    if (state.services.length) params.set("services", state.services.join(","));

    var query = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (query ? "?" + query : "") + window.location.hash
    );
  }

  function matches(el) {
    if (state.kind !== "all" && el.getAttribute("data-kind") !== state.kind) return false;
    if (state.level && el.getAttribute("data-level") !== state.level) return false;

    if (state.services.length) {
      var owned = (el.getAttribute("data-services") || "").split(/\s+/);
      // Stacking services widens the view: match any of them.
      var hit = state.services.some(function (id) {
        return owned.indexOf(id) !== -1;
      });
      if (!hit) return false;
    }

    if (state.q) {
      var haystack = el.getAttribute("data-search") || "";
      var ok = state.q
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .every(function (needle) {
          return haystack.indexOf(needle) !== -1;
        });
      if (!ok) return false;
    }

    return true;
  }

  function applyFilters() {
    var visible = 0;
    var previousMonth = null;

    Array.prototype.slice.call(timeline.children).forEach(function (el) {
      var ok = matches(el);
      el.hidden = !ok;
      if (!ok) return;

      visible++;
      // Show a month heading on the first visible entry of each month.
      var month = el.getAttribute("data-month");
      var label = el.querySelector(".js-month-label");
      if (label) label.hidden = month === previousMonth;
      previousMonth = month;
    });

    if (resultCount) resultCount.textContent = String(visible);
    if (noResults) noResults.hidden = visible !== 0 || timeline.children.length === 0;

    renderChips();
    syncControls();
    writeUrl();
  }

  /* ---------- controls ---------- */

  function syncControls() {
    if (searchInput && searchInput.value !== state.q) searchInput.value = state.q;
    if (searchClear) searchClear.hidden = !state.q;
    if (levelSelect) levelSelect.value = state.level;

    kindButtons.forEach(function (btn) {
      var on = btn.getAttribute("data-kind-filter") === state.kind;
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      TAB_ON.forEach(function (c) {
        btn.classList.toggle(c, on);
      });
      TAB_OFF.forEach(function (c) {
        btn.classList.toggle(c, !on);
      });
    });

    document.querySelectorAll("[data-service-filter]").forEach(function (el) {
      var on = state.services.indexOf(el.getAttribute("data-service-filter")) !== -1;
      el.classList.toggle("ring-vib-400", on);
      el.classList.toggle("bg-vib-50", on);
    });
  }

  function chipButton(label, type, value) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "inline-flex items-center gap-1.5 rounded-lg bg-vib-50 px-2.5 py-1 text-xs font-semibold text-vib-800 ring-1 ring-inset ring-vib-200 transition hover:bg-vib-100";
    btn.setAttribute("data-remove-filter", type);
    btn.setAttribute("data-value", value);
    btn.setAttribute("aria-label", "Remove filter " + label);
    btn.appendChild(document.createTextNode(label));

    var cross = icon("pill-close");
    if (cross) {
      btn.appendChild(cross);
    } else {
      var x = document.createElement("span");
      x.className = "text-sm leading-none opacity-60";
      x.textContent = "×";
      btn.appendChild(x);
    }
    return btn;
  }

  function renderChips() {
    if (!chips || !chipsWrap) return;
    chips.textContent = "";

    state.services.forEach(function (id) {
      chips.appendChild(chipButton(serviceNames[id] || id, "service", id));
    });
    if (state.kind !== "all") {
      chips.appendChild(chipButton(KIND_LABELS[state.kind], "kind", state.kind));
    }
    if (state.level) {
      chips.appendChild(chipButton(level(state.level).label, "level", state.level));
    }
    if (state.q) {
      chips.appendChild(chipButton('"' + state.q + '"', "q", state.q));
    }

    chipsWrap.hidden = chips.childElementCount === 0;
  }

  function toggleService(id) {
    var i = state.services.indexOf(id);
    if (i === -1) {
      state.services.push(id);
      return true;
    }
    state.services.splice(i, 1);
    return false;
  }

  /* ---------- refresh loop ---------- */

  function refresh() {
    var now = Date.now();
    var buckets = placeEntries(now);
    paintBanner(buckets.ongoing);
    paintServices(buckets.ongoing);
    renderRelativeTimes();
    applyFilters();
  }

  /* ---------- events ---------- */

  document.addEventListener("click", function (event) {
    var tag = event.target.closest("[data-service-filter]");
    if (tag) {
      event.preventDefault();
      var added = toggleService(tag.getAttribute("data-service-filter"));
      applyFilters();
      if (added) {
        var history = document.getElementById("history");
        if (history && history.getBoundingClientRect().top < 0) {
          history.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
      return;
    }

    var chip = event.target.closest("[data-remove-filter]");
    if (chip) {
      var type = chip.getAttribute("data-remove-filter");
      if (type === "service") toggleService(chip.getAttribute("data-value"));
      if (type === "kind") state.kind = "all";
      if (type === "level") state.level = "";
      if (type === "q") state.q = "";
      applyFilters();
      return;
    }

    var kindBtn = event.target.closest("[data-kind-filter]");
    if (kindBtn) {
      state.kind = kindBtn.getAttribute("data-kind-filter");
      applyFilters();
      return;
    }

    if (event.target.closest("#clear-filters, #clear-filters-empty")) {
      state.q = "";
      state.kind = "all";
      state.level = "";
      state.services = [];
      applyFilters();
    }
  });

  if (searchInput) {
    var timer = null;
    searchInput.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        state.q = searchInput.value.trim();
        applyFilters();
      }, 140);
    });
    searchInput.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && searchInput.value) {
        event.preventDefault();
        searchInput.value = "";
        state.q = "";
        applyFilters();
      }
    });
  }

  if (searchClear) {
    searchClear.addEventListener("click", function () {
      state.q = "";
      applyFilters();
      if (searchInput) searchInput.focus();
    });
  }

  if (levelSelect) {
    levelSelect.addEventListener("change", function () {
      state.level = levelSelect.value;
      applyFilters();
    });
  }

  // "/" jumps to the search box.
  document.addEventListener("keydown", function (event) {
    if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
    var tag = (event.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if (!searchInput) return;
    event.preventDefault();
    searchInput.focus();
  });

  readUrl();
  refresh();
  setInterval(refresh, MINUTE);
})();
