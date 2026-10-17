import { Token } from '../lexer/token';

// ── Expressions ──────────────────────────────

export type Expr =
    | BinaryExpr
    | LogicalExpr
    | UnaryExpr
    | LiteralExpr
    | VariableExpr
    | AssignExpr
    | CallExpr
    | GroupingExpr;

export interface BinaryExpr {
    kind: 'Binary';
    left: Expr;
    operator: Token;
    right: Expr;
}

export interface LogicalExpr {
    kind: 'Logical'; // && and || (short-circuit)
    left: Expr;
    operator: Token;
    right: Expr;
}

export interface UnaryExpr {
    kind: 'Unary';
    operator: Token;
    right: Expr;
}

export interface LiteralExpr {
    kind: 'Literal';
    value: string | number | boolean | null;
}

export interface VariableExpr {
    kind: 'Variable';
    name: Token;
    depth?: number; // set by the resolver; undefined means global
}

export interface AssignExpr {
    kind: 'Assign';
    name: Token;
    value: Expr;
    depth?: number; // set by the resolver; undefined means global
}

export interface CallExpr {
    kind: 'Call';
    callee: Expr;
    args: Expr[];
    paren: Token; // for error reporting (line info)
}

export interface GroupingExpr {
    kind: 'Grouping';
    expression: Expr;
}

// ── Statements ────────────────────────────────

export type Stmt =
    | VarDeclStmt
    | PrintStmt
    | ExpressionStmt
    | BlockStmt
    | IfStmt
    | WhileStmt
    | ForStmt
    | FunctionDeclStmt
    | ReturnStmt
    | BreakStmt;

export interface VarDeclStmt {
    kind: 'VarDecl';
    isConst: boolean; // true for lockedin, false for vibe
    name: Token;
    initializer: Expr | null;
}

export interface PrintStmt {
    kind: 'Print'; // chat(...)
    expression: Expr;
}

export interface ExpressionStmt {
    kind: 'ExpressionStmt';
    expression: Expr;
}

export interface BlockStmt {
    kind: 'Block';
    statements: Stmt[];
    // false when the block declares nothing, so the interpreter can skip
    // allocating a scope for it (big win for loop bodies). Set by the resolver.
    scoped: boolean;
}

export interface IfStmt {
    kind: 'If';
    condition: Expr;
    thenBranch: Stmt;
    elseBranch: Stmt | null; // used for both skillissue and retry chains
}

export interface WhileStmt {
    kind: 'While'; // grind
    condition: Expr;
    body: Stmt;
}

export interface ForStmt {
    kind: 'For'; // farm
    initializer: Stmt | null;
    condition: Expr | null;
    increment: Expr | null;
    body: Stmt;
}

export interface FunctionDeclStmt {
    kind: 'FunctionDecl'; // queue
    name: Token;
    params: Token[];
    body: Stmt[];
}

export interface ReturnStmt {
    kind: 'Return'; // gg
    keyword: Token;
    value: Expr | null;
}

export interface BreakStmt {
    kind: 'Break'; // ragequit
    keyword: Token;
}
