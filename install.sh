#!/usr/bin/env bash
# Installs (or upgrades) the Tiler KWin script and the Tiler panel widget.
set -euo pipefail
cd "$(dirname "$0")"

BUILD=$(mktemp -d)
trap 'rm -rf "$BUILD"' EXIT

# KWin script: shared layout maths + main script in one file
mkdir -p "$BUILD/kwin/contents/code"
cp kwin-script/metadata.json "$BUILD/kwin/"
cat shared/layouts.js kwin-script/main.js > "$BUILD/kwin/contents/code/main.js"

# Plasmoid: shared layout maths as a QML JS library
cp -r plasmoid "$BUILD/plasmoid"
mkdir -p "$BUILD/plasmoid/contents/code"
{ echo ".pragma library"; cat shared/layouts.js; } > "$BUILD/plasmoid/contents/code/layouts.js"

install_pkg() { # type dir
    kpackagetool6 --type "$1" --upgrade "$2" 2>/dev/null || kpackagetool6 --type "$1" --install "$2"
}
install_pkg KWin/Script "$BUILD/kwin"
install_pkg Plasma/Applet "$BUILD/plasmoid"

# Enable and (re)load the KWin script
kwriteconfig6 --file kwinrc --group Plugins --key tilerEnabled true
dbus-send --session --print-reply --type=method_call --dest=org.kde.KWin /Scripting org.kde.kwin.Scripting.unloadScript string:tiler >/dev/null || true
dbus-send --session --type=method_call --dest=org.kde.KWin /KWin org.kde.KWin.reconfigure
dbus-send --session --type=method_call --dest=org.kde.KWin /Scripting org.kde.kwin.Scripting.start

echo
echo "Installed. Add the widget: right-click your panel → Add Widgets… → search \"Tiler\"."
echo "If you upgraded an already-placed widget, restart plasmashell to load the new QML:"
echo "    systemctl --user restart plasma-plasmashell"
