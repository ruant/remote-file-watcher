# Remote File Watcher

A VS Code extension that monitors workspace files for changes and automatically executes local commands when those files are modified or created. Perfect for integrating remote development workflows with local automation.

## Features

- **Automatic Command Execution**: Run any shell command when specified files change
- **Multiple Watchers**: Configure multiple file-command pairs simultaneously
- **GUI Configuration**: Easy-to-use visual interface for setup (no JSON editing required)
- **Debouncing**: Smart 300ms debounce prevents duplicate executions
- **File Placeholders**: Use `${file}` in commands to reference the changed file path
- **Notification Control**: Toggle VS Code notifications on/off while keeping automation active
- **Dynamic Reload**: Configuration changes take effect immediately without restart

## Use Cases

- Play sounds or show alerts when remote processes complete
- Trigger local scripts when files are updated on remote servers
- Automate workflows based on file system events
- Integrate with external tools like Claude AI for notification systems

## Installation

To install this extension:

1. Copy the `remote-file-watcher` folder to your VS Code extensions directory:
   - **Windows**: `%USERPROFILE%\.vscode\extensions\`
   - **macOS/Linux**: `~/.vscode/extensions/`
2. Reload VS Code

## Quick Start

### Using the GUI (Recommended)

1. Open the Command Palette (`Ctrl+Shift+P`)
2. Run: `Remote File Watcher: Configure Watchers`
3. Toggle notification preferences
4. Add watchers with file paths and commands
5. Click "Save Configuration"

### Manual Configuration

Add to your workspace `.vscode/settings.json`:

```json
{
  "remoteFileWatcher.showNotifications": true,
  "remoteFileWatcher.watchers": [
    {
      "filePath": ".claude-notification-trigger",
      "command": "powershell -Command \"(New-Object System.Media.SoundPlayer 'C:\\\\Windows\\\\Media\\\\Alarm02.wav').PlaySync()\""
    }
  ]
}
```

## Configuration

### Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `remoteFileWatcher.showNotifications` | boolean | `true` | Show VS Code notifications when files change |
| `remoteFileWatcher.watchers` | array | See below | Array of watcher configurations |

### Watcher Object Schema

Each watcher requires:

```json
{
  "filePath": "relative/path/to/file",
  "command": "command to execute"
}
```

- **filePath**: Relative path from workspace root to the file to watch
- **command**: Shell command to execute (supports `${file}` placeholder)

### Default Configuration

The extension comes pre-configured with a notification watcher:

```json
{
  "filePath": ".claude-notification-trigger",
  "command": "powershell -Command \"(New-Object System.Media.SoundPlayer 'C:\\\\Windows\\\\Media\\\\Alarm02.wav').PlaySync()\""
}
```

This plays an alarm sound when `.claude-notification-trigger` is created or modified.

## Examples

### Play a Sound on File Change

```json
{
  "filePath": "notifications/alert.trigger",
  "command": "powershell -Command \"(New-Object System.Media.SoundPlayer 'C:\\\\Windows\\\\Media\\\\notify.wav').PlaySync()\""
}
```

### Run a Script with File Path

```json
{
  "filePath": "logs/build.log",
  "command": "node scripts/process-log.js ${file}"
}
```

### Execute Python Script

```json
{
  "filePath": "data/output.json",
  "command": "python analyze.py --input ${file}"
}
```

### Multiple Commands (Windows)

```json
{
  "filePath": "tasks/complete.txt",
  "command": "powershell -Command \"Write-Host 'Task complete'; Start-Process notepad ${file}\""
}
```

### Multiple Commands (Unix/Linux)

```json
{
  "filePath": "tasks/complete.txt",
  "command": "echo 'Task complete' && cat ${file}"
}
```

## How It Works

1. **Activation**: Extension activates when VS Code finishes startup
2. **Workspace Check**: Verifies an active workspace folder exists
3. **File Monitoring**: Creates VS Code file system watchers for each configured file
4. **Event Detection**: Listens for file creation and change events
5. **Debouncing**: Waits 300ms after last event to prevent duplicate triggers
6. **Command Execution**: Runs the configured command with `${file}` placeholder replaced
7. **Notifications**: Optionally shows VS Code notification (if enabled)

## Technical Details

### Architecture

- **Main File**: `extension.js` (~460 lines)
- **Configuration**: `package.json`
- **Dependencies**: None (uses built-in VS Code and Node.js APIs)

### Key Components

- **FileWatcher Class**: Handles file monitoring with debouncing (extension.js:81)
- **SettingsPanel Class**: Provides GUI configuration interface (extension.js:155)
- **executeCommand Function**: Runs shell commands with placeholder replacement (extension.js:140)
- **Configuration Listener**: Auto-reloads watchers on settings change (extension.js:30)

### File Watching

Uses VS Code's native `createFileSystemWatcher()` API with relative patterns. Monitors:
- `onDidCreate`: When file is created
- `onDidChange`: When file content changes

### Command Execution

Uses Node.js `child_process.exec()` to spawn shell processes. Supports:
- Windows PowerShell commands
- Unix/Linux shell commands
- Any executable accessible from the command line

## Requirements

- **VS Code**: Version 1.80.0 or higher
- **Workspace**: Active workspace folder required
- **Node.js**: Included with VS Code

## Limitations

- Requires an active workspace folder to function
- File paths must be relative to workspace root
- Commands executed in system shell (Windows: PowerShell/CMD, Unix: bash/sh)
- No cross-platform command translation (write platform-specific commands)

## Troubleshooting

### Watchers Not Triggering

1. Verify workspace folder is open
2. Check file path is relative to workspace root
3. Ensure file actually changes (check modification timestamp)
4. Review VS Code developer console for errors (`Help > Toggle Developer Tools`)

### Commands Not Executing

1. Test command manually in terminal first
2. Check command syntax for your platform (Windows vs Unix)
3. Verify file paths use proper escaping (double backslashes in JSON)
4. Check VS Code notifications for error messages

### Configuration Not Saving

1. Ensure you have write permissions to `.vscode/settings.json`
2. Check for JSON syntax errors in manual edits
3. Use the GUI configuration to avoid formatting issues

## Privacy & Security

This extension:
- Runs locally in your VS Code environment
- Only monitors files you explicitly configure
- Executes commands with your user permissions
- Does not send any data externally
- Uses only VS Code and Node.js built-in APIs

**Security Warning**: Be cautious with commands that:
- Execute untrusted scripts
- Have destructive side effects
- Access sensitive data
- Run with elevated privileges

## Development

### Project Structure

```
remote-file-watcher/
├── extension.js      # Main implementation
├── package.json      # Extension manifest
└── README.md         # This file
```

### Extension Type

- **Kind**: UI Extension (`"extensionKind": ["ui"]`)
- **Activation**: `onStartupFinished`
- **Category**: Other

### Building/Testing

No build step required - this is a pure JavaScript extension.

To test locally:
1. Copy to your VS Code extensions directory (see Installation section above)
2. Reload VS Code
3. Open a workspace folder
4. Configure watchers via Command Palette

## Contributing

This is a local extension. To modify:

1. Edit `extension.js` for functionality changes
2. Edit `package.json` for configuration schema
3. Reload VS Code (`Ctrl+R`) to test changes

## License

Not specified - local development extension.

## Version

1.0.0

---

**Note**: This extension is designed for local development workflows. It executes shell commands on your machine, so use caution when configuring commands from untrusted sources.
