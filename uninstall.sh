#!/usr/bin/env bash
set -uo pipefail
dbus-send --session --print-reply --type=method_call --dest=org.kde.KWin /Scripting org.kde.kwin.Scripting.unloadScript string:tiler >/dev/null
kwriteconfig6 --file kwinrc --group Plugins --key tilerEnabled --delete
kpackagetool6 --type KWin/Script --remove tiler
kpackagetool6 --type Plasma/Applet --remove tiler.control
dbus-send --session --type=method_call --dest=org.kde.KWin /KWin org.kde.KWin.reconfigure
echo "Removed. (Remove the widget from your panel if it's still placed.)"
