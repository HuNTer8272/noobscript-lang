import { Token } from '../lexer/token';
import { NoobError } from '../errors';
import { Expr, Stmt, FunctionDeclStmt, VariableExpr, AssignExpr } from '../parser/ast';

// ── Resolver ─────────────────────────────────
// A static pass between parsing and execution. It:
//  - works out how many scopes up each local variable lives, so the
//    interpreter can jump straight to it instead of searching the chain
//    (this also makes closures capture the variable that was visible
//    where they were written, not whatever is visible when called);
//  - catches mistakes before any code runs: `gg` outside a queue,
//    `ragequit` outside a loop, reading a variable in its own initializer.
//
// Each scope pushed here must line up 1:1 with an Environment the
// interpreter creates at runtime.

const isDeclaration = (stmt: Stmt) => stmt.kind === 'VarDecl' || stmt.kind === 'FunctionDecl';

export class Resolver {
    public readonly errors: NoobError[] = [];

    // name -> "finished initializing?"; globals aren't tracked.
    private readonly scopes: Map<string, boolean>[] = [];
    private inFunction = false;
    private loopDepth = 0;

    public resolve(statements: Stmt[]) {
        for (const stmt of statements) this.resolveStmt(stmt);
    }

    private error(token: Token, message: string) {
        this.errors.push(new NoobError('Syntax', token.line, message));
    }

    // ── Statements ────────────────────────────

    private resolveStmt(stmt: Stmt) {
        switch (stmt.kind) {
            case 'VarDecl':
                this.declare(stmt.name);
                if (stmt.initializer !== null) this.resolveExpr(stmt.initializer);
                this.define(stmt.name);
                break;

            case 'Print':
            case 'ExpressionStmt':
                this.resolveExpr(stmt.expression);
                break;

            case 'Block':
                // Blocks that declare nothing don't need their own scope.
                stmt.scoped = stmt.statements.some(isDeclaration);
                if (stmt.scoped) this.beginScope();
                this.resolve(stmt.statements);
                if (stmt.scoped) this.endScope();
                break;

            case 'If':
                this.resolveExpr(stmt.condition);
                this.resolveStmt(stmt.thenBranch);
                if (stmt.elseBranch !== null) this.resolveStmt(stmt.elseBranch);
                break;

            case 'While':
                this.resolveExpr(stmt.condition);
                this.resolveLoopBody(stmt.body);
                break;

            case 'For':
                this.beginScope();
                if (stmt.initializer !== null) this.resolveStmt(stmt.initializer);
                if (stmt.condition !== null) this.resolveExpr(stmt.condition);
                if (stmt.increment !== null) this.resolveExpr(stmt.increment);
                this.resolveLoopBody(stmt.body);
                this.endScope();
                break;

            case 'FunctionDecl':
                // Define the name first so the function can call itself.
                this.declare(stmt.name);
                this.define(stmt.name);
                this.resolveFunction(stmt);
                break;

            case 'Return':
                if (!this.inFunction) {
                    this.error(stmt.keyword, "Can't use 'gg' (return) outside of a queue (function).");
                }
                if (stmt.value !== null) this.resolveExpr(stmt.value);
                break;

            case 'Break':
                if (this.loopDepth === 0) {
                    this.error(stmt.keyword, "Can't use 'ragequit' (break) outside of a loop.");
                }
                break;
        }
    }

    private resolveLoopBody(body: Stmt) {
        this.loopDepth++;
        this.resolveStmt(body);
        this.loopDepth--;
    }

    private resolveFunction(fn: FunctionDeclStmt) {
        const enclosingInFunction = this.inFunction;
        const enclosingLoopDepth = this.loopDepth;
        // A `ragequit` inside a function must not break a loop in the caller.
        this.inFunction = true;
        this.loopDepth = 0;

        this.beginScope();
        for (const param of fn.params) {
            this.declare(param);
            this.define(param);
        }
        this.resolve(fn.body);
        this.endScope();

        this.inFunction = enclosingInFunction;
        this.loopDepth = enclosingLoopDepth;
    }

    // ── Expressions ───────────────────────────

    private resolveExpr(expr: Expr) {
        switch (expr.kind) {
            case 'Variable': {
                const scope = this.scopes[this.scopes.length - 1];
                if (scope?.get(expr.name.value) === false) {
                    this.error(expr.name, `Can't read '${expr.name.value}' in its own initializer.`);
                }
                this.resolveLocal(expr);
                break;
            }
            case 'Assign':
                this.resolveExpr(expr.value);
                this.resolveLocal(expr);
                break;
            case 'Binary':
            case 'Logical':
                this.resolveExpr(expr.left);
                this.resolveExpr(expr.right);
                break;
            case 'Unary':
                this.resolveExpr(expr.right);
                break;
            case 'Grouping':
                this.resolveExpr(expr.expression);
                break;
            case 'Call':
                this.resolveExpr(expr.callee);
                for (const arg of expr.args) this.resolveExpr(arg);
                break;
            case 'Literal':
                break;
        }
    }

    // ── Scope helpers ─────────────────────────

    private beginScope() {
        this.scopes.push(new Map());
    }

    private endScope() {
        this.scopes.pop();
    }

    private declare(name: Token) {
        this.scopes[this.scopes.length - 1]?.set(name.value, false);
    }

    private define(name: Token) {
        this.scopes[this.scopes.length - 1]?.set(name.value, true);
    }

    private resolveLocal(expr: VariableExpr | AssignExpr) {
        for (let i = this.scopes.length - 1; i >= 0; i--) {
            if (this.scopes[i].has(expr.name.value)) {
                expr.depth = this.scopes.length - 1 - i;
                return;
            }
        }
        // Not found locally: leave depth undefined and look it up as a global.
    }
}
