// NoobScript VS Code extension: adds a "Run NoobScript File" command
// (▶ button in the editor title bar) that runs the current .noob file
// with the `noob` CLI in an integrated terminal — like the Python extension.
const vscode = require('vscode');

const TERMINAL_NAME = 'NoobScript';

function getTerminal() {
    const existing = vscode.window.terminals.find((t) => t.name === TERMINAL_NAME && t.exitStatus === undefined);
    return existing ?? vscode.window.createTerminal(TERMINAL_NAME);
}

async function runFile(uri) {
    const target = uri ?? vscode.window.activeTextEditor?.document.uri;
    if (!target) {
        vscode.window.showErrorMessage('Open a .noob file to run it.');
        return;
    }

    const doc = await vscode.workspace.openTextDocument(target);
    if (doc.isUntitled) {
        vscode.window.showErrorMessage('Save this file with a .noob extension before running it.');
        return;
    }
    if (doc.isDirty) await doc.save();

    const command = vscode.workspace.getConfiguration('noobscript').get('command', 'noob');
    const terminal = getTerminal();
    terminal.show(true);
    terminal.sendText(`${command} "${doc.uri.fsPath}"`);
}

function activate(context) {
    context.subscriptions.push(vscode.commands.registerCommand('noobscript.runFile', runFile));
}

function deactivate() {}

module.exports = { activate, deactivate };
