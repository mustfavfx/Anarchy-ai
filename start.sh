#!/bin/bash

# Anarchy AI - Automated Startup Script
# Works on Linux, macOS, and Windows (with Git Bash/WSL)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Show welcome message
show_welcome() {
    echo ""
    echo -e "${CYAN}${BOLD}"
    echo "    ___    __                        ______    ________ "
    echo "   /   |  / /___ _____  ____ ___     /  _/ /   /  _/ __ \\"
    echo "  / /| | / / __  / __ \/ __  _ \\    / // /    / // / / /"
    echo " / ___ |/ / /_/ / / / / / /  __/  _/ // /_____/ // /_/ / "
    echo "/_/  |_/_/\\__,_/_/ /_/_/ /\\___/  /___/_____/___/\\____/  "
    echo ""
    echo -e "${NC}${BOLD}        AI-Powered Architectural Visualization${NC}"
    echo ""
}

# Check Node.js version
check_node() {
    if ! command -v node &> /dev/null; then
        echo -e "${RED}[❌] Node.js not found!${NC}"
        echo "Please install Node.js 18+ from: https://nodejs.org"
        exit 1
    fi
    
    NODE_VERSION=$(node --version)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
    
    if [ "$NODE_MAJOR" -lt 18 ]; then
        echo -e "${RED}[❌] Node.js 18+ required. Current: $NODE_VERSION${NC}"
        echo "Please upgrade from: https://nodejs.org"
        exit 1
    fi
    
    echo -e "${GREEN}[✓] Node.js $NODE_VERSION detected${NC}"
}

# Setup .env file
setup_env() {
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            echo -e "${YELLOW}[⚠] Creating .env from template...${NC}"
            cp .env.example .env
            echo -e "${GREEN}[✓] Created .env file${NC}"
            echo -e "${YELLOW}⚠ IMPORTANT: Please edit .env and add your Supabase credentials!${NC}"
            sleep 3
        else
            echo -e "${YELLOW}[⚠] Creating empty .env file${NC}"
            echo "VITE_SUPABASE_URL=" > .env
            echo "VITE_SUPABASE_ANON_KEY=" >> .env
        fi
    else
        echo -e "${GREEN}[✓] .env file exists${NC}"
        
        # Check if Supabase is configured
        if grep -q "your-project-ref\|placeholder" .env 2>/dev/null; then
            echo -e "${YELLOW}[⚠] Supabase credentials not configured in .env${NC}"
            echo "Please edit .env and add your Supabase project URL and anon key"
        fi
    fi
}

# Install dependencies
install_deps() {
    if [ ! -d "node_modules" ]; then
        echo ""
        echo -e "${BLUE}[📦] Installing dependencies...${NC}"
        echo "This may take a few minutes..."
        echo ""
        
        npm install
        
        if [ $? -ne 0 ]; then
            echo -e "${RED}[❌] Failed to install dependencies${NC}"
            exit 1
        fi
        
        echo -e "${GREEN}[✓] Dependencies installed${NC}"
    else
        echo -e "${GREEN}[✓] node_modules exists${NC}"
    fi
}

# Check for backup files
check_backups() {
    if ls *.json 1> /dev/null 2>&1; then
        echo ""
        echo -e "${CYAN}[📂] Found backup file(s):${NC}"
        ls -1 *.json
        echo ""
        echo -e "${BLUE}ℹ You can import your data in Settings > Storage${NC}"
        sleep 2
    fi
}

# Start the app
start_app() {
    echo ""
    echo -e "${BLUE}${BOLD}[🚀] Starting Anarchy AI...${NC}"
    echo -e "${CYAN}The app will open at: http://localhost:5173${NC}"
    echo ""
    echo -e "${BOLD}══════════════════════════════════════════════════════════${NC}"
    echo ""
    
    npm run dev
}

# Main
main() {
    show_welcome
    
    check_node
    setup_env
    install_deps
    check_backups
    start_app
}

main "$@"
