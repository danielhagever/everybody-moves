#!/bin/bash
# Build the TV app (debug) and run it on the Vega Virtual Device.
set -e
source ~/vega/env
cd "$(dirname "$0")/../tv"
npm run build:debug > /tmp/em-build.log 2>&1 || { grep -E "error|Error" /tmp/em-build.log | head -20; exit 1; }
perl -e 'alarm 150; exec @ARGV' vega run-app build/aarch64-debug/everybodymoves_aarch64.vpkg com.glitchbound.everybodymoves.main -d VirtualDevice 2>&1 | tail -1
