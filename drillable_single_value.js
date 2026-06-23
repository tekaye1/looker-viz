/**
 * Drillable Single Value
 * -----------------------
 * Single-value viz that makes drilling obvious & easy:
 *   - value rendered like a link (color + underline + pointer);
 *   - LEFT click anywhere on the tile opens Looker's native drill menu
 *     (openDrillMenu with the cell's existing links) - no right-click needed;
 *   - hint caption at the bottom of the tile (hover / always), kept in-bounds;
 *   - value size is fixed (configurable) and only shrinks if too wide.
 *
 * Logs to the browser console under the "[dsv]" prefix for debugging.
 */
looker.plugins.visualizations.add({
  id: "drillable_single_value",
  label: "Drillable Single Value",

  options: {
    value_color: { type: "string",  label: "Value color", display: "color", default: "#1a73e8", section: "Value", order: 1 },
    value_size:  { type: "number",  label: "Value font size (px)", default: 36, section: "Value", order: 2 },
    underline:   { type: "boolean", label: "Underline value (signals it's clickable)", default: true, section: "Drill", order: 1 },
    hint_text:   { type: "string",  label: "Hint text", default: "Click to view interactions", section: "Drill", order: 2 },
    hint_mode:   { type: "string",  label: "Show hint", display: "select",
                   values: [ { "On hover": "hover" }, { "Always": "always" }, { "Off": "none" } ],
                   default: "hover", section: "Drill", order: 3 }
  },

  create: function (element, config) {
    element.innerHTML = `
      <style>
        .dsv-wrap { position:relative; display:flex; align-items:center; justify-content:center;
          height:100%; width:100%; overflow:hidden; box-sizing:border-box;
          padding:2px 6px 14px 6px; font-family:inherit; text-align:center; }
        .dsv-value { font-weight:600; line-height:1.05; white-space:nowrap; max-width:100%; }
        .dsv-value.dsv-underline { border-bottom:2px solid currentColor; padding-bottom:1px; }
        .dsv-wrap.dsv-can-drill { cursor:pointer; }
        .dsv-wrap.dsv-can-drill:hover .dsv-value { opacity:.82; }
        .dsv-hint { position:absolute; left:0; right:0; bottom:2px; text-align:center;
          font-size:11px; line-height:1.2; padding:0 6px; opacity:0; transition:opacity .12s ease;
          pointer-events:none; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .dsv-wrap.dsv-show .dsv-hint, .dsv-hint.dsv-always { opacity:.65; }
      </style>
      <div class="dsv-wrap">
        <div class="dsv-value" role="button" tabindex="0"></div>
        <div class="dsv-hint"></div>
      </div>`;
    this._wrap = element.querySelector(".dsv-wrap");
    this._valueEl = element.querySelector(".dsv-value");
    this._hintEl = element.querySelector(".dsv-hint");
    var self = this;

    this._drill = function (event) {
      try {
        if (event && event.stopPropagation) event.stopPropagation();
        var links = self._links || [];
        if (!links.length) { console.warn("[dsv] click, but this cell has no drill links"); return; }
        if (!(window.LookerCharts && LookerCharts.Utils && LookerCharts.Utils.openDrillMenu)) {
          console.error("[dsv] LookerCharts.Utils.openDrillMenu is unavailable"); return;
        }
        console.log("[dsv] opening drill menu with " + links.length + " link(s)");
        LookerCharts.Utils.openDrillMenu({ links: links, event: event });
      } catch (e) { console.error("[dsv] drill error:", e); }
    };

    // Attach listeners ONCE (updateAsync runs many times - don't stack handlers).
    this._wrap.addEventListener("click", this._drill);
    this._wrap.addEventListener("mouseenter", function () { if (self._mode === "hover") self._wrap.classList.add("dsv-show"); });
    this._wrap.addEventListener("mouseleave", function () { self._wrap.classList.remove("dsv-show"); });
    this._valueEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); self._drill(e); }
    });
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
    var val = this._valueEl;

    val.textContent = (cell && cell.rendered != null) ? cell.rendered : String(cell ? cell.value : "∅");
    val.style.color = config.value_color || "#1a73e8";
    val.classList.toggle("dsv-underline", !!config.underline && hasDrill);
    this._wrap.classList.toggle("dsv-can-drill", hasDrill);

    // Fixed size; shrink only if the number is too wide for the tile.
    var size = config.value_size || 36;
    val.style.fontSize = size + "px";
    var maxW = (element.clientWidth || 160) - 10;
    var guard = 0;
    while (val.scrollWidth > maxW && size > 10 && guard < 50) { size -= 1; val.style.fontSize = size + "px"; guard++; }

    // Hint caption.
    this._mode = hasDrill ? (config.hint_mode || "hover") : "none";
    this._hintEl.textContent = config.hint_text || "";
    this._hintEl.classList.toggle("dsv-always", this._mode === "always");
    this._hintEl.style.display = (this._mode === "none") ? "none" : "block";

    console.log("[dsv] render - measure:", field.name, "| drill links:", links.length,
                "| crossfilterEnabled:", !!(details && details.crossfilterEnabled));
    done();
  }
});
