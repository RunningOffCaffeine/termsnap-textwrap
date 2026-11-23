#!/usr/bin/env bash
# Illustrated terminal output for a TermSnap TextWrap demo screenshot.
# No programs are built, no deployments run, and no files are modified.
set -eu

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
printf '%s\n' "${bold}${purple}  TERMSNAP TEXTWRAP${reset}  ${muted}/  terminal capture showcase${reset}"
printf '%s\n' "  ${muted}Color-preserving screenshots  |  Adjustable wrapping  |  Fast PNG export${reset}"
printf '\n'
printf '%s\n' "${cyan}  >${reset} ${white}analyzing preview.log${reset}                 ${green}READY${reset}"
printf '%s\n' "  ${muted}------------------------------------------------------------------${reset}"
printf '%s\n' "  ${muted}TIME      LEVEL    COMPONENT       MESSAGE${reset}"
printf '%s\n' "  ${muted}14:32:01${reset}  ${green}SUCCESS${reset}  ${white}renderer${reset}        Stylesheet loaded"
printf '%s\n' "  ${muted}14:32:01${reset}  ${green}SUCCESS${reset}  ${white}terminal${reset}        ANSI/RGB colors preserved"
printf '%s\n' "  ${muted}14:32:02${reset}  ${cyan}INFO${reset}     ${white}layout${reset}          Wrapping enabled at 640 px"
printf '%s\n' "  ${muted}14:32:02${reset}  ${yellow}WARNING${reset}  ${white}layout${reset}          This intentionally long terminal message demonstrates how TermSnap keeps text readable when the capture width is reduced, without losing the colors of the surrounding log entries."
printf '%s\n' "  ${muted}14:32:03${reset}  ${red}ERROR${reset}    ${white}example${reset}         Sample diagnostic only (not a real failure)"
printf '%s\n' "  ${muted}14:32:03${reset}  ${green}SUCCESS${reset}  ${white}export${reset}          PNG preview prepared"
printf '\n'
printf '%s\n' "  ${purple}${bold}Example diff${reset}  ${muted}src/export.ts${reset}"
printf '%s\n' "  ${muted}@@ -22,2 +22,2 @@${reset}"
printf '%s\n' "  ${red}- const scale = 4;${reset}"
printf '%s\n' "  ${green}+ const scale = 2;${reset}"
printf '\n'
printf '%s\n' "  ${green}${bold}DONE${reset}   ${white}Sample terminal output complete.${reset}"
printf '%s\n' "  ${muted}Tip: select only the printed output, then capture with TermSnap.${reset}"
printf '\n'