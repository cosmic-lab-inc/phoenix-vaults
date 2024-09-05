#!/usr/bin/env bash

# initialise trap to call kill script processes
# SIGINT received
parent_pid="$$"
trap 'kill -- -$parent_pid' SIGINT SIGQUIT EXIT

# helper function to silence background processes
bkg() { "$@" >/dev/null & }
# SIGQUIT received

chmod +x ./build.sh
./build.sh

# start anchor localnet in background
anchor localnet &

# run bootstrap.sh
chmod +x ./bootstrap.sh
./bootstrap.sh

# run cargo test
yarn anchor-tests