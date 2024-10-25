#!/usr/bin/env bash

home() {
    cd "$(git rev-parse --show-toplevel)" || exit 1
}

home

ROOT="$(pwd)"

keypair="$HOME/.config/solana/phoenix_vaults.json"
program_id=$(solana address -k "$keypair")
rpc_url=$(solana config get | grep "RPC URL" | cut -d " " -f 3)
bin="$ROOT/target/deploy/phoenix_vaults.so"
auth="$HOME/.config/solana/cosmic_lab_inc.json"
auth_id=$(solana address -k "$auth")
idl="$ROOT/target/idl/phoenix_vaults.json"
buffer="$ROOT/target/deploy/phoenix_vaults-keypair.json"
buffer_id=$(solana address -k "$buffer")

if [[ $auth_id != "CSMCi5Z6pBjMXQFQayk4WgVPNAgjmo1jTNEryjYyk4xN" ]]; then
  echo "Invalid authority: $auth, must be CSMCi5Z6pBjMXQFQayk4WgVPNAgjmo1jTNEryjYyk4xN"
  exit 1
fi

if [[ $program_id != "VLt8tiD4iUGVuxFRr1NiN63BYJGKua5rNpEcsEGzdBq" ]]; then
  echo "Invalid program: $program_id, must be VLt8tiD4iUGVuxFRr1NiN63BYJGKua5rNpEcsEGzdBq"
  exit 1
fi

echo "Closing program with the following parameters:"
echo "  - rpc-url: $rpc_url"
echo "  - program-id: $program_id"
echo "  - buffer-id: $buffer_id"
echo "  - auth: $auth_id"
echo "  - idl: $idl"
echo "  - binary: $bin"

auth_sol_before=$(solana balance -k "$auth" | awk '{print $1}')
echo "Program authority $auth_id has balance of $auth_sol_before SOL before close"

close_program() {
  solana program close "$buffer_id" \
    --url "$rpc_url" \
    --authority "$auth" \
    --verbose \
    --bypass-warning \
    --recipient "$auth_id"
}

close_program || exit 1
echo "Program closed!"

auth_sol_after=$(solana balance -k "$auth" | awk '{print $1}')
echo "Program authority $auth_id has balance of $auth_sol_after SOL after close"

deploy_cost=$(echo "$auth_sol_after - $auth_sol_before" | bc)
echo "Program close refunded $deploy_cost SOL"