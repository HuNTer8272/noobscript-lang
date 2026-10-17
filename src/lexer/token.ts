export enum TokenType {
  // Keywords
  VIBE,
  LOCKEDIN,
  SKILLCHECK,
  RETRY,
  SKILLISSUE,
  RANK,
  GRIND,
  FARM,
  QUEUE,
  GG,
  RAGEQUIT,   // break
  CHAT,
  GUILD,
  SPAWN,
  TRY,
  CATCH,
  FINALLY,
  TRUE,
  FALSE,
  NULL,       // nihil

  // Literals
  IDENTIFIER,
  NUMBER,
  STRING,

  // Operators
  EQUAL,
  PLUS,
  MINUS,
  STAR,
  SLASH,
  PERCENT,

  EQUAL_EQUAL,
  BANG,
  BANG_EQUAL,

  GREATER,
  GREATER_EQUAL,
  LESS,
  LESS_EQUAL,

  AND,
  OR,

  // Symbols
  LEFT_PAREN,
  RIGHT_PAREN,
  LEFT_BRACE,
  RIGHT_BRACE,

  COMMA,
  DOT,
  SEMICOLON,

  EOF
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
}

// A Map (not a plain object) so identifiers like `constructor` or
// `toString` don't accidentally match Object.prototype members.
export const KEYWORDS: ReadonlyMap<string, TokenType> = new Map([
  ['vibe', TokenType.VIBE],
  ['lockedin', TokenType.LOCKEDIN],

  ['skillcheck', TokenType.SKILLCHECK],
  ['retry', TokenType.RETRY],
  ['skillissue', TokenType.SKILLISSUE],

  ['rank', TokenType.RANK],

  ['grind', TokenType.GRIND],
  ['farm', TokenType.FARM],

  ['queue', TokenType.QUEUE],
  ['gg', TokenType.GG],
  ['ragequit', TokenType.RAGEQUIT],

  ['chat', TokenType.CHAT],

  ['guild', TokenType.GUILD],
  ['spawn', TokenType.SPAWN],

  ['try', TokenType.TRY],
  ['catch', TokenType.CATCH],
  ['finally', TokenType.FINALLY],

  ['true', TokenType.TRUE],
  ['false', TokenType.FALSE],
  ['nihil', TokenType.NULL],
  ['null', TokenType.NULL],
]);
