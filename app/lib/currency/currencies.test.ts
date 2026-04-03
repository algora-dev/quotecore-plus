// Quick manual tests for currency formatting
// Run with: node -r esbuild-register currencies.test.ts

import { formatCurrency, formatCurrencyWithCode, getCurrencySymbol } from './currencies';

console.log('=== Currency Formatting Tests ===\n');

const testAmount = 1234.56;

console.log('Dollar currencies:');
console.log('  NZD:', formatCurrency(testAmount, 'NZD'));  // $1,234.56
console.log('  AUD:', formatCurrency(testAmount, 'AUD'));  // $1,234.56
console.log('  USD:', formatCurrency(testAmount, 'USD'));  // $1,234.56
console.log('  CAD:', formatCurrency(testAmount, 'CAD'));  // $1,234.56
console.log('  SGD:', formatCurrency(testAmount, 'SGD'));  // $1,234.56
console.log('  HKD:', formatCurrency(testAmount, 'HKD'));  // $1,234.56

console.log('\nOther currencies:');
console.log('  GBP:', formatCurrency(testAmount, 'GBP'));  // £1,234.56
console.log('  EUR:', formatCurrency(testAmount, 'EUR'));  // €1.234,56
console.log('  JPY:', formatCurrency(testAmount, 'JPY'));  // ¥1,235 (no decimals)
console.log('  CNY:', formatCurrency(testAmount, 'CNY'));  // ¥1,234.56
console.log('  CHF:', formatCurrency(testAmount, 'CHF'));  // CHF1,234.56
console.log('  INR:', formatCurrency(testAmount, 'INR'));  // ₹1,234.56

console.log('\nWith currency codes:');
console.log('  NZD:', formatCurrencyWithCode(testAmount, 'NZD'));  // $1,234.56 NZD
console.log('  AUD:', formatCurrencyWithCode(testAmount, 'AUD'));  // $1,234.56 AUD
console.log('  USD:', formatCurrencyWithCode(testAmount, 'USD'));  // $1,234.56 USD

console.log('\nSymbols only:');
console.log('  NZD:', getCurrencySymbol('NZD'));  // $
console.log('  GBP:', getCurrencySymbol('GBP'));  // £
console.log('  EUR:', getCurrencySymbol('EUR'));  // €
console.log('  JPY:', getCurrencySymbol('JPY'));  // ¥

console.log('\n=== Tests Complete ===');
