import { Environment } from '../interpreter/environment';
import { Interpreter, stringify } from '../interpreter/interpreter';
import { NativeFunction } from '../interpreter/callable';
import { Resolver } from '../interpreter/resolver';
import { Lexer } from '../lexer/lexer';
import { Parser } from '../parser/parser';
import { NoobError } from '../errors';

// ── Native functions ─────────────────────────
// These are the "standard library" — built-ins that aren't
// written in NoobScript itself, just plain TS.

function createGlobals(): Environment {
    const globals = new Environment();
    const native = (name: string, arity: number, fn: (args: any[]) => any) =>
        globals.define(name, new NativeFunction(arity, fn, name), true);

    native('clock', 0, () => Date.now() / 1000);

    native('len', 1, ([val]) => {
        if (typeof val === 'string' || Array.isArray(val)) return val.length;
        throw new Error('len() expects a string or array.');
    });

    native('rng', 2, ([min, max]) => {
        if (!Number.isInteger(min) || !Number.isInteger(max)) {
            throw new Error('rng() expects two whole numbers.');
        }
        if (min > max) throw new Error(`rng() needs min <= max, got ${min} and ${max}.`);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    });

    native('str', 1, ([val]) => stringify(val));

    native('num', 1, ([val]) => {
        const n = typeof val === 'string' && val.trim() !== '' ? Number(val) : val;
        if (typeof n !== 'number' || !Number.isFinite(n)) {
            throw new Error(`num() can't convert '${stringify(val)}' to a number.`);
        }
        return n;
    });

    return globals;
}

// ── Runtime orchestrator ─────────────────────
// Wires lexer -> parser -> resolver -> interpreter together and owns
// the globals so a REPL can reuse the same environment across inputs.

export interface RuntimeIO {
    out?: (text: string) => void; // program output (`chat`)
    err?: (text: string) => void; // error reports
}

export class Runtime {
    private readonly interpreter: Interpreter;
    private readonly err: (text: string) => void;

    constructor({ out = console.log, err = console.error }: RuntimeIO = {}) {
        this.interpreter = new Interpreter(createGlobals(), out);
        this.err = err;
    }

    // Runs a full source string end-to-end. Returns false if any error was reported.
    public run(source: string): boolean {
        const lexer = new Lexer(source);
        const tokens = lexer.tokenize();
        // Lexer errors usually cause follow-on parse errors, so report them alone.
        if (lexer.errors.length > 0) return this.report(lexer.errors);

        const parser = new Parser(tokens);
        const statements = parser.parse();
        if (parser.errors.length > 0) return this.report(parser.errors);

        const resolver = new Resolver();
        resolver.resolve(statements);
        if (resolver.errors.length > 0) return this.report(resolver.errors);

        try {
            this.interpreter.interpret(statements);
            return true;
        } catch (err) {
            if (err instanceof NoobError) return this.report([err]);
            if (err instanceof RangeError && /call stack/i.test(err.message)) {
                this.err('Runtime error: Stack overflow — a queue (function) recursed too deeply.');
                return false;
            }
            throw err; // a bug in the interpreter itself
        }
    }

    private report(errors: NoobError[]): false {
        for (const error of errors) this.err(error.format());
        return false;
    }
}
