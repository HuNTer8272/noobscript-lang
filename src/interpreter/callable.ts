import { Token } from '../lexer/token';
import { NoobError, RuntimeError } from '../errors';
import type { Interpreter } from './interpreter';

// Base class for anything callable from NoobScript.
// A class (not an interface) so the interpreter can use `instanceof`.
export abstract class NoobCallable {
    abstract readonly arity: number;
    abstract call(interpreter: Interpreter, args: any[], callToken: Token): any;
    abstract toString(): string;
}

// Built-ins written in TS. Any plain Error thrown by `fn` is turned into a
// RuntimeError that points at the call site, so users get a line number.
export class NativeFunction extends NoobCallable {
    constructor(
        public readonly arity: number,
        private readonly fn: (args: any[], interpreter: Interpreter) => any,
        private readonly name: string
    ) {
        super();
    }

    call(interpreter: Interpreter, args: any[], callToken: Token): any {
        try {
            return this.fn(args, interpreter);
        } catch (err) {
            if (err instanceof NoobError || !(err instanceof Error)) throw err;
            throw new RuntimeError(callToken, err.message);
        }
    }

    toString(): string {
        return `<native ${this.name}>`;
    }
}
