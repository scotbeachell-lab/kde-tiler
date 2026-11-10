// ---- Tiler: KWin script (layouts.js is prepended at install time) ----

var WIDGET_ID = "tiler.control";

var state = { enabled: true, layout: "tall", gap: 8, ratio: 0.55, newAsMaster: false, ignore: [] };
var order = [];        // tiling order of known windows (index 0 = master)
var floating = {};     // internalId -> true
var lastRect = {};     // internalId -> rect we last assigned
var dragging = {};     // internalId -> { resize: bool }

function wid(w) { return String(w.internalId); }
function asBool(v) { return v === true || v === "true" || v === 1 || v === "1"; }
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

function loadConfig() {
    state.enabled = asBool(readConfig("enabled", true));
    var l = String(readConfig("layout", "tall"));
    state.layout = LAYOUTS.indexOf(l) >= 0 ? l : "tall";
    var g = parseInt(readConfig("gap", 8), 10);
    state.gap = isNaN(g) ? 8 : clamp(g, 0, 64);
    var r = parseFloat(readConfig("ratio", 0.55));
    state.ratio = isNaN(r) ? 0.55 : clamp(r, 0.1, 0.9);
    state.newAsMaster = asBool(readConfig("newAsMaster", false));
    state.ignore = String(readConfig("ignoreClasses",
        "krunner,plasmashell,yakuake,spectacle,org.kde.polkit-kde-authentication-agent-1,org.kde.kdeconnect.daemon"))
        .toLowerCase().split(",").map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 0; });
}

// Push state changed from keyboard/mouse back to any Tiler widgets so they stay in sync
// (the widget then writes it to kwinrc, which makes it persist).
function pushToWidgets() {
    var js =
        "var cs = desktops().concat(panels());" +
        "for (var i = 0; i < cs.length; i++) { var ws = cs[i].widgets('" + WIDGET_ID + "');" +
        "  for (var j = 0; j < ws.length; j++) { var w = ws[j]; w.currentConfigGroup = ['General'];" +
        "    w.writeConfig('enabled', " + (state.enabled ? "true" : "false") + ");" +
        "    w.writeConfig('layout', '" + state.layout + "');" +
        "    w.writeConfig('ratio', " + state.ratio.toFixed(3) + ");" +
        "    w.reloadConfig(); } }";
    callDBus("org.kde.plasmashell", "/PlasmaShell", "org.kde.PlasmaShell", "evaluateScript", js);
}

// ---------- window classification ----------

function isCandidate(w) {
    if (!w || w.deleted) return false;
    if (!w.normalWindow || w.transient || w.specialWindow || w.dialog || w.popupWindow || w.skipTaskbar) return false;
    if (!w.resizeable || !w.moveable) return false;
    var cls = String(w.resourceClass || "").toLowerCase();
    if (state.ignore.indexOf(cls) >= 0) return false;
    return true;
}

function isMaximized(w) {
    var m = w.maximizeMode;
    return m !== undefined && m !== 0;
}

function isTiled(w) {
    return isCandidate(w) && !floating[wid(w)] && !w.minimized && !w.fullScreen && !isMaximized(w);
}

function onCurrent(w, desk) {
    var onDesk = w.onAllDesktops;
    if (!onDesk) {
        var ds = w.desktops;
        for (var i = 0; i < ds.length; i++) if (ds[i].id === desk.id) { onDesk = true; break; }
    }
    if (!onDesk) return false;
    var acts = w.activities;
    return !acts || acts.length === 0 || acts.indexOf(workspace.currentActivity) >= 0;
}

function sameOutput(a, b) { return a && b && a.name === b.name; }

function tiledOn(output) {
    var desk = workspace.currentDesktop;
    return order.filter(function (w) { return isTiled(w) && onCurrent(w, desk) && sameOutput(w.output, output); });
}

function innerArea(output) {
    var a = workspace.clientArea(KWin.MaximizeArea, output, workspace.currentDesktop);
    var g = state.gap;
    return { x: a.x + g, y: a.y + g, width: a.width - 2 * g, height: a.height - 2 * g };
}

// ---------- tiling ----------

function retile() {
    if (!state.enabled) return;
    var screens = workspace.screens;
    for (var s = 0; s < screens.length; s++) {
        var out = screens[s];
        var ws = tiledOn(out);
        if (ws.length === 0) continue;
        var a = workspace.clientArea(KWin.MaximizeArea, out, workspace.currentDesktop);
        var rects = compute(state.layout, { x: a.x, y: a.y, width: a.width, height: a.height }, ws.length, state.gap, state.ratio);
        for (var i = 0; i < ws.length; i++) {
            var w = ws[i];
            if (dragging[wid(w)] || w.move || w.resize) continue;
            var r = rects[i];
            lastRect[wid(w)] = r;
            var g = w.frameGeometry;
            if (g.x !== r.x || g.y !== r.y || g.width !== r.width || g.height !== r.height)
                w.frameGeometry = { x: r.x, y: r.y, width: r.width, height: r.height };
        }
    }
}

function swapInOrder(a, b) {
    var i = order.indexOf(a), j = order.indexOf(b);
    if (i < 0 || j < 0) return;
    order[i] = b;
    order[j] = a;
}

function contains(r, p) {
    return p.x >= r.x && p.x < r.x + r.width && p.y >= r.y && p.y < r.y + r.height;
}

// After a drag: drop on another tile = swap. After a resize: adjust master ratio.
function onDragFinished(w) {
    var info = dragging[wid(w)];
    delete dragging[wid(w)];
    if (!state.enabled || !isTiled(w)) { retile(); return; }

    if (info && info.resize) {
        var ws = tiledOn(w.output);
        var idx = ws.indexOf(w);
        if (ws.length > 1 && idx >= 0) {
            var a = innerArea(w.output);
            var g = w.frameGeometry;
            var r = null;
            if (state.layout === "tall" || (state.layout === "spiral" && idx === 0)) {
                var mw = idx === 0 ? g.width : a.width - state.gap - g.width;
                r = mw / (a.width - state.gap);
            } else if (state.layout === "wide") {
                var mh = idx === 0 ? g.height : a.height - state.gap - g.height;
                r = mh / (a.height - state.gap);
            }
            if (r !== null && isFinite(r)) {
                state.ratio = clamp(r, 0.1, 0.9);
                pushToWidgets();
            }
        }
    } else {
        var p = workspace.cursorPos;
        var desk = workspace.currentDesktop;
        for (var k = 0; k < order.length; k++) {
            var o = order[k];
            if (o === w || !isTiled(o) || !onCurrent(o, desk)) continue;
            var lr = lastRect[wid(o)];
            if (lr && contains(lr, p)) { swapInOrder(w, o); break; }
        }
    }
    retile();
}

// ---------- window bookkeeping ----------

function addWindow(w, noRetile) {
    if (!isCandidate(w) || order.indexOf(w) >= 0) return;
    if (state.newAsMaster) order.unshift(w); else order.push(w);

    var re = function () { retile(); };
    w.minimizedChanged.connect(re);
    w.maximizedChanged.connect(re);
    w.fullScreenChanged.connect(re);
    w.desktopsChanged.connect(re);
    w.outputChanged.connect(re);
    if (w.activitiesChanged) w.activitiesChanged.connect(re);
    w.interactiveMoveResizeStarted.connect(function () { dragging[wid(w)] = { resize: !!w.resize }; });
    w.interactiveMoveResizeFinished.connect(function () { onDragFinished(w); });

    // Some apps resize themselves right after mapping (common on Wayland), which would undo
    // the tile. For a window's first few geometry changes, snap it back to its tile.
    var settle = 8;
    var onGeom = function () {
        if (settle <= 0) return;
        settle--;
        var r = lastRect[wid(w)];
        if (!r || !state.enabled || !isTiled(w) || dragging[wid(w)] || w.move || w.resize) return;
        var g = w.frameGeometry;
        if (g.x !== r.x || g.y !== r.y || g.width !== r.width || g.height !== r.height)
            w.frameGeometry = { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    w.frameGeometryChanged.connect(onGeom);

    // Auto-tile: windows that open maximized (browsers love this) join the layout instead.
    if (state.enabled) unmaximize(w);

    if (!noRetile) retile();
}

function unmaximize(w) {
    if (isCandidate(w) && !floating[wid(w)] && isMaximized(w)) w.setMaximize(false, false);
}

// Called when tiling is switched on: pull every manageable window into the layout.
function tileEverything() {
    order.forEach(unmaximize);
    retile();
}

function removeWindow(w) {
    var i = order.indexOf(w);
    if (i < 0) return;
    order.splice(i, 1);
    var id = wid(w);
    delete floating[id];
    delete lastRect[id];
    delete dragging[id];
    retile();
}

// ---------- shortcut actions ----------

function activeTiledContext() {
    var w = workspace.activeWindow;
    if (!w) return null;
    var ws = tiledOn(w.output);
    var idx = ws.indexOf(w);
    if (idx < 0) return null;
    return { w: w, ws: ws, idx: idx };
}

function focusRel(d) {
    var c = activeTiledContext();
    if (!c || c.ws.length < 2) return;
    workspace.activeWindow = c.ws[(c.idx + d + c.ws.length) % c.ws.length];
}

function swapRel(d) {
    var c = activeTiledContext();
    if (!c || c.ws.length < 2) return;
    swapInOrder(c.w, c.ws[(c.idx + d + c.ws.length) % c.ws.length]);
    retile();
}

function promote() {
    var c = activeTiledContext();
    if (!c || c.ws.length < 2) return;
    // Already master? Swap with the next one (like dwm's zoom).
    swapInOrder(c.w, c.idx === 0 ? c.ws[1] : c.ws[0]);
    retile();
    workspace.activeWindow = c.w;
}

function toggleFloat() {
    var w = workspace.activeWindow;
    if (!w || !isCandidate(w)) return;
    var id = wid(w);
    if (floating[id]) {
        delete floating[id];
        w.keepAbove = false;
    } else {
        floating[id] = true;
        w.keepAbove = true;
        var a = workspace.clientArea(KWin.MaximizeArea, w.output, workspace.currentDesktop);
        var fw = Math.round(a.width * 0.6), fh = Math.round(a.height * 0.6);
        w.frameGeometry = { x: Math.round(a.x + (a.width - fw) / 2), y: Math.round(a.y + (a.height - fh) / 2), width: fw, height: fh };
    }
    retile();
}

function adjustRatio(delta) {
    state.ratio = clamp(Math.round((state.ratio + delta) * 100) / 100, 0.1, 0.9);
    retile();
    pushToWidgets();
}

function cycleLayout(d) {
    var i = LAYOUTS.indexOf(state.layout);
    state.layout = LAYOUTS[(i + d + LAYOUTS.length) % LAYOUTS.length];
    retile();
    pushToWidgets();
}

function toggleTiling() {
    state.enabled = !state.enabled;
    if (state.enabled) tileEverything();
    pushToWidgets();
}

registerShortcut("TilerFocusNext", "Tiler: Focus next window", "Meta+J", function () { focusRel(1); });
registerShortcut("TilerFocusPrev", "Tiler: Focus previous window", "Meta+K", function () { focusRel(-1); });
registerShortcut("TilerSwapNext", "Tiler: Swap with next window", "Meta+Shift+J", function () { swapRel(1); });
registerShortcut("TilerSwapPrev", "Tiler: Swap with previous window", "Meta+Shift+K", function () { swapRel(-1); });
registerShortcut("TilerPromote", "Tiler: Swap with master", "Meta+Shift+Return", promote);
registerShortcut("TilerFloat", "Tiler: Toggle floating for window", "Meta+Shift+F", toggleFloat);
registerShortcut("TilerGrow", "Tiler: Grow master area", "Meta+Shift+L", function () { adjustRatio(0.05); });
registerShortcut("TilerShrink", "Tiler: Shrink master area", "Meta+Shift+H", function () { adjustRatio(-0.05); });
registerShortcut("TilerNextLayout", "Tiler: Next layout", "Meta+Shift+Space", function () { cycleLayout(1); });
registerShortcut("TilerPrevLayout", "Tiler: Previous layout", "", function () { cycleLayout(-1); });
registerShortcut("TilerToggle", "Tiler: Toggle tiling", "Meta+Shift+T", toggleTiling);
registerShortcut("TilerRetile", "Tiler: Retile now", "", retile);

// ---------- startup ----------

loadConfig();
workspace.windowList().forEach(function (w) { addWindow(w, true); });

workspace.windowAdded.connect(function (w) { addWindow(w, false); });
workspace.windowRemoved.connect(removeWindow);
workspace.windowActivated.connect(function () { retile(); });
workspace.currentDesktopChanged.connect(function () { retile(); });
workspace.screensChanged.connect(function () { retile(); });
if (workspace.currentActivityChanged) workspace.currentActivityChanged.connect(function () { retile(); });
options.configChanged.connect(function () {
    var wasEnabled = state.enabled;
    loadConfig();
    if (state.enabled && !wasEnabled) tileEverything(); else retile();
});

retile();
