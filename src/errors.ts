import { Token } from './lexer/token';

// Base class for every error NoobScript reports to the user,
// so the runtime can print them all in one consistent format.
export class NoobError extends Error {
    constructor(
        public readonly phase: 'Syntax' | 'Runtime',
        public readonly line: number,
        message: string
    ) {
        super(message);
    }

    format(): string {
        return `[line ${this.line}] ${this.phase} error: ${this.message}`;
    }
}

export class RuntimeError extends NoobError {
    constructor(public readonly token: Token, message: string) {
        super('Runtime', token.line, message);
    }
}
