const countFunctionLines = (node) => {
  if (!node.loc) return 0;
  return node.loc.end.line - node.loc.start.line + 1;
};

const reportFunction = (context, node, max) => {
  const lines = countFunctionLines(node);
  if (lines <= max) return;
  context.report({
    data: { lines: String(lines), max: String(max) },
    message: 'Function has {{lines}} lines; maximum allowed is {{max}}.',
    node,
  });
};

const createFunctionLineRule = (context) => {
  const max = context.options[0]?.max ?? 45;
  return {
    ArrowFunctionExpression: (node) => reportFunction(context, node, max),
    FunctionDeclaration: (node) => reportFunction(context, node, max),
    FunctionExpression: (node) => reportFunction(context, node, max),
  };
};

const createFileLineRule = (context) => ({
  Program: (node) => {
    const max = context.options[0]?.max ?? 250;
    const lines = context.sourceCode.lines.length;
    if (lines <= max) return;
    context.report({
      data: { lines: String(lines), max: String(max) },
      message: 'File has {{lines}} lines; maximum allowed is {{max}}.',
      node,
    });
  },
});

const createIndentDepthRule = (context) => ({
  Program: (node) => {
    const max = context.options[0]?.max ?? 2;
    context.sourceCode.lines.forEach((line, index) => {
      if (!line.trim()) return;
      const indent = line.length - line.trimStart().length;
      if (indent % 2 !== 0 || indent / 2 <= max) return;
      context.report({
        data: { depth: String(indent / 2), max: String(max) },
        loc: { column: 0, line: index + 1 },
        message: 'Indentation depth is {{depth}}; maximum allowed is {{max}}.',
        node,
      });
    });
  },
});

const createCentralizedTypesRule = (context) => ({
  ':matches(TSInterfaceDeclaration, TSTypeAliasDeclaration)': (node) => {
    const filename = context.filename.replaceAll('\\\\', '/');
    if (filename.includes('/cli/src/schemas/')) return;
    context.report({
      message: 'Type/interface declarations must live in cli/src/schemas/*.',
      node,
    });
  },
});

const ruleMeta = (description) => ({
  docs: { description },
  schema: [{ additionalProperties: false, properties: { max: { type: 'number' } }, type: 'object' }],
  type: 'problem',
});

export default {
  rules: {
    'centralized-types': {
      create: createCentralizedTypesRule,
      meta: ruleMeta('disallow local type/interface declarations outside schemas'),
    },
    'max-file-lines': {
      create: createFileLineRule,
      meta: ruleMeta('limit lines per file'),
    },
    'max-function-lines': {
      create: createFunctionLineRule,
      meta: ruleMeta('limit lines per function'),
    },
    'max-indent-depth': {
      create: createIndentDepthRule,
      meta: ruleMeta('limit indentation depth'),
    },
  },
};
