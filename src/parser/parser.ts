import { Token, TokenType } from '../lexer/token';
import { NoobError } from '../errors';
import {
    Expr, Stmt,
    VarDeclStmt, PrintStmt, ExpressionStmt, IfStmt, WhileStmt, ForStmt,
    FunctionDeclStmt, ReturnStmt, BreakStmt, CallExpr
} from './ast';

class ParseError extends Error {}

// Keywords that are lexed but not implemented yet — give a clear message
// instead of a confusing "Expected expression".
const RESERVED = new Set([
    TokenType.RANK, TokenType.GUILD, TokenType.SPAWN,
    TokenType.TRY, TokenType.CATCH, TokenType.FINALLY,
]);

export class Parser {
    private pos = 0;
    public readonly errors: NoobError[] = [];

    constructor(private readonly tokens: Token[]) {}

    // ── Entry point ──────────────────────────

    public parse(): Stmt[] {
        const statements: Stmt[] = [];
        while (!this.isAtEnd()) {
            const stmt = this.declaration();
            if (stmt !== null) statements.push(stmt);
        }
        return statements;
    }

    // ── Core helpers ─────────────────────────

    private peek(): Token {
        return this.tokens[this.pos];
    }

    private previous(): Token {
        return this.tokens[this.pos - 1];
    }

    private isAtEnd(): boolean {
        return this.peek().type === TokenType.EOF;
    }

    private advance(): Token {
        if (!this.isAtEnd()) this.pos++;
        return this.previous();
    }

    private check(type: TokenType): boolean {
        return this.peek().type === type;
    }

    private match(...types: TokenType[]): boolean {
        for (const type of types) {
            if (this.check(type)) {
                this.advance();
                return true;
            }
        }
        return false;
    }

    private consume(type: TokenType, message: string): Token {
        if (this.check(type)) return this.advance();
        throw this.error(this.peek(), message);
    }

    // Records the error and returns an exception the caller can throw
    // to unwind back to declaration(), which then resynchronizes.
    private error(token: Token, message: string): ParseError {
        const where = token.type === TokenType.EOF ? 'at end' : `at '${token.value}'`;
        this.errors.push(new NoobError('Syntax', token.line, `${where}: ${message}`));
        return new ParseError(message);
    }

    // Skip tokens until we're at a likely statement boundary,
    // so one bad statement doesn't cascade into a wall of errors.
    private synchronize() {
        this.advance();
        while (!this.isAtEnd()) {
            if (this.previous().type === TokenType.SEMICOLON) return;

            switch (this.peek().type) {
                case TokenType.VIBE:
                case TokenType.LOCKEDIN:
                case TokenType.QUEUE:
                case TokenType.SKILLCHECK:
                case TokenType.GRIND:
                case TokenType.FARM:
                case TokenType.GG:
                case TokenType.RAGEQUIT:
                case TokenType.CHAT:
                    return;
            }

            this.advance();
        }
    }

    // ── Declarations ─────────────────────────

    private declaration(): Stmt | null {
        try {
            if (this.match(TokenType.VIBE, TokenType.LOCKEDIN)) return this.varDeclaration();
            if (this.match(TokenType.QUEUE)) return this.functionDeclaration();
            return this.statement();
        } catch (err) {
            if (!(err instanceof ParseError)) throw err;
            this.synchronize();
            return null;
        }
    }

    private varDeclaration(): VarDeclStmt {
        const isConst = this.previous().type === TokenType.LOCKEDIN;
        const name = this.consume(TokenType.IDENTIFIER, "Expected variable name.");

        let initializer: Expr | null = null;
        if (this.match(TokenType.EQUAL)) {
            initializer = this.expression();
        } else if (isConst) {
            throw this.error(name, "A lockedin (const) variable needs a value.");
        }

        this.consume(TokenType.SEMICOLON, "Expected ';' after variable declaration.");
        return { kind: 'VarDecl', isConst, name, initializer };
    }

    private functionDeclaration(): FunctionDeclStmt {
        const name = this.consume(TokenType.IDENTIFIER, "Expected function name.");
        this.consume(TokenType.LEFT_PAREN, "Expected '(' after function name.");

        const params: Token[] = [];
        if (!this.check(TokenType.RIGHT_PAREN)) {
            do {
                params.push(this.consume(TokenType.IDENTIFIER, "Expected parameter name."));
            } while (this.match(TokenType.COMMA));
        }
        this.consume(TokenType.RIGHT_PAREN, "Expected ')' after parameters.");

        this.consume(TokenType.LEFT_BRACE, "Expected '{' before function body.");
        const body = this.block();

        return { kind: 'FunctionDecl', name, params, body };
    }

    // ── Statements ────────────────────────────

    private statement(): Stmt {
        if (this.match(TokenType.CHAT)) return this.printStatement();
        if (this.match(TokenType.LEFT_BRACE)) return { kind: 'Block', statements: this.block(), scoped: true };
        if (this.match(TokenType.SKILLCHECK)) return this.ifStatement();
        if (this.match(TokenType.GRIND)) return this.whileStatement();
        if (this.match(TokenType.FARM)) return this.forStatement();
        if (this.match(TokenType.GG)) return this.returnStatement();
        if (this.match(TokenType.RAGEQUIT)) return this.breakStatement();

        if (RESERVED.has(this.peek().type)) {
            throw this.error(this.peek(), `'${this.peek().value}' is reserved but not supported yet.`);
        }

        return this.expressionStatement();
    }

    private printStatement(): PrintStmt {
        this.consume(TokenType.LEFT_PAREN, "Expected '(' after 'chat'.");
        const value = this.expression();
        this.consume(TokenType.RIGHT_PAREN, "Expected ')' after value.");
        this.consume(TokenType.SEMICOLON, "Expected ';' after chat statement.");
        return { kind: 'Print', expression: value };
    }

    private block(): Stmt[] {
        const statements: Stmt[] = [];
        while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
            const stmt = this.declaration();
            if (stmt !== null) statements.push(stmt);
        }
        this.consume(TokenType.RIGHT_BRACE, "Expected '}' after block.");
        return statements;
    }

    // skillcheck (cond) { ... } retry (cond) { ... } ... skillissue { ... }
    // 'retry' chains desugar into nested else-if IfStmts.
    private ifStatement(): IfStmt {
        const keyword = this.previous().value;
        this.consume(TokenType.LEFT_PAREN, `Expected '(' after '${keyword}'.`);
        const condition = this.expression();
        this.consume(TokenType.RIGHT_PAREN, "Expected ')' after condition.");

        const thenBranch = this.statement();
        let elseBranch: Stmt | null = null;

        if (this.match(TokenType.RETRY)) {
            // 'retry' behaves exactly like another if, nested as the else branch
            elseBranch = this.ifStatement();
        } else if (this.match(TokenType.SKILLISSUE)) {
            elseBranch = this.statement();
        }

        return { kind: 'If', condition, thenBranch, elseBranch };
    }

    private whileStatement(): WhileStmt {
        this.consume(TokenType.LEFT_PAREN, "Expected '(' after 'grind'.");
        const condition = this.expression();
        this.consume(TokenType.RIGHT_PAREN, "Expected ')' after condition.");
        const body = this.statement();
        return { kind: 'While', condition, body };
    }

    // Classic C-style for loop:
    // farm (vibe i = 0; i < 10; i = i + 1) { ... }
    private forStatement(): ForStmt {
        this.consume(TokenType.LEFT_PAREN, "Expected '(' after 'farm'.");

        let initializer: Stmt | null;
        if (this.match(TokenType.SEMICOLON)) {
            initializer = null;
        } else if (this.match(TokenType.VIBE, TokenType.LOCKEDIN)) {
            initializer = this.varDeclaration();
        } else {
            initializer = this.expressionStatement();
        }

        let condition: Expr | null = null;
        if (!this.check(TokenType.SEMICOLON)) {
            condition = this.expression();
        }
        this.consume(TokenType.SEMICOLON, "Expected ';' after loop condition.");

        let increment: Expr | null = null;
        if (!this.check(TokenType.RIGHT_PAREN)) {
            increment = this.expression();
        }
        this.consume(TokenType.RIGHT_PAREN, "Expected ')' after farm clauses.");

        const body = this.statement();

        return { kind: 'For', initializer, condition, increment, body };
    }

    private returnStatement(): ReturnStmt {
        const keyword = this.previous();
        let value: Expr | null = null;
        if (!this.check(TokenType.SEMICOLON)) {
            value = this.expression();
        }
        this.consume(TokenType.SEMICOLON, "Expected ';' after gg (return).");
        return { kind: 'Return', keyword, value };
    }

    private breakStatement(): BreakStmt {
        const keyword = this.previous();
        this.consume(TokenType.SEMICOLON, "Expected ';' after ragequit (break).");
        return { kind: 'Break', keyword };
    }

    private expressionStatement(): ExpressionStmt {
        const expr = this.expression();
        this.consume(TokenType.SEMICOLON, "Expected ';' after expression.");
        return { kind: 'ExpressionStmt', expression: expr };
    }

    // ── Expressions (precedence climbing) ────
    // assignment → or → and → equality → comparison → term → factor → unary → call → primary

    private expression(): Expr {
        return this.assignment();
    }

    private assignment(): Expr {
        const expr = this.or();

        if (this.match(TokenType.EQUAL)) {
            const equals = this.previous();
            const value = this.assignment(); // right-associative

            if (expr.kind === 'Variable') {
                return { kind: 'Assign', name: expr.name, value };
            }

            // Report but don't unwind: the parser isn't confused, just the target is wrong.
            this.error(equals, "Invalid assignment target.");
        }

        return expr;
    }

    private or(): Expr {
        let expr = this.and();
        while (this.match(TokenType.OR)) {
            const operator = this.previous();
            const right = this.and();
            expr = { kind: 'Logical', left: expr, operator, right };
        }
        return expr;
    }

    private and(): Expr {
        let expr = this.equality();
        while (this.match(TokenType.AND)) {
            const operator = this.previous();
            const right = this.equality();
            expr = { kind: 'Logical', left: expr, operator, right };
        }
        return expr;
    }

    // Shared loop for all left-associative binary precedence levels.
    private binary(next: () => Expr, ...types: TokenType[]): Expr {
        let expr = next();
        while (this.match(...types)) {
            const operator = this.previous();
            const right = next();
            expr = { kind: 'Binary', left: expr, operator, right };
        }
        return expr;
    }

    private equality(): Expr {
        return this.binary(() => this.comparison(), TokenType.EQUAL_EQUAL, TokenType.BANG_EQUAL);
    }

    private comparison(): Expr {
        return this.binary(
            () => this.term(),
            TokenType.GREATER, TokenType.GREATER_EQUAL,
            TokenType.LESS, TokenType.LESS_EQUAL
        );
    }

    private term(): Expr {
        return this.binary(() => this.factor(), TokenType.PLUS, TokenType.MINUS);
    }

    private factor(): Expr {
        return this.binary(() => this.unary(), TokenType.STAR, TokenType.SLASH, TokenType.PERCENT);
    }

    private unary(): Expr {
        if (this.match(TokenType.BANG, TokenType.MINUS)) {
            const operator = this.previous();
            const right = this.unary();
            return { kind: 'Unary', operator, right };
        }
        return this.call();
    }

    private call(): Expr {
        let expr = this.primary();

        while (this.match(TokenType.LEFT_PAREN)) {
            expr = this.finishCall(expr);
        }

        return expr;
    }

    private finishCall(callee: Expr): CallExpr {
        const args: Expr[] = [];
        if (!this.check(TokenType.RIGHT_PAREN)) {
            do {
                args.push(this.expression());
            } while (this.match(TokenType.COMMA));
        }

        const paren = this.consume(TokenType.RIGHT_PAREN, "Expected ')' after arguments.");
        return { kind: 'Call', callee, args, paren };
    }

    private primary(): Expr {
        if (this.match(TokenType.TRUE)) return { kind: 'Literal', value: true };
        if (this.match(TokenType.FALSE)) return { kind: 'Literal', value: false };
        if (this.match(TokenType.NULL)) return { kind: 'Literal', value: null };
        if (this.match(TokenType.NUMBER)) {
            return { kind: 'Literal', value: Number(this.previous().value) };
        }
        if (this.match(TokenType.STRING)) {
            return { kind: 'Literal', value: this.previous().value };
        }
        if (this.match(TokenType.IDENTIFIER)) {
            return { kind: 'Variable', name: this.previous() };
        }
        if (this.match(TokenType.LEFT_PAREN)) {
            const expr = this.expression();
            this.consume(TokenType.RIGHT_PAREN, "Expected ')' after expression.");
            return { kind: 'Grouping', expression: expr };
        }

        throw this.error(this.peek(), "Expected expression.");
    }
}
