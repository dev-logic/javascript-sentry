/**
 * @fileoverview Rule to disallow using async await
 * @author Abhijeet Prasad
 */
'use strict';

// ------------------------------------------------------------------------------
// Requirements
// ------------------------------------------------------------------------------

const RuleTester = require('eslint').RuleTester;

const rule = require('../../../src/rules/no-async-await');

// ------------------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------------------

RuleTester.setDefaultConfig({
  parserOptions: {
    ecmaVersion: 8,
  },
});
const ruleTester = new RuleTester();

ruleTester.run('no-async-await', rule, {
  valid: [],
  invalid: [
    {
      code: 'async function hello() { await new Promise(); };',
      errors: [
        {
          message:
            'Using async-await can add a lot to bundle size. Please do not use it outside of tests, use Promises instead',
          type: 'FunctionDeclaration',
        },
      ],
    },
    {
      code: 'const hello = async () => { await new Promise(); };',
      errors: [
        {
          message:
            'Using async-await can add a lot to bundle size. Please do not use it outside of tests, use Promises instead',
          type: 'ArrowFunctionExpression',
        },
      ],
    },
  ],
});
