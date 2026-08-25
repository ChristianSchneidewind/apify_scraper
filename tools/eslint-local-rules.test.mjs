import parser from '@typescript-eslint/parser';
import { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';
import local from './eslint-local-rules.mjs';

const verify = (code, rule, options = [], filename = 'cli/src/example.ts') => {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, {
    files: ['**/*.ts'],
    languageOptions: { parser },
    plugins: { local },
    rules: { [`local/${rule}`]: ['error', ...options] },
  }, { filename });
};

describe('local ESLint rules', () => {
  it('rejects files above the configured line limit', () => {
    const messages = verify(Array.from({ length: 4 }, () => 'const value = 1;').join('\n'), 'max-file-lines', [{ max: 3 }]);
    expect(messages).toHaveLength(1);
  });

  it('rejects functions above the configured line limit', () => {
    const code = ['function long() {', '  const one = 1;', '  const two = 2;', '}'].join('\n');
    expect(verify(code, 'max-function-lines', [{ max: 3 }])).toHaveLength(1);
  });

  it('rejects indentation beyond the configured depth', () => {
    const code = ['if (true) {', '  if (true) {', '    if (true) {', '      console.log(true);', '    }', '  }', '}'].join('\n');
    expect(verify(code, 'max-indent-depth', [{ max: 2 }])).not.toHaveLength(0);
  });

  it.each(['type Local = string;', 'interface Local { value: string }', 'enum Local { Value }'])(
    'rejects centralized declaration outside schemas: %s',
    (code) => expect(verify(code, 'centralized-types')).toHaveLength(1),
  );

  it('allows declarations in the centralized schema directory', () => {
    const messages = verify('type Central = string;', 'centralized-types', [], 'cli/src/schemas/example.ts');
    expect(messages).toHaveLength(0);
  });

  it('rejects inline structural types outside schemas', () => {
    const code = 'const read = (value: { name: string }) => value.name;';
    expect(verify(code, 'no-inline-structural-types')).toHaveLength(1);
  });

  it('requires TypeBox Static aliases in serializable schema modules', () => {
    const bad = verify('type Data = { value: string };', 'typebox-static-data-types', [], 'cli/src/schemas/outputs.ts');
    const good = verify('type Data = Static<typeof dataSchema>;', 'typebox-static-data-types', [], 'cli/src/schemas/outputs.ts');
    expect(bad).toHaveLength(1);
    expect(good).toHaveLength(0);
  });

  it.each(['value as any', 'value as never', 'value as unknown as string'])(
    'rejects unsafe assertion: %s',
    (code) => expect(verify(`const value = 1; ${code};`, 'no-unsafe-type-escape')).toHaveLength(1),
  );
});
