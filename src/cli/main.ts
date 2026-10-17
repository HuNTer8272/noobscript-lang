#!/usr/bin/env node
/// <reference types="node" />
import { readFileSync } from "fs";
import { createInterface } from "readline";
import { Worker, isMainThread, workerData } from "worker_threads";
import { Runtime } from "../runtime/runtime";

const USAGE = "Usage: noob [file.noob]   (no file starts the REPL)";

// A tree-walking interpreter uses ~10 JS frames per NoobScript call, so the
// main thread's ~1MB stack caps recursion at ~900 calls. Files run in a
// worker thread with a much larger stack instead.
const WORKER_STACK_MB = 256;

function runFileInWorker(path: string) {
    const worker = new Worker(__filename, {
        workerData: { path },
        resourceLimits: { stackSizeMb: WORKER_STACK_MB },
    });
    worker.on("error", (err) => {
        console.error(err);
        process.exitCode = 1;
    });
    worker.on("exit", (code) => {
        if (code !== 0) process.exitCode = code;
    });
}

function runFile(path: string) {
    let source: string;
    try {
        source = readFileSync(path, "utf8");
    } catch {
        console.error(`Can't open file '${path}'.`);
        process.exitCode = 1;
        return;
    }

    // Strip a UTF-8 BOM (common on Windows) so it isn't lexed as a stray character.
    if (source.charCodeAt(0) === 0xfeff) source = source.slice(1);

    // Use exitCode instead of process.exit() so piped output gets flushed.
    if (!new Runtime().run(source)) process.exitCode = 1;
}

function runRepl() {
    const runtime = new Runtime(); // shared so variables persist between lines
    const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: "noob> " });

    console.log("NoobScript REPL — press Ctrl+C to ragequit.");
    rl.prompt();
    rl.on("line", (line) => {
        if (line.trim() !== "") runtime.run(line);
        rl.prompt();
    });
}

const args = process.argv.slice(2);

if (!isMainThread) {
    runFile(workerData.path);
} else if (args[0] === "-h" || args[0] === "--help" || args.length > 1) {
    console.log(USAGE);
    if (args.length > 1) process.exitCode = 64;
} else if (args.length === 1) {
    runFileInWorker(args[0]);
} else {
    runRepl();
}
