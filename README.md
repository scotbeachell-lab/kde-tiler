# Tiler for KDE Plasma 6

Automatic window tiling for KDE Plasma 6 (KWin), with a panel widget for switching layouts.

It's made of two parts:

- **KWin script** (`kwin-script/`): does the tiling. New windows tile automatically, and windows that open maximized join the layout too.
- **Panel widget** (`plasmoid/`): shows the current layout in your panel and lets you switch layouts, change the gaps and set the master size.

The layout maths in `shared/layouts.js` is used by both parts. `install.sh` combines it into each package.

## Layouts

Master + Stack · Master on Top · Columns · Rows · Grid · Spiral · Monocle

## Install

Requires Plasma 6 (`kpackagetool6`, `kwriteconfig6`, `dbus-send`).

```sh
git clone https://github.com/scotbeachell-lab/kde-tiler.git
cd kde-tiler
./install.sh
```

Then add the widget to your panel: right-click the panel → **Add Widgets…** → search **"Tiler"**.

If you're upgrading and the widget is already in your panel, restart plasmashell afterwards:

```sh
systemctl --user restart plasma-plasmashell
```

To remove everything, run `./uninstall.sh`.

## Using it

**Panel widget**
- Scroll on the icon to change the layout.
- Middle-click the icon to turn tiling on or off.
- Left-click the icon to open the popup, which has the layouts, a gaps slider, a master size slider and a "Retile now" button.

**Mouse**
- Drag a window onto another window to swap them.
- In Master + Stack, Master on Top and Spiral, resizing the master window changes the master size.
- If you maximize a window yourself, it stays full screen until you restore it. Then it goes back into the layout.

**Keyboard** (you can change these in System Settings → Shortcuts → KWin)

| Shortcut | Action |
|---|---|
| Meta+J / Meta+K | Focus next / previous window |
| Meta+Shift+J / Meta+Shift+K | Swap with next / previous window |
| Meta+Shift+Return | Swap with master |
| Meta+Shift+F | Toggle floating (floating windows stay on top) |
| Meta+Shift+H / Meta+Shift+L | Shrink / grow master |
| Meta+Shift+Space | Next layout |
| Meta+Shift+T | Toggle tiling |

## Configuration

Settings are stored in `~/.config/kwinrc` under `[Script-tiler]`. The widget writes this section for you. These keys exist only in the file:

- `ignoreClasses`: comma-separated window classes that are never tiled.
- `newAsMaster=true`: new windows become the master instead of joining the end of the stack.

## License

GPL-3.0. See [LICENSE](LICENSE).
