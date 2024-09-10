#!/usr/bin/env bash

detach=false
# receive OPTIONS from command line
# if --detach then store detach=true
if [[ "$1" == "--detach" ]]; then
    detach=true
fi


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

# if detach is false, run kill_process
if [[ $detach == false ]]; then
    kill_process
fi
if [[ $detach == true ]]; then
    echo "Validator still running..."
fi

while true; do
    sleep 1
done