'use strict';

module.exports = {
  'parserOptions': {
    'ecmaVersion': 5,
    'sourceType': 'module',
    'ecmaFeatures': {
      'globalReturn': true,
      'impliedStrict': false,
      'jsx': false,
      'experimentalObjectRestSpread': false
    }
  },
  'env': {
    'node': true,
    'es6': true,
  },
  'extends': [
    'eslint:recommended',
    'amo/eslint-config-bestpractice.js',
    'amo/eslint-config-errors.js',
    'amo/eslint-config-es6.js',
    'amo/eslint-config-node.js',
    'amo/eslint-config-possibleerrors.js',
    'amo/eslint-config-stylistic.js',
    'amo/eslint-config-var.js'
  ],
  'parser': 'babel-eslint',
  'root': true
};
