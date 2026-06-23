/**
 * Drillable Single Value
 * -----------------------
 * Single-value viz that makes drilling obvious:
 *   - value is auto-sized to fit the tile (no overflow into the title);
 *   - rendered like a link (color + underline + pointer) so it looks clickable;
 *   - LEFT click opens Looker's native drill menu (no right-click needed);
 *   - a hint caption shows at the bottom of the tile (on hover or always) -
 *     kept INSIDE the tile bounds so it isn't clipped like an overflowing tooltip.
 *
 * Drilling comes from the cell's existing `links`; the measure is untouched.
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
      type: "number", label: "Max value font size (px)",
      default: 48, section: "Value", order: 2
    },
    underline: {
      type: "boolean", label: "Underline value (signals it's clickable)",
      default: true, section: "Drill", order: 1
    },
    hint_text: {
      type: "string", label: "Hint text",
      default: "Click to view interactions", section: "Drill", order: 2
    },
    hint_mode: {
      type: "string", label: "Show hint", display: "select",
      values: [ { "On hover": "hover" }, { "Always": "always" }, { "Off": "none" } ],
      default: "hover", section: "Drill", order: 3
    }
  },

  create: function (element, config) {
    element.innerHTML = `
      <style>
        .dsv-wrap { position:relative; display:flex; align-items:center; justify-content:center;
          height:100%; width:100%; overflow:hidden; box-sizing:border-box;
          padding:2px 6px 14px 6px; font-family:inherit; text-align:center; }
        .dsv-value { font-weight:600; line-height:1.05; white-space:nowrap; max-width:100%; }
        .dsv-value.dsv-drillable { cursor:pointer; }
        .dsv-value.dsv-underline { border-bottom:2px solid currentColor; padding-bottom:1px; }
        .dsv-value.dsv-drillable:hover { opacity:.8; }
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
  },

  updateAsync: function (data, element, config, queryResponse, details, done) {
    this.clearErrors();

    var measures = (queryResponse.fields.measure_like) || [];
    if (measures.length === 0 || !data || data.length === 0) {
      this.addError({ title: "One measure required", message: "Drillable Single Value expects one measure and at least one row." });
      return done();
    }

    var field = measures[0];
    var cell  = data[0][field.name];
    var links = (cell && cell.links) || [];
    var hasDrill = links.length > 0;
    var val = this._valueEl;

    // value text + styling
    val.textContent = (cell && cell.rendered != null) ? cell.rendered : String(cell ? cell.value : "∅");
    val.style.color = config.value_color || "#1a73e8";
    val.classList.toggle("dsv-underline", !!config.underline && hasDrill);
    val.classList.toggle("dsv-drillable", hasDrill);

    // auto-size: grow until it would overflow the tile (width or height), capped by value_size
    var cap  = config.value_size || 48;
    var maxW = (element.clientWidth  || 140) - 12;
    var maxH = (element.clientHeight > 0) ? element.clientHeight - 16 : 9999;
    var size = 8;
    val.style.fontSize = size + "px";
    while (size < cap) {
      val.style.fontSize = (size + 2) + "px";
      if (val.scrollWidth > maxW || val.scrollHeight > maxH) { val.style.fontSize = size + "px"; break; }
      size += 2;
    }

    // hint caption (in-bounds, bottom of tile)
    var mode = hasDrill ? (config.hint_mode || "hover") : "none";
    this._hintEl.textContent = config.hint_text || "";
    this._hintEl.classList.toggle("dsv-always", mode === "always");
    this._hintEl.style.display = (mode === "none") ? "none" : "block";

    var wrap = this._wrap;
    var showOn = function () { if (mode === "hover") wrap.classList.add("dsv-show"); };
    var hideOn = function () { wrap.classList.remove("dsv-show"); };
    wrap.onmouseenter = showOn;
    wrap.onmouseleave = hideOn;

    // LEFT-click (and keyboard) opens the native drill menu
    var open = function (event) { if (hasDrill) LookerCharts.Utils.openDrillMenu({ links: links, event: event }); };
    val.onclick = open;
    val.onkeydown = function (event) {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(event); }
    };

    done();
  }
});
