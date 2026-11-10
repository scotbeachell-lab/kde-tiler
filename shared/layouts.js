// Shared layout maths, used by both the KWin script and the widget's previews.
var LAYOUTS = ["tall", "wide", "columns", "rows", "grid", "spiral", "monocle"];
var LAYOUT_LABELS = {
    tall: "Master + Stack",
    wide: "Master on Top",
    columns: "Columns",
    rows: "Rows",
    grid: "Grid",
    spiral: "Spiral",
    monocle: "Monocle"
};

function _inset(a, g) {
    return { x: a.x + g, y: a.y + g, width: Math.max(1, a.width - 2 * g), height: Math.max(1, a.height - 2 * g) };
}

// Side-by-side split
function _splitH(a, count, gap) {
    var res = [];
    var w = (a.width - gap * (count - 1)) / count;
    for (var i = 0; i < count; i++)
        res.push({ x: a.x + i * (w + gap), y: a.y, width: w, height: a.height });
    return res;
}

// Stacked split
function _splitV(a, count, gap) {
    var res = [];
    var h = (a.height - gap * (count - 1)) / count;
    for (var i = 0; i < count; i++)
        res.push({ x: a.x, y: a.y + i * (h + gap), width: a.width, height: h });
    return res;
}

function compute(name, area, n, gap, ratio) {
    if (n <= 0) return [];
    var a = _inset(area, gap);
    var res = [];
    var i;
    if (n === 1 || name === "monocle") {
        for (i = 0; i < n; i++) res.push({ x: a.x, y: a.y, width: a.width, height: a.height });
    } else if (name === "tall") {
        var mw = (a.width - gap) * ratio;
        res.push({ x: a.x, y: a.y, width: mw, height: a.height });
        res = res.concat(_splitV({ x: a.x + mw + gap, y: a.y, width: a.width - mw - gap, height: a.height }, n - 1, gap));
    } else if (name === "wide") {
        var mh = (a.height - gap) * ratio;
        res.push({ x: a.x, y: a.y, width: a.width, height: mh });
        res = res.concat(_splitH({ x: a.x, y: a.y + mh + gap, width: a.width, height: a.height - mh - gap }, n - 1, gap));
    } else if (name === "columns") {
        res = _splitH(a, n, gap);
    } else if (name === "rows") {
        res = _splitV(a, n, gap);
    } else if (name === "grid") {
        var cols = Math.ceil(Math.sqrt(n));
        var rows = Math.ceil(n / cols);
        var rowRects = _splitV(a, rows, gap);
        for (var r = 0; r < rows; r++) {
            var cnt = (r === rows - 1) ? n - cols * (rows - 1) : cols;
            res = res.concat(_splitH(rowRects[r], cnt, gap));
        }
    } else if (name === "spiral") {
        var rest = { x: a.x, y: a.y, width: a.width, height: a.height };
        for (i = 0; i < n - 1; i++) {
            var f = (i === 0) ? ratio : 0.5;
            if (i % 2 === 0) {
                var w = (rest.width - gap) * f;
                res.push({ x: rest.x, y: rest.y, width: w, height: rest.height });
                rest = { x: rest.x + w + gap, y: rest.y, width: rest.width - w - gap, height: rest.height };
            } else {
                var h = (rest.height - gap) * f;
                res.push({ x: rest.x, y: rest.y, width: rest.width, height: h });
                rest = { x: rest.x, y: rest.y + h + gap, width: rest.width, height: rest.height - h - gap };
            }
        }
        res.push(rest);
    } else {
        return compute("tall", area, n, gap, ratio);
    }
    return res.map(function (q) {
        var x = Math.round(q.x), y = Math.round(q.y);
        return { x: x, y: y, width: Math.max(1, Math.round(q.x + q.width) - x), height: Math.max(1, Math.round(q.y + q.height) - y) };
    });
}
