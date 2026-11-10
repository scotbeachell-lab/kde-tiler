import QtQuick
import QtQuick.Layouts
import org.kde.plasma.plasmoid
import org.kde.plasma.core as PlasmaCore
import org.kde.plasma.components as PlasmaComponents
import org.kde.plasma.extras as PlasmaExtras
import org.kde.plasma.plasma5support as P5Support
import org.kde.kirigami as Kirigami
import "../code/layouts.js" as Layouts

PlasmoidItem {
    id: root

    readonly property var cfg: Plasmoid.configuration
    readonly property string layoutLabel: Layouts.LAYOUT_LABELS[cfg.layout] || cfg.layout

    preferredRepresentation: compactRepresentation
    toolTipMainText: "Tiler"
    toolTipSubText: cfg.enabled ? "Layout: " + layoutLabel + "\nScroll to change layout · middle-click to toggle"
                                : "Tiling is off · middle-click to turn on"

    // ---------- talking to the KWin script ----------

    P5Support.DataSource {
        id: exec
        engine: "executable"
        connectedSources: []
        onNewData: (source, data) => disconnectSource(source)
        function run(cmd) { connectSource(cmd + " # " + Date.now()); }
    }

    function applyToKWin() {
        const layout = Layouts.LAYOUTS.indexOf(cfg.layout) >= 0 ? cfg.layout : "tall";
        const w = "kwriteconfig6 --file kwinrc --group Script-tiler --key ";
        exec.run(w + "enabled " + (cfg.enabled ? "true" : "false")
                 + " && " + w + "layout " + layout
                 + " && " + w + "gap " + Math.round(cfg.gap)
                 + " && " + w + "ratio " + Number(cfg.ratio).toFixed(3)
                 + " && dbus-send --session --type=method_call --dest=org.kde.KWin /KWin org.kde.KWin.reconfigure");
    }

    function invokeShortcut(name) {
        exec.run("dbus-send --session --type=method_call --dest=org.kde.kglobalaccel /component/kwin "
                 + "org.kde.kglobalaccel.Component.invokeShortcut string:" + name);
    }

    function cycleLayout(d) {
        const i = Layouts.LAYOUTS.indexOf(cfg.layout);
        const n = Layouts.LAYOUTS.length;
        cfg.layout = Layouts.LAYOUTS[((i < 0 ? 0 : i) + d + n) % n];
    }

    // Debounce so a burst of config changes results in one reconfigure.
    Timer { id: applyTimer; interval: 120; onTriggered: root.applyToKWin() }
    Connections {
        target: Plasmoid.configuration
        function onEnabledChanged() { applyTimer.restart(); }
        function onLayoutChanged() { applyTimer.restart(); }
        function onGapChanged() { applyTimer.restart(); }
        function onRatioChanged() { applyTimer.restart(); }
    }
    Component.onCompleted: applyTimer.restart()

    Plasmoid.contextualActions: [
        PlasmaCore.Action {
            text: "Tiling enabled"
            checkable: true
            checked: root.cfg.enabled
            onTriggered: root.cfg.enabled = !root.cfg.enabled
        },
        PlasmaCore.Action {
            text: "Retile now"
            icon.name: "view-refresh"
            onTriggered: root.invokeShortcut("TilerRetile")
        }
    ]

    // ---------- panel icon ----------

    compactRepresentation: MouseArea {
        id: compact
        acceptedButtons: Qt.LeftButton | Qt.MiddleButton
        hoverEnabled: true
        Layout.minimumWidth: Kirigami.Units.iconSizes.small
        Layout.minimumHeight: Kirigami.Units.iconSizes.small

        property real wheelDelta: 0

        onClicked: mouse => {
            if (mouse.button === Qt.MiddleButton) root.cfg.enabled = !root.cfg.enabled;
            else root.expanded = !root.expanded;
        }
        onWheel: wheel => {
            wheelDelta += wheel.angleDelta.y;
            while (wheelDelta >= 120) { wheelDelta -= 120; root.cycleLayout(-1); }
            while (wheelDelta <= -120) { wheelDelta += 120; root.cycleLayout(1); }
        }

        LayoutPreview {
            anchors.centerIn: parent
            width: Math.min(parent.width, parent.height) * 0.9
            height: width * 0.78
            layout: root.cfg.layout
            ratio: root.cfg.ratio
            count: 3
            active: root.cfg.enabled
            color: compact.containsMouse ? Kirigami.Theme.highlightColor : Kirigami.Theme.textColor
        }
    }

    // ---------- popup ----------

    fullRepresentation: PlasmaExtras.Representation {
        Layout.minimumWidth: Kirigami.Units.gridUnit * 20
        Layout.minimumHeight: content.implicitHeight + Kirigami.Units.largeSpacing * 2
        Layout.preferredWidth: Layout.minimumWidth
        Layout.preferredHeight: Layout.minimumHeight

        header: PlasmaExtras.PlasmoidHeading {
            RowLayout {
                anchors.fill: parent
                Kirigami.Heading {
                    level: 1
                    text: "Tiling"
                    Layout.fillWidth: true
                }
                PlasmaComponents.Switch {
                    checked: root.cfg.enabled
                    onToggled: root.cfg.enabled = checked
                }
            }
        }

        ColumnLayout {
            id: content
            anchors.fill: parent
            anchors.margins: Kirigami.Units.smallSpacing
            spacing: Kirigami.Units.largeSpacing
            opacity: root.cfg.enabled ? 1 : 0.5

            GridLayout {
                columns: 4
                uniformCellWidths: true
                columnSpacing: Kirigami.Units.smallSpacing
                rowSpacing: Kirigami.Units.smallSpacing
                Layout.fillWidth: true

                Repeater {
                    model: Layouts.LAYOUTS
                    delegate: PlasmaComponents.ToolButton {
                        id: btn
                        required property string modelData
                        readonly property bool current: root.cfg.layout === modelData
                        Layout.fillWidth: true
                        Layout.preferredHeight: Kirigami.Units.gridUnit * 4
                        checkable: true
                        checked: current
                        onClicked: root.cfg.layout = modelData
                        PlasmaComponents.ToolTip.text: Layouts.LAYOUT_LABELS[modelData]
                        PlasmaComponents.ToolTip.visible: hovered
                        PlasmaComponents.ToolTip.delay: Kirigami.Units.toolTipDelay

                        contentItem: ColumnLayout {
                            spacing: Kirigami.Units.smallSpacing
                            LayoutPreview {
                                Layout.alignment: Qt.AlignHCenter
                                Layout.preferredWidth: Kirigami.Units.gridUnit * 3
                                Layout.preferredHeight: Kirigami.Units.gridUnit * 2
                                layout: btn.modelData
                                ratio: root.cfg.ratio
                                count: (btn.modelData === "grid" || btn.modelData === "spiral") ? 4 : 3
                                active: btn.current
                                color: btn.current ? Kirigami.Theme.highlightColor : Kirigami.Theme.textColor
                            }
                            PlasmaComponents.Label {
                                Layout.fillWidth: true
                                horizontalAlignment: Text.AlignHCenter
                                text: Layouts.LAYOUT_LABELS[btn.modelData]
                                font: Kirigami.Theme.smallFont
                                elide: Text.ElideRight
                            }
                        }
                    }
                }
            }

            GridLayout {
                columns: 3
                Layout.fillWidth: true

                PlasmaComponents.Label { text: "Gaps" }
                PlasmaComponents.Slider {
                    id: gapSlider
                    Layout.fillWidth: true
                    from: 0; to: 32; stepSize: 1
                    value: root.cfg.gap
                    onPressedChanged: if (!pressed) root.cfg.gap = value
                    onMoved: if (!pressed) root.cfg.gap = value  // keyboard
                }
                PlasmaComponents.Label {
                    text: Math.round(gapSlider.value) + " px"
                    Layout.minimumWidth: Kirigami.Units.gridUnit * 2.5
                }

                PlasmaComponents.Label { text: "Master" }
                PlasmaComponents.Slider {
                    id: ratioSlider
                    Layout.fillWidth: true
                    from: 0.2; to: 0.8; stepSize: 0.01
                    value: root.cfg.ratio
                    enabled: ["tall", "wide", "spiral"].indexOf(root.cfg.layout) >= 0
                    onPressedChanged: if (!pressed) root.cfg.ratio = value
                    onMoved: if (!pressed) root.cfg.ratio = value
                }
                PlasmaComponents.Label {
                    text: Math.round(ratioSlider.value * 100) + " %"
                    Layout.minimumWidth: Kirigami.Units.gridUnit * 2.5
                }
            }

            RowLayout {
                Layout.fillWidth: true
                PlasmaComponents.Button {
                    text: "Retile now"
                    icon.name: "view-refresh"
                    onClicked: root.invokeShortcut("TilerRetile")
                }
                Item { Layout.fillWidth: true }
                PlasmaComponents.ToolButton {
                    icon.name: "configure-shortcuts"
                    text: "Shortcuts…"
                    onClicked: {
                        exec.run("systemsettings kcm_keys");
                        root.expanded = false;
                    }
                }
            }

            PlasmaComponents.Label {
                Layout.fillWidth: true
                wrapMode: Text.WordWrap
                font: Kirigami.Theme.smallFont
                opacity: 0.7
                text: "Drag a window onto another to swap them. Meta+J/K focus · Meta+Shift+J/K swap · "
                      + "Meta+Shift+Return make master · Meta+Shift+F float · Meta+Shift+H/L resize master · "
                      + "Meta+Shift+Space next layout"
            }
        }
    }
}
