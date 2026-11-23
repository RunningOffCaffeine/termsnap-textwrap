#!/usr/bin/env bash
# TermSnap TextWrap - colorful ANSI/RGB demo (no external dependencies).
# Shows both RGB foreground blocks and RGB background-colored spaces.
# Requires a TermSnap build that preserves whitespace-only HTML color rows.

RESET=$'\033[0m'
BOLD=$'\033[1m'
CYAN=$'\033[38;2;0;232;198m'
PURPLE=$'\033[38;2;199;77;237m'
CORAL=$'\033[38;2;255;97;136m'
GREEN=$'\033[38;2;150;224;114m'
YELLOW=$'\033[38;2;255;230;109m'
MUTED=$'\033[38;2;143;147;162m'
FG=$'\033[38;2;213;206;217m'

# Print a cyan-to-purple gradient across each ASCII-art line.
print_gradient() {
  local line=$1 i width=${#1} r g b
  for ((i = 0; i < width; i += 4)); do
    r=$((199 * i / width))
    g=$((232 - 155 * i / width))
    b=$((198 + 39 * i / width))
    printf '\033[1;38;2;%d;%d;%dm%s' "$r" "$g" "$b" "${line:i:4}"
  done
  printf '%s\n' "$RESET"
}

while IFS= read -r line; do
  print_gradient "$line"
done <<'ART'
 _____ _____ ____  __  __ ____  _   _    _    ____
|_   _| ____|  _ \|  \/  / ___|| \ | |  / \  |  _ \
  | | |  _| | |_) | |\/| \___ \|  \| | / _ \ | |_) |
  | | | |___|  _ <| |  | |___) | |\  |/ ___ \|  __/
  |_| |_____|_| \_\_|  |_|____/|_| \_/_/   \_\_|
ART

printf '\n'
printf '  %s%sTerminal screenshots, beautifully captured.%s\n' "$BOLD" "$FG" "$RESET"
printf '  %sFast PNG export  |  True-color text  |  Custom wrapping%s\n\n' "$MUTED" "$RESET"

printf '  %s$%s %snpm run build%s\n' "$CYAN" "$RESET" "$FG" "$RESET"
printf '  %s[1/3]%s Bundling extension assets\n' "$PURPLE" "$RESET"
printf '  %s[2/3]%s Compiling TypeScript\n' "$PURPLE" "$RESET"
printf '  %s[3/3]%s Preparing PNG renderer\n' "$PURPLE" "$RESET"
printf '  %s[PASS]%s Build completed successfully\n\n' "$GREEN" "$RESET"

printf '  %s%sCOLOR PALETTE%s\n' "$BOLD" "$PURPLE" "$RESET"

# Every palette cell is 12 columns wide: 2 margin + 8 swatch + 2 margin.
# The first row uses ANSI BACKGROUND colors on ordinary space characters.
# The second uses ANSI FOREGROUND colors on solid block characters.
PALETTE_NAMES=(CYAN GREEN YELLOW CORAL PURPLE)
PALETTE_COLORS=("$CYAN" "$GREEN" "$YELLOW" "$CORAL" "$PURPLE")
PALETTE_BACKGROUNDS=(
  $'\033[48;2;0;232;198m'
  $'\033[48;2;150;224;114m'
  $'\033[48;2;255;230;109m'
  $'\033[48;2;255;97;136m'
  $'\033[48;2;199;77;237m'
)

printf '  %sBackground colors (spaces):%s\n' "$MUTED" "$RESET"
printf '  '
for bg in "${PALETTE_BACKGROUNDS[@]}"; do
  printf '  %s        %s  ' "$bg" "$RESET"
done
printf '\n'

printf '  '
for i in "${!PALETTE_NAMES[@]}"; do
  label=${PALETTE_NAMES[$i]}
  color=${PALETTE_COLORS[$i]}
  left=$(((12 - ${#label}) / 2))
  right=$((12 - ${#label} - left))
  printf '%*s%s%s%s%*s' "$left" '' "$color" "$label" "$RESET" "$right" ''
done
printf '\n\n'

printf '  %sForeground colors (block characters):%s\n' "$MUTED" "$RESET"
printf '  '
for color in "${PALETTE_COLORS[@]}"; do
  printf '  %s████████%s  ' "$color" "$RESET"
done
printf '\n\n'

printf '  %s[INFO]%s    Width: 920 px   |   Scale: 2x   |   Theme: Andromeda\n' "$CYAN" "$RESET"
printf '  %s[OK]%s      ANSI/RGB colors preserved from the terminal\n' "$GREEN" "$RESET"
printf '  %s[WARN]%s    This long status message is intentionally verbose so that TermSnap can demonstrate word wrapping without losing its foreground colors or alignment in the exported screenshot.\n' "$YELLOW" "$RESET"
printf '  %s[DEMO]%s    No real build was run; these are sample diagnostics.\n\n' "$CORAL" "$RESET"

printf '  %s%sDIFF PREVIEW%s\n' "$BOLD" "$PURPLE" "$RESET"
printf '  %s- const pngScale = 4;%s\n' "$CORAL" "$RESET"
printf '  %s+ const pngScale = 2;%s\n' "$GREEN" "$RESET"
printf '  %s+ const preserveColors = true;%s\n\n' "$GREEN" "$RESET"
printf '  %s%sReady to capture with TermSnap TextWrap!%s\n' "$BOLD" "$CYAN" "$RESET"
