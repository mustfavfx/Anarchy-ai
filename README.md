# Anarchy AI

AI-powered architectural visualization and design assistant. Built for architects, by architects.

![Version](https://img.shields.io/badge/version-0.7.0-blue)
![React](https://img.shields.io/badge/React-18-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6)
![Vite](https://img.shields.io/badge/Vite-Latest-646CFF)

## Features

- **Builder Workflow** - Node-based AI image generation workflow
- **History System** - Track all generations with search, filter, and preview
- **Library** - Organize and manage your generated images
- **Generate** - AI chat for architectural questions
- **Integrations** - Plugin support for 3ds Max, Revit, SketchUp, ArchiCAD, AutoCAD
- **Settings** - Theme, notifications, auto-save, and data management

## Quick Start

### 🚀 Automated Setup (Recommended)

#### Windows - Just Double-Click!
```
start.bat
```

**What happens automatically:**
1. ✅ Checks for Node.js (downloads & installs if missing)
2. ✅ Creates `.env` from template
3. ✅ Installs dependencies (`npm install`)
4. ✅ Starts the app

**Create Desktop Shortcut (Optional):**
```
create-desktop-shortcut.bat
```
This creates a shortcut on your desktop for even faster access!

Or run in terminal:
```bash
node setup.js
```

### 📦 Manual Node.js Installation

If automatic installation fails:

1. Download Node.js 18+ from https://nodejs.org
2. Run the installer (default settings are fine)
3. Restart your computer
4. Run `start.bat` again

#### Linux/macOS
```bash
chmod +x start.sh
./start.sh
```

The script will:
- ✅ Check Node.js version
- ✅ Create `.env` from template (if missing)
- ✅ Install dependencies automatically
- ✅ Start the app

### Manual Installation

```bash
# 1. Clone or copy the project folder
cd "Anarchy Ai 0.07"

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

The app will open at `http://localhost:5173`

## Data Transfer (Moving to Another Device)

### Method 1: Export/Import (Recommended)

1. **On old device**: Go to **Settings** → **Storage** → Click **Export**
   - Downloads a JSON backup file

2. **Copy the folder** to new device:
   ```bash
   # Windows
   xcopy "Anarchy Ai 0.07" "D:\NewLocation\Anarchy Ai 0.07" /E /I
   
   # Or just copy the folder normally
   ```

3. **On new device**:
   ```bash
   cd "Anarchy Ai 0.07"
   npm install
   npm run dev
   ```

4. **Import your data**: Go to **Settings** → **Storage** → Click **Import** → Select your backup file

5. **Set up API Key** (Important!):
   - Copy `.env.example` to `.env`
   - Add your Replicate API token:
   ```
   VITE_REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
   - Or set it as environment variable
   - Restart the app

### Method 2: Manual localStorage Transfer

Open DevTools Console on old device:
```javascript
// Export
copy(JSON.stringify({
  settings: localStorage.getItem('anarchy_settings'),
  history: localStorage.getItem('anarchy_history')
}))
```

On new device:
```javascript
// Paste your exported data
const data = {/* paste here */};
localStorage.setItem('anarchy_settings', data.settings);
localStorage.setItem('anarchy_history', data.history);
```

## Project Structure

```
src/
├── features/
│   ├── builder/        # Node-based workflow builder
│   ├── dashboard/      # Dashboard page
│   ├── generate/       # AI chat interface
│   ├── history/        # Generation history
│   ├── integrations/   # Plugin integrations
│   ├── library/        # Image library
│   ├── projects/       # Projects list
│   ├── settings/       # Settings page
│   └── shell/          # App shell & navigation
├── services/
│   ├── history/        # History management
│   ├── migration/      # Data export/import
│   ├── replicate/      # Replicate API integration
│   ├── settings/       # Settings management
│   └── workflow/       # Workflow file operations
└── utils/              # Utility functions
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + S` | Save project |
| `Ctrl + Shift + S` | Save project as... |
| `Ctrl + O` | Open project |

## API Key Setup

The app uses **Replicate API** for AI image generation.

### Option 1: Environment Variable (Recommended)
Create a `.env` file in the project root:
```env
VITE_REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Option 2: System Environment
Set `VITE_REPLICATE_API_TOKEN` in your system environment variables.

### Getting Your API Key
1. Go to https://replicate.com/account/api-tokens
2. Sign in / Create account
3. Copy your token
4. Paste in `.env` file

## Storage

All data is stored locally in browser localStorage:
- **Settings**: `anarchy_settings`
- **History**: `anarchy_history`
- **Workflows**: `anarchy_workflows`
- **Library**: `anarchy_library`

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **React Flow** - Node-based workflow
- **Lucide React** - Icons
- **Replicate API** - AI image generation

## Version

Current version: **0.7.0**

## License

Proprietary - All rights reserved.
