#!/usr/bin/env bash
# Recreates the original TermSnap TextWrap screenshot's terminal content.
# This is example output; it does not build, lint, or modify your project.
set -euo pipefail

reset=$'\033[0m'
bold=$'\033[1m'
cyan=$'\033[38;2;0;232;198m'
green=$'\033[38;2;150;224;114m'
purple=$'\033[38;2;199;77;237m'
yellow=$'\033[38;2;255;230;109m'
red=$'\033[38;2;255;97;136m'
muted=$'\033[38;2;143;147;162m'
white=$'\033[38;2;213;206;217m'

printf '\n'
printf '  %s%sTermSnap TextWrap%s\n' "$bold" "$purple" "$reset"
printf '  %sTerminal screenshots, beautifully captured.%s\n' "$muted" "$reset"
printf '\n'

printf '  %s>%s %snpm run build%s\n' "$cyan" "$reset" "$white" "$reset"
printf '  %s> termsnap-textwrap@0.2.0 build%s\n' "$muted" "$reset"
printf '  %s> node esbuild.mjs%s\n' "$muted" "$reset"
printf '\n'

printf '  %s[OK]%s Extension compiled successfully\n' "$green" "$reset"
printf '  %s[OK]%s Webview assets bundled\n' "$green" "$reset"
printf '  %s[OK]%s Terminal color preservation enabled\n' "$green" "$reset"
printf '\n'

printf '  %s>%s %snpm run lint%s\n' "$cyan" "$reset" "$white" "$reset"
printf '  %s[OK]%s 0 errors, 0 warnings\n' "$green" "$reset"
printf '\n'

printf '  %s%sFeatures%s\n' "$bold" "$purple" "$reset"
printf '  %s+%s Adjustable text wrapping\n' "$green" "$reset"
printf '  %s+%s Native ANSI and RGB colors\n' "$green" "$reset"
printf '  %s+%s Andromeda color theme\n' "$green" "$reset"
printf '  %s+%s Fast, high-quality PNG export\n' "$green" "$reset"
printf '\n'

printf '  %sINFO%s  Long lines automatically wrap while preserving terminal formatting, making complex command output easier to read and share.\n' "$yellow" "$reset"
printf '  %sWARN%s  This is demonstration output, not an actual build or lint result.\n' "$red" "$reset"
printf '\n'

printf '  %s%sReady to capture!%s\n' "$bold" "$green" "$reset"
printf '\n'