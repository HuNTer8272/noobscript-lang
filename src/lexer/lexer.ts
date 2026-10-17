import { TokenType, Token, KEYWORDS } from './token';
import { NoobError } from '../errors';

const ESCAPES: Record<string, string> = {
    n: '\n',
    t: '\t',
    r: '\r',
    '0': '\0',
    '"': '"',
    '\\': '\\',
};

function isDigit(c: string): boolean {
    return c >= '0' && c <= '9';
}

function isAlpha(c: string): boolean {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
}

function isAlphaNumeric(c: string): boolean {
    return isAlpha(c) || isDigit(c);
}

export class Lexer {
    private readonly tokens: Token[] = [];
    public readonly errors: NoobError[] = [];

    private start = 0; // first char of the token being scanned
    private pos = 0;
    private line = 1;

    constructor(private readonly source: string) {}

    public tokenize(): Token[] {
        while (!this.isAtEnd()) {
            this.start = this.pos;
            this.scanToken();
        }

        this.tokens.push({ type: TokenType.EOF, value: '', line: this.line });
        return this.tokens;
    }

    private isAtEnd(): boolean {
        return this.pos >= this.source.length;
    }

    private advance(): string {
        return this.source[this.pos++];
    }

    private peek(): string {
        if (this.isAtEnd()) return '\0';
        return this.source[this.pos];
    }

    private peekNext(): string {
        if (this.pos + 1 >= this.source.length) return '\0';
        return this.source[this.pos + 1];
    }

    // Conditionally consume the next char if it matches `expected`.
    // This is what lets '=' become '==' or '!' become '!='.
    private match(expected: string): boolean {
        if (this.isAtEnd()) return false;
        if (this.source[this.pos] !== expected) return false;
        this.pos++;
        return true;
    }

    // Defaults to the raw source text of the current token.
    private addToken(type: TokenType, value = this.source.slice(this.start, this.pos), line = this.line) {
        this.tokens.push({ type, value, line });
    }

    private error(message: string, line = this.line) {
        this.errors.push(new NoobError('Syntax', line, message));
    }

    private number() {
        while (isDigit(this.peek())) this.pos++;

        // decimal support: 3.14
        if (this.peek() === '.' && isDigit(this.peekNext())) {
            this.pos++; // consume '.'
            while (isDigit(this.peek())) this.pos++;
        }

        this.addToken(TokenType.NUMBER);
    }

    private identifier() {
        while (isAlphaNumeric(this.peek())) this.pos++;

        const text = this.source.slice(this.start, this.pos);
        this.addToken(KEYWORDS.get(text) ?? TokenType.IDENTIFIER, text);
    }

    private string() {
        const startLine = this.line;
        let value = '';
        let chunkStart = this.pos; // copy plain runs in bulk instead of char by char

        while (this.peek() !== '"' && !this.isAtEnd()) {
            const c = this.advance();
            if (c === '\n') {
                this.line++;
            } else if (c === '\\' && !this.isAtEnd()) {
                value += this.source.slice(chunkStart, this.pos - 1);
                const escaped = this.advance();
                const replacement = ESCAPES[escaped];
                if (replacement === undefined) {
                    this.error(`Unknown escape sequence '\\${escaped}' in string.`);
                }
                value += replacement ?? escaped;
                chunkStart = this.pos;
            }
        }

        if (this.isAtEnd()) {
            this.error('Unterminated string.', startLine);
            return;
        }

        value += this.source.slice(chunkStart, this.pos);
        this.pos++; // consume closing "
        this.addToken(TokenType.STRING, value, startLine);
    }

    private scanToken() {
        const c = this.advance();

        switch (c) {
            case '(': this.addToken(TokenType.LEFT_PAREN); break;
            case ')': this.addToken(TokenType.RIGHT_PAREN); break;
            case '{': this.addToken(TokenType.LEFT_BRACE); break;
            case '}': this.addToken(TokenType.RIGHT_BRACE); break;
            case ',': this.addToken(TokenType.COMMA); break;
            case '.': this.addToken(TokenType.DOT); break;
            case ';': this.addToken(TokenType.SEMICOLON); break;
            case '+': this.addToken(TokenType.PLUS); break;
            case '-': this.addToken(TokenType.MINUS); break;
            case '*': this.addToken(TokenType.STAR); break;
            case '%': this.addToken(TokenType.PERCENT); break;

            case '/':
                if (this.match('/')) {
                    // line comment: consume till newline
                    while (this.peek() !== '\n' && !this.isAtEnd()) this.pos++;
                } else {
                    this.addToken(TokenType.SLASH);
                }
                break;

            // multi-char operators via lookahead
            case '=': this.addToken(this.match('=') ? TokenType.EQUAL_EQUAL : TokenType.EQUAL); break;
            case '!': this.addToken(this.match('=') ? TokenType.BANG_EQUAL : TokenType.BANG); break;
            case '>': this.addToken(this.match('=') ? TokenType.GREATER_EQUAL : TokenType.GREATER); break;
            case '<': this.addToken(this.match('=') ? TokenType.LESS_EQUAL : TokenType.LESS); break;

            case '&':
                if (this.match('&')) this.addToken(TokenType.AND);
                else this.error(`Unexpected character '&'. Did you mean '&&'?`);
                break;
            case '|':
                if (this.match('|')) this.addToken(TokenType.OR);
                else this.error(`Unexpected character '|'. Did you mean '||'?`);
                break;

            case '"':
                this.string();
                break;

            case '\n': this.line++; break;
            case ' ':
            case '\t':
            case '\r':
                break;

            default:
                if (isDigit(c)) this.number();
                else if (isAlpha(c)) this.identifier();
                else this.error(`Unexpected character '${c}'.`);
        }
    }
}
