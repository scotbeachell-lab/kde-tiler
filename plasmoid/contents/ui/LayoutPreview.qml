import QtQuick
import org.kde.kirigami as Kirigami
import "../code/layouts.js" as Layouts

// Draws a miniature of a tiling layout using the same maths the KWin script uses.
Item {
    id: preview

    property string layout: "tall"
    property int count: 3
    property real ratio: 0.55
    property bool active: true
    property color color: Kirigami.Theme.highlightColor
    property color masterColor: color
    property bool bold: false   // solid, high-contrast tiles (for the small panel icon)

    readonly property int miniGap: Math.max(1, Math.round(Math.min(width, height) / 14))
    readonly property var rects: {
        if (width <= 0 || height <= 0) return [];
        if (layout === "monocle") {
            // Show a little stack so monocle doesn't look like a single window.
            const off = miniGap * 2;
            const r = [];
            for (let i = 0; i < count; i++)
                r.push({ x: miniGap + i * off, y: miniGap + (count - 1 - i) * off,
                         width: width - 2 * miniGap - (count - 1) * off,
                         height: height - 2 * miniGap - (count - 1) * off });
            return r;
        }
        return Layouts.compute(layout, { x: 0, y: 0, width: width, height: height }, count, miniGap, ratio);
    }

    Repeater {
        model: preview.rects
        delegate: Rectangle {
            required property var modelData
            required property int index
            x: modelData.x
            y: modelData.y
            width: modelData.width
            height: modelData.height
            radius: Math.min(3, preview.miniGap)
            readonly property color base: index === 0 ? preview.masterColor : preview.color
            color: Qt.rgba(base.r, base.g, base.b,
                           preview.active ? (index === 0 ? (preview.bold ? 1 : 0.9) : (preview.bold ? 0.85 : 0.55))
                                          : (preview.bold ? 0.35 : 0.2))
            border.width: preview.bold ? 0 : 1
            border.color: Qt.rgba(base.r, base.g, base.b, preview.active ? 1 : 0.4)
        }
    }
}
