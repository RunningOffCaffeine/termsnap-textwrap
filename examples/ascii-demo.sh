#!/usr/bin/env bash
# TermSnap TextWrap - colorful ASCII demo (no dependencies).
# Output uses 24-bit ANSI foreground/background colors.

RESET=$'\033[0m'
BOLD=$'\033[1m'
DIM=$'\033[2m'
CYAN=$'\033[38;2;0;232;198m'
PURPLE=$'\033[38;2;199;77;237m'
PINK=$'\033[38;2;255;97;136m'
GREEN=$'\033[38;2;150;224;114m'
YELLOW=$'\033[38;2;255;230;109m'
MUTED=$'\033[38;2;143;147;162m'
FG=$'\033[38;2;213;206;217m'

# Print a cyan -> purple gradient across one ASCII-art line.
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

printf '\n'
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
printf '  '
for color in '0;232;198' '150;224;114' '255;230;109' '255;97;136' '199;77;237'; do
  printf '\033[48;2;%sm    %s  ' "$color" "$RESET"
done
printf '\n'
printf '  %s CYAN    GREEN   YELLOW  CORAL   PURPLE%s\n\n' "$MUTED" "$RESET"

printf '  %s[INFO]%s    Width: 640 px   |   Scale: 2x   |   Theme: Andromeda\n' "$CYAN" "$RESET"
printf '  %s[OK]%s      ANSI/RGB colors preserved from the terminal\n' "$GREEN" "$RESET"
printf '  %s[WARN]%s    This long status message is intentionally verbose so that TermSnap can demonstrate word wrapping without losing its foreground colors or alignment in the exported screenshot.\n' "$YELLOW" "$RESET"
printf '  %s[DEMO]%s    No real build was run; these are sample diagnostics.\n\n' "$PINK" "$RESET"

printf '  %s%sDIFF PREVIEW%s\n' "$BOLD" "$PURPLE" "$RESET"
printf '  %s- const pngScale = 4;%s\n' "$PINK" "$RESET"
printf '  %s+ const pngScale = 2;%s\n' "$GREEN" "$RESET"
printf '  %s+ const preserveColors = true;%s\n\n' "$GREEN" "$RESET"
printf '  %s%sReady to capture with TermSnap TextWrap!%s\n\n' "$BOLD" "$CYAN" "$RESET"