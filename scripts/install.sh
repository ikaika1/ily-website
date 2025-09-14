#!/bin/bash

# Constants and configurable variables
NODE_VERSION=20.19.5

# This ensures the entire script is downloaded
{
set -e  # exit immediately if a command exits with a non-zero status

usage() {
    cat 1>&2 <<EOF
Custom Install Script
Creates a new user 'solv', adds the user to the sudo group, logs in as 'solv',
installs pnpm, node $NODE_VERSION, and sets it as the global version.
Additionally, installs the @epics-dao/solv package globally.

USAGE:
    custom-install-script.sh [FLAGS]

FLAGS:
    -h, --help              Prints help information
EOF
}

create_user() {
    if getent passwd solv >/dev/null 2>&1; then
        echo "User 'solv' already exists, skipping..."
    else
        echo "Creating user 'solv'..."
        sudo adduser solv
        sudo usermod -aG sudo solv
        echo "solv ALL=(ALL) NOPASSWD: ALL" | sudo tee /etc/sudoers.d/solv
    fi
}

install_docker() {
    echo "Installing Docker..."
    sudo apt update
    sudo apt install apt-transport-https ca-certificates curl software-properties-common -y
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt update
    sudo apt install docker-ce -y
    sudo systemctl enable docker
    sudo systemctl start docker
    sudo usermod -aG docker solv
}


setup_firewall() {
    echo "Configuring firewall"
    echo "yes" | sudo ufw enable
    sudo ufw allow ssh
    sudo ufw allow 53
    sudo ufw allow 8899/udp
    sudo ufw allow 8899/tcp
    sudo ufw allow 8000:8898/udp
    sudo ufw allow 8000:8898/tcp
    sudo ufw allow 8900:9999/tcp
    sudo ufw allow 8900:9999/udp
    sudo ufw allow 10000/udp
    sudo ufw allow 10000/tcp
    sudo ufw reload
    sudo apt install fail2ban -y
    sudo apt-get install libsasl2-dev build-essential -y
    sudo apt-get install -y libssl-dev libudev-dev pkg-config zlib1g-dev llvm clang cmake make libprotobuf-dev protobuf-compiler
}

setup_lib() {
    echo "Installing Packages..."
    sudo apt install fail2ban -y
    sudo apt-get install libsasl2-dev build-essential -y
    sudo apt-get install -y libssl-dev libudev-dev pkg-config zlib1g-dev llvm clang cmake make libprotobuf-dev protobuf-compiler
}

install_rustup() {
    sudo su - solv <<EOF_SOLV
        echo "Installing rustup..."
        curl https://sh.rustup.rs -sSf | sh -s -- -y
        echo 'export PATH="$HOME/.cargo/env:$PATH"' >> ~/.profile
        source ~/.cargo/env
        rustup component add rustfmt
        rustup update
EOF_SOLV
}

install_pnpm_and_packages() {
    sudo su - solv <<EOF_SOLV
        echo "Installing pnpm..."
        curl -fsSL https://get.pnpm.io/install.sh | sh -

        echo "Setting pnpm environment variables..."
        PNPM_HOME="/home/solv/.local/share/pnpm"
        export PNPM_HOME
        PATH="\$PNPM_HOME:\$PATH"
        export PATH
        echo 'export PNPM_HOME="$HOME/.local/share/pnpm"' >> ~/.profile
        echo 'export PATH="$PNPM_HOME:$PATH"' >> ~/.profile

        echo "Sourcing ~/.bashrc in case it's needed..."
        if [ -f ~/.bashrc ]; then source ~/.bashrc; fi

        echo "Installing node $NODE_VERSION..."
        pnpm env use $NODE_VERSION --global

        echo "Installing solv CLI (global)..."
        # Prefer @epics-dao/solv; fallback to @ily-validator/solv if available
        if ! pnpm add -g @epics-dao/solv; then
          pnpm add -g @ily-validator/solv || true
        fi

        echo "Sourcing ~/.profile in case it's needed..."
        if [ -f ~/.profile ]; then source ~/.profile; fi

        # Resolve the solv binary path robustly and run example commands
        SOLV_BIN="$(command -v solv || true)"
        if [ -z "\$SOLV_BIN" ]; then
          SOLV_DIR="$(pnpm bin -g 2>/dev/null || echo "$PNPM_HOME")"
          SOLV_BIN="\${SOLV_DIR}/solv"
        fi
        if [ ! -x "\$SOLV_BIN" ]; then
          echo "Error: 'solv' CLI was not found in PATH or at \"$PNPM_HOME/solv\"." >&2
          echo "Tried installing @epics-dao/solv (and @ily-validator/solv fallback)." >&2
          echo "Please verify the correct package name provides 'solv' and re-run:" >&2
          echo "  pnpm add -g @epics-dao/solv" >&2
          exit 1
        fi

        "\$SOLV_BIN" i
        "\$SOLV_BIN" get aa
EOF_SOLV
}



main() {
    for arg in "$@"; do
      case "$arg" in
        -h|--help)
          usage
          exit 0
          ;;
        *)
          ;;
      esac
    done

    create_user
    setup_firewall
    setup_lib
    install_docker
    install_rustup
    install_pnpm_and_packages
    echo "Enter solv user password 👇"
    su solv
}

main "$@"

} # this ensures the entire script is downloaded
