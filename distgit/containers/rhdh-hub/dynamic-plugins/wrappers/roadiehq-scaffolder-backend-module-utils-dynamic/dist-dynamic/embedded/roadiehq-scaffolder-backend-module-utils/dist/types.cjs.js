'use strict';

const yamlOptionsSchema = {
  title: "Options",
  description: "YAML stringify options",
  type: "object",
  properties: {
    blockQuote: {
      description: "(default: true) - use block quote styles for scalar values where applicable",
      type: "boolean | 'folded' | 'literal'"
    },
    collectionStyle: {
      description: "(default: 'any') - enforce 'block' or 'flow' style on maps and sequences. By default, allows each collection to set its own flow: boolean property",
      type: "'any' | 'block' | 'flow'"
    },
    defaultKeyType: {
      description: "(default: null) - if not null, overrides defaultStringType for implicit key values",
      type: "'BLOCK_FOLDED' \u23AE 'BLOCK_LITERAL' \u23AE 'QUOTE_DOUBLE' \u23AE 'QUOTE_SINGLE' \u23AE 'PLAIN' \u23AE null"
    },
    defaultStringType: {
      description: "(default: 'PLAIN') - the default type of string literal used to stringify values",
      type: "'BLOCK_FOLDED' \u23AE 'BLOCK_LITERAL' \u23AE 'QUOTE_DOUBLE' \u23AE 'QUOTE_SINGLE' \u23AE 'PLAIN'"
    },
    directives: {
      description: "(default: null) - include directives in the output. If true, at least the document-start marker --- is always included. If false, no directives or marker is ever included. If null, directives and marker may be included if required",
      type: "boolean | null"
    },
    doubleQuotedAsJSON: {
      description: "(default: false) - if true, restrict double-quoted strings to use JSON-compatible syntax",
      type: "boolean"
    },
    doubleQuotedMinMultiLineLength: {
      description: "(default: 40) - minimum length for double-quoted strings to use multiple lines to represent the value instead of escaping newlines",
      type: "number"
    },
    falseStr: {
      description: "(default: 'false') - string representation for false boolean values",
      type: "string"
    },
    flowCollectionPadding: {
      description: "(default: true) - if true, a single space of padding will be added inside the delimiters of non-empty single-line flow collections",
      type: "boolean"
    },
    indent: {
      description: "(default: 2) - the number of spaces to use when indenting code. Should be a strictly positive integer",
      type: "number"
    },
    indentSeq: {
      description: "(default: true) - if true, block sequences should be indented",
      type: "boolean"
    },
    lineWidth: {
      description: "(default: 80) -maximum line width (set to 0 to disable folding). This is a soft limit, as only double-quoted semantics allow for inserting a line break in the middle of a word ",
      type: "number"
    },
    minContentWidth: {
      description: "(default: 20) - minimum line width for highly-indented content (set to 0 to disable)",
      type: "number"
    },
    nullStr: {
      description: "(default: 'null') - string representation for null values",
      type: "number"
    },
    simpleKeys: {
      description: "(default: false) - if true, require keys to be scalars and always use implicit rather than explicit notation",
      type: "boolean"
    },
    singleQuote: {
      description: "(default: null) - Use single quote rather than double quote where applicable. Set to false to disable single quotes completely",
      type: "boolean | null"
    },
    trueStr: {
      description: "(default: 'true') - string representation for true boolean values",
      type: "string"
    }
  }
};

exports.yamlOptionsSchema = yamlOptionsSchema;
//# sourceMappingURL=types.cjs.js.map
