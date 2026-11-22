import assert from 'node:assert/strict';

// Nenhum script inline, estilo inline ou atributo on* (a CSP da gestão proíbe, contrato 2.5).
export const semInline=html=>assert.doesNotMatch(html,/<script(?![^>]*\bsrc=)|<style|\sstyle=|\son[a-z]+=/i);
