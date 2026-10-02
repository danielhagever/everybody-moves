#!/bin/bash
# Screenshot of the Vega Virtual Device window only (for checking layouts), saved to $1.
out=${1:-/tmp/vvd.png}
id=$(osascript -e 'tell application "System Events" to get unix id of first process whose name contains "vega-virtual-device"' 2>/dev/null)
swift -e 'import CoreGraphics
let pid = Int32(CommandLine.arguments[1])!
let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as! [[String: Any]]
for w in list where (w[kCGWindowOwnerPID as String] as? Int32) == pid && ((w[kCGWindowLayer as String] as? Int) ?? 1) == 0 { print(w[kCGWindowNumber as String]!); break }' "$id" > /tmp/vvd-win 2>/dev/null
screencapture -x -o -l "$(cat /tmp/vvd-win)" "$out"
