#!/usr/bin/env bash

home() {
    cd "$(git rev-parse --show-toplevel)" || exit 1
}

home

no_build=false
resume=false

usage() {
  if [[ -n $1 ]]; then
    echo "$*"
    echo
  fi
  cat <<EOF

usage: $0 [ARGUMENTS]

ARGUMENTS:
  --no-build          - Skip building the program and only deploy

EOF
  exit 1
}

positional_args=()
while [[ -n $1 ]]; do
  if [[ ${1:0:1} = - ]]; then
    if [[ $1 = --no-build ]]; then
      no_build=true
      shift 1
    elif [[ $1 = --resume ]]; then
      resume=true
      shift 1
    elif [[ $1 = -h ]]; then
      usage "$@"
    else
      echo "Unknown argument: $1"
      exit 1
    fi
  else
    positional_args+=("$1")
    shift
  fi
done


ROOT="$(pwd)"

if [[ $no_build == false ]]; then
  chmod +x ./build.sh
  ./build.sh
fi

keypair="$HOME/.config/solana/phoenix_vaults.json"
program_id=$(solana address -k "$keypair")
rpc_url=$(solana config get | grep "RPC URL" | cut -d " " -f 3)
bin="$ROOT/target/deploy/phoenix_vaults.so"
auth="$HOME/.config/solana/cosmic_lab_inc.json"
auth_id=$(solana address -k "$auth")
idl="$ROOT/target/idl/phoenix_vaults.json"
buffer="$ROOT/target/deploy/phoenix_vaults-keypair.json"

if [[ $auth_id != "CSMCi5Z6pBjMXQFQayk4WgVPNAgjmo1jTNEryjYyk4xN" ]]; then
  echo "Invalid authority: $auth, must be CSMCi5Z6pBjMXQFQayk4WgVPNAgjmo1jTNEryjYyk4xN"
  exit 1
fi

if [[ $program_id != "VAULT8EhRg1mduZJYCab7xkNq7ieXMQ1Tqec2LPU6jv" ]]; then
  echo "Invalid program: $program_id, must be VAULT8EhRg1mduZJYCab7xkNq7ieXMQ1Tqec2LPU6jv"
  exit 1
fi

echo "Deploying program with the following parameters:"
echo "  - rpc-url: $rpc_url"
echo "  - program-id: $program_id"
echo "  - auth: $auth_id"
echo "  - idl: $idl"
echo "  - binary: $bin"

auth_sol_before=$(solana balance -k "$auth" | awk '{print $1}')
echo "Program authority $auth_id has balance of $auth_sol_before SOL before deployment"

deploy_program() {
  solana program deploy "$bin" \
    --program-id "$program_id" \
    --keypair "$keypair" \
    --upgrade-authority "$auth" \
    --url "$rpc_url" \
    --fee-payer "$auth" \
    --with-compute-unit-price 10000 \
    --buffer "$buffer"
}

deploy_idl() {
  anchor idl init "$program_id" \
    --filepath "$idl" \
    --provider.cluster "$rpc_url" \
    --provider.wallet "$auth"

  anchor idl upgrade "$program_id" \
    --filepath "$idl" \
    --provider.cluster "$rpc_url" \
    --provider.wallet "$auth"
}

deploy_program || exit 1

deploy_idl || exit 1

auth_sol_after=$(solana balance -k "$auth" | awk '{print $1}')
echo "Program authority $auth_id has balance of $auth_sol_before SOL after deployment"

deploy_cost=$(echo "$auth_sol_before - $auth_sol_after" | bc)
echo "Program deploy cost $deploy_cost SOL"