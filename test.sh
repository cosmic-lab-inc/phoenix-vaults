#!/usr/bin/env bash

kill_process() {
    # Killing local validator if currently running
    solana_pid=$(pgrep -f solana)
    # # if no value is returned do nothing, else pkill -f solana
    if [[ -n $solana_pid ]]; then
        pkill -f solana
    fi

    # exit shell script with success status
    exit 0
}

#trap 'kill -- -$parent_pid' SIGINT SIGQUIT EXIT
trap kill_process SIGINT

# helper function to silence background processes
bkg() { "$@" >/dev/null & }

chmod +x ./build.sh
./build.sh

# Killing local validator if currently running
solana_pid=$(pgrep -f solana)
if [[ -n $solana_pid ]]; then
  pkill -f solana
fi

# suppress output form anchor localnet
# start anchor localnet in background
bkg anchor localnet

# run bootstrap.sh
chmod +x ./bootstrap.sh
./bootstrap.sh

# store pid of `yarn anchor-tests`
yarn anchor-tests

# when `yarn anchor-tests` is finished, send SIGINT
# to parent process to kill all child processes
kill_process

while true; do
    sleep 1
done