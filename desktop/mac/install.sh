#!/bin/bash
# lornAI macOS Bootstrapper & Installer
# Frail Intelligent Systems (https://lorn.lol)

echo "=========================================="
echo "      lornAI Desktop Installer (macOS)   "
echo "           Developed by Frail             "
echo "=========================================="
echo ""

APP_DIR="$HOME/Applications/lornAI"
mkdir -p "$APP_DIR"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Installing lornAI local files to $APP_DIR..."
cp "$SCRIPT_DIR/index.html" "$APP_DIR/"
cp "$SCRIPT_DIR/style.css" "$APP_DIR/"
cp "$SCRIPT_DIR/app.js" "$APP_DIR/"
cp "$SCRIPT_DIR/favicon.svg" "$APP_DIR/"
cp "$SCRIPT_DIR/og-image.svg" "$APP_DIR/" 2>/dev/null || true
cp "$SCRIPT_DIR/config.json" "$APP_DIR/" 2>/dev/null || true

# Create macOS launcher script
cat << 'EOF' > "$APP_DIR/launch.sh"
#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=4178

# Start lightweight local web server in background
if command -v python3 &>/dev/null; then
    cd "$DIR" && python3 -m http.server $PORT &
    PID=$!
elif command -v node &>/dev/null; then
    cd "$DIR" && npx serve -p $PORT &
    PID=$!
fi

sleep 1
open "http://127.0.0.1:$PORT/"

# Wait for browser, trap exit
wait $PID 2>/dev/null || true
EOF

chmod +x "$APP_DIR/launch.sh"

# Create Desktop Shortcut
DESKTOP_LAUNCHER="$HOME/Desktop/lornAI.command"
cat << EOF > "$DESKTOP_LAUNCHER"
#!/bin/bash
"$APP_DIR/launch.sh"
EOF
chmod +x "$DESKTOP_LAUNCHER"

echo ""
echo "Installation complete!"
echo "lornAI has been installed to: $APP_DIR"
echo "A shortcut 'lornAI.command' has been placed on your Desktop."
echo ""
read -p "Would you like to launch lornAI now? (Y/n): " choice
if [[ "$choice" != "n" && "$choice" != "N" ]]; then
    "$APP_DIR/launch.sh"
fi
