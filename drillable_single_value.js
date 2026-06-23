/**
 * Drillable Single Value
 * -----------------------
 * A single-value visualization that makes the drill-down obvious and easy:
 *   - the value is styled like a link (color + underline + pointer cursor) so
 *     users can SEE it is interactive;
 *   - a LEFT click opens Looker's native drill menu (no need to know about
 *     right-click), via LookerCharts.Utils.openDrillMenu;
 *   - an optional styled tooltip explains what clicking does (fully styleable,
 *     unlike the browser's native title tooltip).
 *
 * It does NOT modify the measure or its `link:`/`drill_fields:` — drilling is
 * driven entirely by the cell's existing `links`, so nothing about the data
 * model changes.
 *
 * Registered in manifest.lkml via:
 *   visualization: {
 *     id: "drillable_single_value"
 *     label: "Drillable Single Value"
 *     file: "visualizations/drillable_single_value.js"
 *   }
 */
looker.plugins.visualizations.add({
  id: "drillable_single_value",
  label: "Drillable Single Value",

  options: {
    value_color: {
      type: "string", label: "Value color", display: "color",
      default: "#1a73e8", section: "Value", order: 1
    },
    value_size: {
      type: "number", label: "Value font size (px)",
      default: 48, section: "Value", order: 2
    },
    show_label: {
      type: "boolean", label: "Show measure label above value",
      default: true, section: "Value", order: 3
    },
    underline: {
      type: "boolean", label: "Underline value (signals it's clickable)",
      default: true, section: "Drill", order: 1
    },
    hint_text: {
      type: "string", label: "Hint / tooltip text",
      default: "Click to drill down and view interactions", section: "Drill", order: 2
    },
    hint_mode: {
      type: "string", label: "How to show the hint", display: "select",
      values: [
        { "On hover (styled tooltip)": "hover" },
        { "Always (caption below)": "below" },
        { "Don't show": "none" }
      ],
      default: "hover", section: "Drill", order: 3
    }
  },

  create: function (element, config) {
    element.innerHTML = `
      <style>
        .dsv-wrap { position:relative; display:flex; flex-direction:column;
          align-items:center; justify-content:center; height:100%;
          font-family:inherit; text-align:center; padding:6px; box-sizing:border-box; }
        .dsv-label { font-size:.8rem; opacity:.7; margin-bottom:4px; }
        .dsv-value { font-weight:600; line-height:1.05; display:inline-block; }
        .dsv-value.dsv-drillable { cursor:pointer; }
        .dsv-value.dsv-underline { border-bottom:2px solid currentColor; padding-bottom:2px; }
        .dsv-value.dsv-drillable:hover { opacity:.78; }
        .dsv-value.dsv-drillable:focus { outline:2px solid rgba(26,115,232,.5); outline-offset:3px; }
        .dsv-caption { margin-top:8px; font-size:.72rem; opacity:.65; }
        .dsv-tip { position:absolute; bottom:100%; left:50%; transform:translate(-50%,-8px);
          background:#33373d; color:#fff; font-size:.72rem; line-height:1.3; white-space:nowrap;
          padding:6px 9px; border-radius:6px; box-shadow:0 2px 8px rgba(0,0,0,.25);
          opacity:0; visibility:hidden; transition:opacity .12s ease; pointer-events:none; z-index:10; }
        .dsv-tip::after { content:""; position:absolute; top:100%; left:50%; transform:translateX(-50%);
          border:5px solid transparent; border-top-color:#33373d; }
        .dsv-show .dsv-tip { opacity:1; visibility:visible; }
      </style>
      <div class="dsv-wrap">
        <div class="dsv-label"></div>
        <div class="dsv-value" role="button" tabindex="0"></div>
        <div class="dsv-caption"></div>
        <div class="dsv-tip"></div>
      </div>`;
    this._wrap    = element.querySelector(".dsv-wrap");
    this._labelEl = element.querySelector(".dsv-label");
    this._valueEl = element.querySelector(".dsv-value");
    this._capEl   = element.querySelector(".dsv-caption");
    this._tipEl   = element.querySelector(".dsv-tip");
  },

  updateAsync: function (data, element, config, queryResponse, details, done) {
    this.clearErrors();

    var measures = (queryResponse.fields.measure_like) || [];
    if (measures.length === 0 || !data || data.length === 0) {
      this.addError({
        title: "One measure required",
        message: "Drillable Single Value expects a query with exactly one measure and at least one row."
      });
      return done();
    }

    var field = measures[0];
    var cell  = data[0][field.name];
    var links = (cell && cell.links) || [];
    var hasDrill = links.length > 0;

    // --- value ---
    this._valueEl.textContent = (cell && cell.rendered != null) ? cell.rendered : String(cell ? cell.value : "∅");
    this._valueEl.style.color = config.value_color || "#1a73e8";
    this._valueEl.style.fontSize = (config.value_size || 48) + "px";
    this._valueEl.classList.toggle("dsv-underline", !!config.underline && hasDrill);
    this._valueEl.classList.toggle("dsv-drillable", hasDrill);

    // --- measure label ---
    this._labelEl.style.display = config.show_label ? "block" : "none";
    if (config.show_label) this._labelEl.textContent = field.label_short || field.label || field.name;

    // --- hint (tooltip on hover, or always-visible caption) ---
    var hint = config.hint_text || "";
    var mode = hasDrill ? (config.hint_mode || "hover") : "none";
    this._tipEl.textContent = hint;
    this._capEl.textContent = (mode === "below") ? hint : "";
    this._capEl.style.display = (mode === "below") ? "block" : "none";

    var wrap = this._wrap;
    this._valueEl.onmouseenter = function () { if (mode === "hover") wrap.classList.add("dsv-show"); };
    this._valueEl.onmouseleave = function () { wrap.classList.remove("dsv-show"); };

    // --- LEFT-click (and keyboard) opens the native drill menu ---
    var open = function (event) {
      if (!hasDrill) return;
      LookerCharts.Utils.openDrillMenu({ links: links, event: event });
    };
    this._valueEl.onclick = open;
    this._valueEl.onkeydown = function (event) {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(event); }
    };

    done();
  }
});
