const vscode = require('vscode');
const { exec } = require('child_process');

let watchers = [];

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    try {
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('Remote File Watcher: No workspace folder open!');
            return;
        }

        // Initialize watchers from configuration
        startWatchers();

        // Register command to open settings UI
        context.subscriptions.push(
            vscode.commands.registerCommand('remoteFileWatcher.openSettings', () => {
                SettingsPanel.createOrShow(context.extensionUri);
            })
        );

        // Listen for configuration changes
        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('remoteFileWatcher')) {
                    stopAllWatchers();
                    startWatchers();
                }
            })
        );

    } catch (error) {
        vscode.window.showErrorMessage(`Remote File Watcher failed: ${error.message}`);
    }
}

function startWatchers() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return;
    }

    const workspaceUri = workspaceFolders[0].uri;
    const config = vscode.workspace.getConfiguration('remoteFileWatcher');
    const watcherConfigs = config.get('watchers', []);
    const showNotifications = config.get('showNotifications', true);

    watcherConfigs.forEach((watcherConfig, index) => {
        try {
            const fileUri = vscode.Uri.joinPath(workspaceUri, watcherConfig.filePath);
            const command = watcherConfig.command;

            const onChangeCallback = () => {
                if (showNotifications) {
                    vscode.window.showInformationMessage(`File changed: ${watcherConfig.filePath}`);
                }
                executeCommand(command, fileUri.fsPath);
            };

            const watcher = new FileWatcher(fileUri, onChangeCallback);
            watcher.start();
            watchers.push(watcher);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to start watcher for ${watcherConfig.filePath}: ${error.message}`);
        }
    });
}

function stopAllWatchers() {
    watchers.forEach(watcher => watcher.stop());
    watchers = [];
}


class FileWatcher {
    constructor(fileUri, onChange) {
        this.fileUri = fileUri;
        this.onChange = onChange;
        this.fsWatcher = null;
        this.debounceTimer = null;
        this.debounceDelay = 300; // ms - prevent multiple triggers within this time
    }

    triggerChange() {
        // Debounce to prevent multiple rapid triggers
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            this.onChange();
            this.debounceTimer = null;
        }, this.debounceDelay);
    }

    start() {
        // Create a relative pattern for the file
        const workspacePath = vscode.workspace.workspaceFolders[0].uri.path;
        const filePath = this.fileUri.path;

        // Extract relative path properly
        let relativePath = filePath;
        if (filePath.startsWith(workspacePath)) {
            relativePath = filePath.substring(workspacePath.length);
            if (relativePath.startsWith('/')) {
                relativePath = relativePath.substring(1);
            }
        }

        const pattern = new vscode.RelativePattern(
            vscode.workspace.workspaceFolders[0],
            relativePath
        );

        this.fsWatcher = vscode.workspace.createFileSystemWatcher(pattern);

        // Listen for file creation and changes
        this.fsWatcher.onDidCreate(() => this.triggerChange());
        this.fsWatcher.onDidChange(() => this.triggerChange());
    }

    stop() {
        if (this.fsWatcher) {
            this.fsWatcher.dispose();
            this.fsWatcher = null;
        }
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
    }
}

function executeCommand(command, filePath) {
    // Replace ${file} placeholder with the actual file path
    const finalCommand = command.replace(/\$\{file\}/g, filePath);

    exec(finalCommand, (error, stdout, stderr) => {
        if (error) {
            vscode.window.showErrorMessage(`Command failed: ${error.message}`);
        }
    });
}

function deactivate() {
    stopAllWatchers();
}

class SettingsPanel {
    static currentPanel = undefined;

    static createOrShow(extensionUri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (SettingsPanel.currentPanel) {
            SettingsPanel.currentPanel._panel.reveal(column);
            return;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            'remoteFileWatcherSettings',
            'Remote File Watcher Settings',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        SettingsPanel.currentPanel = new SettingsPanel(panel, extensionUri);
    }

    constructor(panel, extensionUri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'getConfig':
                        this._sendConfig();
                        return;
                    case 'saveConfig':
                        this._saveConfig(message);
                        return;
                }
            },
            null
        );

        // Send initial config after a short delay to ensure webview is ready
        setTimeout(() => {
            this._sendConfig();
        }, 100);
    }

    dispose() {
        SettingsPanel.currentPanel = undefined;
        this._panel.dispose();
    }

    _sendConfig() {
        const config = vscode.workspace.getConfiguration('remoteFileWatcher');
        const watchers = config.get('watchers', []);
        const showNotifications = config.get('showNotifications', true);
        this._panel.webview.postMessage({ command: 'configData', watchers, showNotifications });
    }

    async _saveConfig(data) {
        try {
            const config = vscode.workspace.getConfiguration('remoteFileWatcher');
            await config.update('watchers', data.watchers, vscode.ConfigurationTarget.Workspace);
            await config.update('showNotifications', data.showNotifications, vscode.ConfigurationTarget.Workspace);
            vscode.window.showInformationMessage('Configuration saved!');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to save configuration: ${error.message}`);
        }
    }

    _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    _getHtmlForWebview(webview) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Remote File Watcher Settings</title>
    <style>
        body {
            padding: 20px;
            color: var(--vscode-foreground);
            font-family: var(--vscode-font-family);
        }
        h1 {
            font-size: 24px;
            margin-bottom: 20px;
        }
        .watcher-item {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            padding: 15px;
            margin-bottom: 15px;
            border-radius: 4px;
        }
        .form-group {
            margin-bottom: 15px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: 600;
        }
        input[type="text"],
        input[type="number"],
        textarea {
            width: 100%;
            padding: 8px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            font-family: var(--vscode-font-family);
        }
        textarea {
            min-height: 60px;
            resize: vertical;
        }
        button {
            padding: 8px 16px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
            margin-right: 10px;
        }
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .remove-btn {
            background: var(--vscode-errorForeground);
            float: right;
        }
        .add-btn {
            margin-top: 10px;
        }
        .save-btn {
            background: var(--vscode-button-background);
            margin-top: 20px;
            font-size: 14px;
            padding: 10px 20px;
        }
        .help-text {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
        }
    </style>
</head>
<body>
    <h1>Remote File Watcher Configuration</h1>

    <div style="margin-bottom: 20px; padding: 15px; background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); border-radius: 4px;">
        <label style="display: flex; align-items: center; cursor: pointer;">
            <input type="checkbox" id="showNotifications" style="width: auto; margin-right: 8px;">
            <span>Show notification popups when files change</span>
        </label>
        <div class="help-text" style="margin-top: 8px; margin-left: 24px;">
            When disabled, commands will still execute but no VS Code notification will appear
        </div>
    </div>

    <div id="watchers-container"></div>
    <button class="add-btn" onclick="addWatcher()">+ Add Watcher</button>
    <br>
    <button class="save-btn" onclick="saveConfig()">Save Configuration</button>

    <script>
        const vscode = acquireVsCodeApi();
        let watchers = [];
        let showNotifications = true;

        // Request config on load
        vscode.postMessage({ command: 'getConfig' });

        // Listen for messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'configData') {
                watchers = message.watchers;
                showNotifications = message.showNotifications !== undefined ? message.showNotifications : true;
                document.getElementById('showNotifications').checked = showNotifications;
                renderWatchers();
            }
        });

        function renderWatchers() {
            const container = document.getElementById('watchers-container');
            container.innerHTML = '';

            if (watchers.length === 0) {
                container.innerHTML = '<p style="color: var(--vscode-descriptionForeground);">No watchers configured. Click "Add Watcher" to create one.</p>';
                return;
            }

            watchers.forEach((watcher, index) => {
                const div = document.createElement('div');
                div.className = 'watcher-item';

                // Create elements programmatically to avoid escaping issues
                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-btn';
                removeBtn.textContent = 'Remove';
                removeBtn.onclick = () => removeWatcher(index);

                const filePathGroup = document.createElement('div');
                filePathGroup.className = 'form-group';
                const filePathLabel = document.createElement('label');
                filePathLabel.textContent = 'File Path';
                filePathGroup.appendChild(filePathLabel);
                const filePathInput = document.createElement('input');
                filePathInput.type = 'text';
                filePathInput.id = 'filePath-' + index;
                filePathInput.value = watcher.filePath || '';
                filePathInput.placeholder = 'path/to/watched/file.txt';
                filePathGroup.appendChild(filePathInput);
                const filePathHelp = document.createElement('div');
                filePathHelp.className = 'help-text';
                filePathHelp.textContent = 'Relative path from workspace root';
                filePathGroup.appendChild(filePathHelp);

                const commandGroup = document.createElement('div');
                commandGroup.className = 'form-group';
                commandGroup.innerHTML = '<label>Command</label>';
                const commandTextarea = document.createElement('textarea');
                commandTextarea.id = 'command-' + index;
                commandTextarea.value = watcher.command || '';
                commandTextarea.placeholder = 'Command to execute...';
                commandGroup.appendChild(commandTextarea);
                const helpText = document.createElement('div');
                helpText.className = 'help-text';
                helpText.textContent = 'Use ' + String.fromCharCode(36) + '{file} as placeholder for file path';
                commandGroup.appendChild(helpText);

                div.appendChild(removeBtn);
                div.appendChild(filePathGroup);
                div.appendChild(commandGroup);
                container.appendChild(div);
            });
        }

        function addWatcher() {
            watchers.push({
                filePath: '',
                command: ''
            });
            renderWatchers();
        }

        function removeWatcher(index) {
            watchers.splice(index, 1);
            renderWatchers();
        }

        function saveConfig() {
            // Collect values from form
            const updatedWatchers = watchers.map((watcher, index) => {
                const filePathEl = document.getElementById('filePath-' + index);
                const commandEl = document.getElementById('command-' + index);

                if (!filePathEl || !commandEl) {
                    return watcher;
                }

                return {
                    filePath: filePathEl.value,
                    command: commandEl.value
                };
            });

            const showNotificationsEl = document.getElementById('showNotifications');

            vscode.postMessage({
                command: 'saveConfig',
                watchers: updatedWatchers,
                showNotifications: showNotificationsEl.checked
            });
        }
    </script>
</body>
</html>`;
    }
}

module.exports = {
    activate,
    deactivate
};
