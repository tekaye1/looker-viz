/**
 * Drillable Single Value
 * -----------------------
 * Single-value viz that makes drilling obvious & easy:
 *   - value auto-fits the ACTUAL tile size (binary-search fit + ResizeObserver),
 *     capped by "Max value font size";
 *   - RIGHT-click anywhere on the tile opens Looker's native drill menu
 *     (openDrillMenu with the cell's existing links);
 *   - styled like a link (color + subtle underline that thickens on hover);
 *   - hint caption at the bottom (hover overlays it; "always" reserves a strip).
 *
 * Logs under "[dsv]" for debugging.
 */
looker.plugins.visualizations.add({
  id: "drillable_single_value",
  label: "Drillable Single Value",

  options: {
    value_color:  { type: "string",  label: "Value color", display: "color", default: "#1a73e8", section: "Value", order: 1 },
    value_size:   { type: "number",  label: "Max value font size (px)", default: 60, section: "Value", order: 2 },
    value_weight: { type: "string",  label: "Value weight", display: "select",
                    values: [ { "Normal": "400" }, { "Medium": "500" }, { "Semibold": "600" }, { "Bold": "700" } ],
                    default: "400", section: "Value", order: 3 },
    underline:    { type: "boolean", label: "Underline value (signals it's clickable)", default: true, section: "Drill", order: 1 },
    hint_text:    { type: "string",  label: "Hint text", default: "Right-click to view interactions", section: "Drill", order: 2 },
    hint_mode:    { type: "string",  label: "Show hint", display: "select",
                    values: [ { "On hover": "hover" }, { "Always": "always" }, { "Off": "none" } ],
                    default: "hover", section: "Drill", order: 3 }
  },

  create: function (element, config) {
    element.innerHTML = `
      <style>
        .dsv-wrap { position:relative; display:flex; align-items:center; justify-content:center;
          height:100%; width:100%; overflow:hidden; box-sizing:border-box;
          padding:2px 6px; font-family:inherit; text-align:center; }
        .dsv-wrap.dsv-reserve { padding-bottom:15px; }
        .dsv-value { line-height:1.05; white-space:nowrap; max-width:100%; }
        .dsv-value.dsv-underline { border-bottom:1px solid currentColor; padding-bottom:1px; }
        .dsv-wrap.dsv-can-drill { cursor:context-menu; }
        .dsv-wrap.dsv-can-drill:hover .dsv-value.dsv-underline { border-bottom-width:2px; }
        .dsv-hint { position:absolute; left:0; right:0; bottom:2px; text-align:center;
          font-size:11px; line-height:1.2; padding:0 6px; opacity:0; transition:opacity .12s ease;
          pointer-events:none; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .dsv-wrap.dsv-show .dsv-hint, .dsv-hint.dsv-always { opacity:.6; }
      </style>
      <div class="dsv-wrap">
        <div class="dsv-value" role="button" tabindex="0"></div>
        <div class="dsv-hint"></div>
      </div>`;
    this._wrap = element.querySelector(".dsv-wrap");
    this._valueEl = element.querySelector(".dsv-value");
    this._hintEl = element.querySelector(".dsv-hint");
    var self = this;

    // Size the value to fill the ACTUAL tile box (largest font that fits w & h).
    this._fit = function () {
      var wrap = self._wrap, val = self._valueEl;
      if (!wrap || !val) return;
      var availW = wrap.clientWidth - 8;
      var availH = wrap.clientHeight - (self._alwaysHint ? 18 : 4);
      if (availW <= 4 || availH <= 6) return; // not laid out yet -> ResizeObserver retries
      var lo = 8, hi = self._cap || 60, best = 8;
      while (lo <= hi) {
        var mid = (lo + hi) >> 1;
        val.style.fontSize = mid + "px";
        if (val.scrollWidth <= availW && val.scrollHeight <= availH) { best = mid; lo = mid + 1; }
        else hi = mid - 1;
      }
      val.style.fontSize = best + "px";
    };

    // RIGHT-click drills.
    this._drill = function (event) {
      try {
        if (event) { if (event.preventDefault) event.preventDefault(); if (event.stopPropagation) event.stopPropagation(); }
        var links = self._links || [];
        if (!links.length) { console.warn("[dsv] right-click, but this cell has no drill links"); return; }
        if (!(window.LookerCharts && LookerCharts.Utils && LookerCharts.Utils.openDrillMenu)) {
          console.error("[dsv] LookerCharts.Utils.openDrillMenu is unavailable"); return;
        }
        LookerCharts.Utils.openDrillMenu({ links: links, event: event });
      } catch (e) { console.error("[dsv] drill error:", e); }
    };

    this._wrap.addEventListener("contextmenu", this._drill);
    this._valueEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); self._drill(e); } // keyboard a11y
    });
    this._wrap.addEventListener("mouseenter", function () { if (self._mode === "hover") self._wrap.classList.add("dsv-show"); });
    this._wrap.addEventListener("mouseleave", function () { self._wrap.classList.remove("dsv-show"); });

    if (window.ResizeObserver) {
      this._ro = new ResizeObserver(function () { self._fit(); });
      this._ro.observe(this._wrap);
    }
  },

  updateAsync: function (data, element, config, queryResponse, details, done) {
    this.clearErrors();

    var measures = (queryResponse.fields.measure_like) || [];
    if (!measures.length || !data || !data.length) {
      this.addError({ title: "One measure required", message: "This viz expects one measure and at least one row." });
      return done();
    }

    var field = measures[0];
    var cell  = data[0][field.name];
    var links = (cell && cell.links) || [];
    this._links = links;
    var hasDrill = links.length > 0;
    this._mode = hasDrill ? (config.hint_mode || "hover") : "none";
    this._alwaysHint = this._mode === "always";
    this._cap = config.value_size || 60;
    var val = this._valueEl;

    val.textContent = (cell && cell.rendered != null) ? cell.rendered : String(cell ? cell.value : "∅");
    val.style.color = config.value_color || "#1a73e8";
    val.style.fontWeight = config.value_weight || "400";
    val.classList.toggle("dsv-underline", !!config.underline && hasDrill);
    this._wrap.classList.toggle("dsv-can-drill", hasDrill);
    this._wrap.classList.toggle("dsv-reserve", this._alwaysHint);

    this._hintEl.textContent = config.hint_text || "";
    this._hintEl.classList.toggle("dsv-always", this._alwaysHint);
    this._hintEl.style.display = (this._mode === "none") ? "none" : "block";

    this._fit();
    console.log("[dsv] render -", field.name, "| links:", links.length,
                "| tile:", this._wrap.clientWidth + "x" + this._wrap.clientHeight, "| font:", val.style.fontSize);
    done();
  }
});
