#!/bin/bash
# Press remote buttons on the Vega Virtual Device: press.sh ENTER DOWN RIGHT ...
source ~/vega/env
for k in "$@"; do
  perl -e 'alarm 30; exec @ARGV' vega device run-cmd -d VirtualDevice -c "inputd-cli button_press KEY_$k" > /dev/null 2>&1
  sleep 0.4
done
